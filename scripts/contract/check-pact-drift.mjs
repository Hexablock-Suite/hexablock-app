// Fails when a pact file under pacts/ differs from the git index or is not tracked.
// pnpm test regenerates the pact files, so pnpm verify runs this check after the tests.
// In CI the index equals the commit, so a failure means the committed pact is stale.
import { spawnSync } from 'node:child_process';

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`git ${args.join(' ')} failed:\n${result.stderr}`);
    process.exit(2);
  }
  return result.stdout.split('\n').filter((line) => line !== '');
}

const changed = git(['diff', '--name-only', '--', 'pacts']);
const untracked = git(['ls-files', '--others', '--exclude-standard', '--', 'pacts']);
const drifted = [...changed, ...untracked];

if (drifted.length > 0) {
  console.error('The pact files that the tests wrote differ from the committed copy:');
  for (const file of drifted) console.error(`  ${file}`);
  console.error('Commit the regenerated pact files.');
  process.exit(1);
}
console.log('The pact files match the committed copy.');
