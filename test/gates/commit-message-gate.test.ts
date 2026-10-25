/** @jest-environment node */
import { runTool } from '../support/run-tool';

// Feeds one message to commitlint with the repository config.
function lintMessage(message: string) {
  return runTool('commitlint', [], {}, message);
}

describe('commit message gate (commitlint)', () => {
  it('should_reject_message_when_it_lacks_a_conventional_type', () => {
    const result = lintMessage('bad message');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('type-empty');
  });

  it('should_accept_message_when_it_follows_conventional_commits', () => {
    const result = lintMessage('feat(engine): add the hex board type');

    expect(result.status).toBe(0);
  });
});
