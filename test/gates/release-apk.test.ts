/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from '../support/run-tool';

const read = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');

describe('APK release workflow', () => {
  const workflow = read('.github/workflows/release-apk.yml');

  it('should_build_on_version_tags_and_manual_runs_when_release_workflow_triggers', () => {
    expect(workflow).toMatch(/^on:\n {2}push:\n {4}tags: \['v\*'\]\n {2}workflow_dispatch:$/m);
    expect(workflow).toMatch(/^ {6}contents: write$/m);
  });

  it('should_assemble_the_release_apk_from_prebuild_when_job_apk_runs', () => {
    expect(workflow).toMatch(/^ {2}apk:\n {4}name: apk$/m);
    expect(workflow).toMatch(/distribution: temurin\n {10}java-version: '17'/);
    expect(workflow).toMatch(/- run: npx expo prebuild --platform android$/m);
    expect(workflow).toMatch(/run: \.\/gradlew assembleRelease/);
    expect(workflow).toMatch(/uses: actions\/upload-artifact@v7/);
    expect(workflow).toMatch(/if-no-files-found: error/);
  });

  it('should_attach_the_apk_to_a_github_release_when_ref_is_a_version_tag', () => {
    expect(workflow).toMatch(/if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
    expect(workflow).toMatch(/gh release create "\$GITHUB_REF_NAME"/);
  });

  it('should_keep_native_folders_out_of_git_when_prebuild_generates_them', () => {
    const ignored = read('.gitignore').split('\n');

    expect(ignored).toContain('/android');
    expect(ignored).toContain('/ios');
  });
});
