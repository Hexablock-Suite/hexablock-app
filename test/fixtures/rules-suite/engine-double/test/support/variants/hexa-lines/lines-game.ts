import { LinesRules } from '../../../../src/domain/variants/hexa-lines/lines-rules';

jest.doMock('../../../../src/domain/engine/rules');

export const QuietLines = class extends LinesRules {};
