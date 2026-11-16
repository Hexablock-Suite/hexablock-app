/** @jest-environment node */
import { textCatalog } from '../../src/adapters/texts/text-catalog';

// APP-FR-11 (issue #154): every visible text has a Spanish and an English entry.
// The type check already refuses a key that one language lacks. This gate also runs
// when Jest runs without the type check, and it refuses an empty text.

type Catalog = Readonly<Record<string, Readonly<Record<string, string>>>>;

// Lists each key that a language lacks and each empty text, as `<language> ...`.
// `Object.hasOwn` reads only the own keys, so a key such as `constructor` counts too.
function catalogProblems(catalog: Catalog): string[] {
  const languages = Object.keys(catalog);
  const keys = [...new Set(languages.flatMap((language) => Object.keys(catalog[language])))];
  return languages.flatMap((language) =>
    keys.flatMap((key) => {
      const texts = catalog[language];
      if (!Object.hasOwn(texts, key)) return [`${language} lacks ${key}`];
      if (texts[key].trim() === '') return [`${language} has an empty text for ${key}`];
      return [];
    }),
  );
}

describe('text catalog gate', () => {
  it('should_report_nothing_when_the_catalog_holds_both_languages_with_the_same_keys', () => {
    expect(Object.keys(textCatalog)).toEqual(['es', 'en']);
    expect(catalogProblems(textCatalog)).toEqual([]);
  });

  it('should_report_the_missing_key_when_only_spanish_has_it', () => {
    const catalog = {
      es: { 'home.title': 'Inicio', 'home.play': 'Jugar' },
      en: { 'home.title': 'Home' },
    };

    expect(catalogProblems(catalog)).toEqual(['en lacks home.play']);
  });

  it('should_report_the_missing_key_when_only_english_has_it', () => {
    const catalog = {
      es: { 'home.title': 'Inicio' },
      en: { 'home.title': 'Home', 'home.play': 'Play' },
    };

    expect(catalogProblems(catalog)).toEqual(['es lacks home.play']);
  });

  it('should_report_the_missing_key_when_it_has_the_name_of_an_object_member', () => {
    const catalog = {
      es: { 'home.title': 'Inicio', constructor: 'Constructor' },
      en: { 'home.title': 'Home' },
    };

    expect(catalogProblems(catalog)).toEqual(['en lacks constructor']);
  });

  it('should_report_the_text_when_it_is_empty_or_only_white_space', () => {
    const catalog = {
      es: { 'home.title': '' },
      en: { 'home.title': ' \n ' },
    };

    expect(catalogProblems(catalog)).toEqual([
      'es has an empty text for home.title',
      'en has an empty text for home.title',
    ]);
  });
});
