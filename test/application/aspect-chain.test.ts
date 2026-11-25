import { Result } from '../../src/application/result';
import type { UseCase } from '../../src/application/use-case';
import { UseCaseAspect, wrapInAspects } from '../../src/application/use-case-aspect';

// Issue #323: the composition root gives each use case its aspects through one chain.
// The chain runs from the outside in: the first aspect of the list is the outer one.

// A use case that records its call and answers with a fixed value.
class RecordedUseCase implements UseCase<string, number> {
  constructor(private readonly events: string[]) {}

  async execute(request: string): Promise<Result<number>> {
    this.events.push(`use case: ${request}`);
    return Result.success(7);
  }
}

// An aspect that records when it sees the call and when it sees the result.
class RecordingAspect extends UseCaseAspect<string, number> {
  constructor(
    inner: UseCase<string, number>,
    private readonly name: string,
    private readonly events: string[],
  ) {
    super(inner);
  }

  protected override async around(request: string): Promise<Result<number>> {
    this.events.push(`${this.name}: call`);
    const result = await super.around(request);
    this.events.push(`${this.name}: result`);
    return result;
  }
}

describe('wrapInAspects', () => {
  it('should_let_the_outer_aspect_see_the_call_first_and_the_result_last_when_two_aspects_wrap_a_use_case', async () => {
    const events: string[] = [];
    const useCase = new RecordedUseCase(events);

    const chained = wrapInAspects(useCase, [
      (inner) => new RecordingAspect(inner, 'outer', events),
      (inner) => new RecordingAspect(inner, 'inner', events),
    ]);
    const result = await chained.execute('x');

    expect(result).toEqual(Result.success(7));
    expect(events).toEqual([
      'outer: call',
      'inner: call',
      'use case: x',
      'inner: result',
      'outer: result',
    ]);
  });
});
