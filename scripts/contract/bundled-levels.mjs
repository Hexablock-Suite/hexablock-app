// Loads the bundled level files into a backend and checks them for drift (hexablock-api #158).
// Usage: node scripts/contract/bundled-levels.mjs <load|check>
// BACKEND_URL names the backend. The default is http://localhost:3000.
// "load" sends every file of src/adapters/levels/{fit,sort}/ to PUT /v1/levels as it is (S3-02).
// It needs LEVEL_EDITOR_TOKEN: the token of an account in LEVEL_EDITOR_IDS of the backend (#145).
// "check" reads GET /v1/levels and fails when a bundled file differs from its stored copy.
// A stored copy with a higher version is no drift: the version rule of S3-10 keeps it.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const levelFolders = ['src/adapters/levels/fit', 'src/adapters/levels/sort'];
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
const levelsUrl = new URL('v1/levels', backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`);
// The problem code that the backend gives when it keeps a higher stored version.
const OLDER_VERSION = ': older-version';

// Reads each bundled level file, Fit first, each folder in file name order.
async function readBundledLevels() {
  const levels = [];
  for (const folder of levelFolders) {
    const names = (await readdir(path.join(repoRoot, folder))).filter((name) =>
      name.endsWith('.json'),
    );
    for (const name of names.sort()) {
      const file = `${folder}/${name}`;
      // oxlint-disable-next-line no-await-in-loop -- The files load one after the other, in order.
      const level = JSON.parse(await readFile(path.join(repoRoot, file), 'utf8'));
      levels.push({ file, level });
    }
  }
  return levels;
}

// Sends one request. An unreachable backend stops the script.
async function send(method, init = {}) {
  try {
    return await fetch(levelsUrl, { method, ...init });
  } catch (error) {
    console.error(
      `Cannot reach the backend at ${levelsUrl}: ${error.cause?.message ?? error.message}`,
    );
    console.error('Start the backend or set BACKEND_URL.');
    process.exit(1);
  }
}

// Gives the JSON body of a response, or null when the body is not JSON.
async function jsonOf(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Gives the same text for two equal JSON values, whatever the order of their keys.
function canonical(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const keyOf = ({ gameId, levelId }) => `${gameId}/${levelId}`;

async function load() {
  const token = process.env.LEVEL_EDITOR_TOKEN;
  if (!token) {
    console.error('LEVEL_EDITOR_TOKEN is not set.');
    console.error('Set the token of an account in LEVEL_EDITOR_IDS of the backend.');
    process.exit(1);
  }
  const bundled = await readBundledLevels();
  const response = await send('PUT', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ levels: bundled.map(({ level }) => level) }),
  });
  if (response.status !== 204) {
    const body = await jsonOf(response);
    const details = Array.isArray(body?.details) ? body.details : [];
    // A lower version saves the other levels of the batch, and the backend keeps its copy.
    const onlyOlder =
      response.status === 400 &&
      details.length > 0 &&
      details.every((detail) => String(detail).endsWith(OLDER_VERSION));
    if (!onlyOlder) {
      console.error(`PUT /v1/levels answered ${response.status}: ${body?.message ?? ''}`);
      for (const detail of details) console.error(`  ${detail}`);
      process.exit(1);
    }
    for (const detail of details) {
      console.log(
        `The backend keeps a higher version of ${detail.slice(0, -OLDER_VERSION.length)} (S3-10).`,
      );
    }
  }
  console.log(`Sent the ${bundled.length} bundled levels to ${levelsUrl}.`);
}

async function check() {
  const bundled = await readBundledLevels();
  const response = await send('GET');
  const body = await jsonOf(response);
  if (response.status !== 200 || !Array.isArray(body?.levels)) {
    console.error(`GET /v1/levels answered ${response.status} with no list of levels.`);
    process.exit(1);
  }
  const stored = new Map(body.levels.map((level) => [keyOf(level), level]));
  const broken = new Map((body.unavailable ?? []).map((entry) => [keyOf(entry), entry]));
  const drifts = [];
  for (const { file, level } of bundled) {
    const key = keyOf(level);
    const copy = stored.get(key);
    if (broken.has(key)) {
      drifts.push(`${key}: the stored copy breaks the rule ${broken.get(key).reason}.`);
    } else if (copy === undefined) {
      drifts.push(`${key}: the backend holds no copy of ${file}.`);
    } else if (copy.version > level.version) {
      console.log(
        `${key}: the backend keeps a higher version (${copy.version} > ${level.version}), as S3-10 allows.`,
      );
    } else if (canonical(copy) !== canonical(level)) {
      drifts.push(`${key}: the stored copy differs from ${file}.`);
    }
  }
  if (drifts.length > 0) {
    for (const drift of drifts) console.error(drift);
    console.error(
      `${drifts.length} of ${bundled.length} bundled levels differ from the levels at ${levelsUrl}.`,
    );
    console.error('Run pnpm levels:load against that backend, or raise the version of the file.');
    process.exit(1);
  }
  console.log(`The ${bundled.length} bundled levels match the levels at ${levelsUrl}.`);
}

const modes = { load, check };
const mode = modes[process.argv[2]];
if (mode === undefined) {
  console.error('Usage: node scripts/contract/bundled-levels.mjs <load|check>');
  process.exit(2);
}
await mode();
