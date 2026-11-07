/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

// Issue #89: a `«Sprint N»` marker in a class or extensibility view gives the sprint that
// `docs/ROADMAP.md` gives to the requirement that the planned class serves.
// The `<text>` or `<tspan>` that holds the marker names that requirement in its
// `data-requirement` attribute: one ID, or several IDs that a space separates,
// for example `data-requirement="APP-FR-04 APP-FR-09"`. The PNG does not show the attribute.
// Each ID must be in the table of the `## Sprint N` section of the roadmap.
// One element holds at most one marker, so each marker has its own requirement.
// The legend of each view states the rule, and no view keeps the old legend.

const VIEW_DIRS = ['docs/architecture/classes/views', 'docs/architecture/extensibility/views'];
const FIXTURES = path.join(repoRoot, 'test/fixtures/sprint-markers');
const MARKER = /«Sprint (\d+)»/g;
const REQUIREMENT_ID = /^(APP|API)-(FR|NFR)-\d{2}$/;
const OLD_LEGEND = 'N is its sprint in docs/ROADMAP.md';
const LEGEND_RULE = 'N is the docs/ROADMAP.md sprint of the requirement it serves';

type View = { file: string; html: string };
type Marker = { where: string; sprint: number; requirement: string | undefined };

// Maps each requirement ID in the table of a `## Sprint N` section to every such N.
function sprintsOfRequirements(roadmap: string): Map<string, number[]> {
  const sprints = new Map<string, number[]>();
  let sprint: number | undefined;
  for (const line of roadmap.split('\n')) {
    if (line.startsWith('## ')) {
      const heading = /^## Sprint (\d+)\b/.exec(line)?.[1];
      sprint = heading === undefined ? undefined : Number(heading);
    }
    const id = /^\|\s*((?:APP|API)-(?:FR|NFR)-\d{2})\s*\|/.exec(line)?.[1];
    if (sprint !== undefined && id !== undefined)
      sprints.set(id, [...(sprints.get(id) ?? []), sprint]);
  }
  return sprints;
}

// Maps each requirement ID to its sprint. For an ID in two sprints, the last one wins.
// roadmapProblems reports that ID.
function sprintOfRequirements(roadmap: string): Map<string, number> {
  return new Map(
    [...sprintsOfRequirements(roadmap)].map(([id, sprints]) => [id, sprints[sprints.length - 1]]),
  );
}

// Reads every marker with the innermost `<text>` or `<tspan>` that holds it.
// It reports an element that holds more than one marker.
function markersIn(view: View): { markers: Marker[]; problems: string[] } {
  const markers: Marker[] = [];
  const problems: string[] = [];
  const open: { attributes: string; count: number }[] = [];
  const tag = /<(\/?)(text|tspan)\b([^>]*)>/g;
  let last = 0;
  const read = (chunk: string, end: number) => {
    for (const match of chunk.matchAll(MARKER)) {
      const line = view.html.slice(0, end - chunk.length + match.index).split('\n').length;
      const where = `${view.file}:${line} ${match[0]}`;
      const holder = open.at(-1);
      if (holder === undefined) {
        problems.push(`${where} is outside a <text> element`);
        continue;
      }
      holder.count += 1;
      if (holder.count > 1) problems.push(`${where} shares its element with another marker`);
      const requirement = /\sdata-requirement="([^"]*)"/.exec(holder.attributes)?.[1];
      markers.push({ where, sprint: Number(match[1]), requirement });
    }
  };
  for (const match of view.html.matchAll(tag)) {
    read(view.html.slice(last, match.index), match.index);
    if (match[1] === '/') open.pop();
    else open.push({ attributes: match[3], count: 0 });
    last = match.index + match[0].length;
  }
  read(view.html.slice(last), view.html.length);
  return { markers, problems };
}

// Returns one line per marker that breaks the rule.
function markerProblems(views: View[], roadmap: string): string[] {
  const sprints = sprintOfRequirements(roadmap);
  return views.flatMap((view) => {
    const { markers, problems } = markersIn(view);
    return problems.concat(
      markers.flatMap(({ where, sprint, requirement }) => {
        if (requirement === undefined || requirement.trim() === '')
          return [`${where} has no data-requirement`];
        return requirement
          .trim()
          .split(/\s+/)
          .flatMap((id) => {
            if (!REQUIREMENT_ID.test(id)) return [`${where} names ${id}, which is not an ID`];
            const planned = sprints.get(id);
            if (planned === undefined) return [`${where} names ${id}, which no sprint lists`];
            if (planned !== sprint) return [`${where} names ${id}, which is in Sprint ${planned}`];
            return [];
          });
      }),
    );
  });
}

// Returns one line per requirement ID that more than one sprint table lists.
function roadmapProblems(roadmap: string): string[] {
  return [...sprintsOfRequirements(roadmap)]
    .filter(([, sprints]) => sprints.length > 1)
    .map(([id, sprints]) => `${id} is in Sprint ${sprints.join(' and Sprint ')}`);
}

// Returns one line per view whose legend does not state the rule.
function legendProblems(views: View[]): string[] {
  return views.flatMap(({ file, html }) => {
    const text = html.replace(/\s+/g, ' ');
    if (text.includes(OLD_LEGEND)) return [`${file} keeps the legend «${OLD_LEGEND}»`];
    if (text.includes('«Sprint N»') && !text.includes(LEGEND_RULE))
      return [`${file} has no legend «${LEGEND_RULE}»`];
    return [];
  });
}

function readViews(dirs: string[]): View[] {
  return dirs.flatMap((dir) =>
    readdirSync(path.join(repoRoot, dir))
      .filter((name) => name.endsWith('.html'))
      .sort()
      .map((name) => ({
        file: `${dir}/${name}`,
        html: readFileSync(path.join(repoRoot, dir, name), 'utf8'),
      })),
  );
}

const fixture = (name: string): View => ({
  file: name,
  html: readFileSync(path.join(FIXTURES, name), 'utf8'),
});

const roadmap = readFileSync(path.join(repoRoot, 'docs/ROADMAP.md'), 'utf8');
const fixtureRoadmap = readFileSync(path.join(FIXTURES, 'roadmap.md'), 'utf8');
const views = readViews(VIEW_DIRS);

describe('«Sprint N» markers of the class and extensibility views', () => {
  it('should_find_markers_when_reading_the_views', () => {
    expect(views.flatMap((view) => markersIn(view).markers).length).toBeGreaterThan(0);
  });

  it('should_list_no_problem_when_each_marker_names_a_requirement_of_its_sprint', () => {
    expect(markerProblems(views, roadmap)).toEqual([]);
  });

  it('should_list_no_problem_when_each_legend_states_the_requirement_rule', () => {
    expect(legendProblems(views)).toEqual([]);
  });

  it('should_list_no_problem_when_a_fixture_follows_the_rule', () => {
    const view = fixture('valid.html');

    expect(markerProblems([view], fixtureRoadmap)).toEqual([]);
    expect(legendProblems([view])).toEqual([]);
  });

  it('should_report_the_marker_when_its_requirement_is_in_another_sprint', () => {
    expect(markerProblems([fixture('wrong-sprint.html')], fixtureRoadmap)).toEqual([
      'wrong-sprint.html:3 «Sprint 2» names APP-FR-16, which is in Sprint 3',
    ]);
  });

  it('should_report_the_marker_when_it_has_no_data_requirement', () => {
    expect(markerProblems([fixture('no-requirement.html')], fixtureRoadmap)).toEqual([
      'no-requirement.html:3 «Sprint 3» has no data-requirement',
    ]);
  });

  it('should_report_the_marker_when_no_sprint_lists_its_requirement', () => {
    expect(markerProblems([fixture('unknown-requirement.html')], fixtureRoadmap)).toEqual([
      'unknown-requirement.html:3 «Sprint 3» names APP-FR-99, which no sprint lists',
    ]);
  });

  it('should_report_the_marker_when_one_element_holds_two_markers', () => {
    expect(markerProblems([fixture('two-markers.html')], fixtureRoadmap)).toEqual([
      'two-markers.html:4 «Sprint 3» shares its element with another marker',
    ]);
  });

  it('should_report_the_view_when_its_legend_says_n_is_its_sprint_in_the_roadmap', () => {
    expect(legendProblems([fixture('old-legend.html')])).toEqual([
      `old-legend.html keeps the legend «${OLD_LEGEND}»`,
    ]);
  });

  it('should_report_the_marker_when_it_is_outside_a_text_element', () => {
    expect(markerProblems([fixture('outside-text.html')], fixtureRoadmap)).toEqual([
      'outside-text.html:2 «Sprint 3» is outside a <text> element',
    ]);
  });

  it('should_report_the_marker_when_its_requirement_is_not_a_well_formed_id', () => {
    expect(markerProblems([fixture('malformed-id.html')], fixtureRoadmap)).toEqual([
      'malformed-id.html:3 «Sprint 3» names APP-FR-4, which is not an ID',
    ]);
  });

  it('should_report_no_data_requirement_when_the_attribute_is_empty', () => {
    expect(markerProblems([fixture('empty-requirement.html')], fixtureRoadmap)).toEqual([
      'empty-requirement.html:3 «Sprint 3» has no data-requirement',
    ]);
  });

  it('should_report_the_view_when_it_shows_sprint_n_without_the_legend_rule', () => {
    expect(legendProblems([fixture('no-legend.html')])).toEqual([
      `no-legend.html has no legend «${LEGEND_RULE}»`,
    ]);
  });

  it('should_list_no_problem_when_each_requirement_is_in_one_sprint_of_the_roadmap', () => {
    expect(roadmapProblems(roadmap)).toEqual([]);
    expect(roadmapProblems(fixtureRoadmap)).toEqual([]);
  });

  it('should_report_the_requirement_when_two_sprints_of_the_roadmap_list_it', () => {
    const twice = readFileSync(path.join(FIXTURES, 'roadmap-twice.md'), 'utf8');

    expect(roadmapProblems(twice)).toEqual(['APP-FR-16 is in Sprint 2 and Sprint 3']);
  });
});
