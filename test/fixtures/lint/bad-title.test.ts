// Wrong example: the test titles do not follow should_<result>_when_<condition>.
describe('Board', () => {
  it('clears lines', () => {
    expect(true).toBe(true);
  });

  test('should_keep_score', () => {
    expect(true).toBe(true);
  });
});
