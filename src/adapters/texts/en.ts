// The English texts of the app (APP-FR-11). Each key names one visible text.
// `es.ts` holds the same keys. `text-catalog.ts` joins both languages.
// The texts of one game live under `game.<id>.<part>`, where `<id>` is the text
// of its `GameId`: the game selector finds the names of each registered game there (#169).
export const en = {
  'home.title': 'HexaBlock Suite',
  'home.brand': 'HexaBlock',
  'home.suite': 'Suite',
  'home.play': 'Play',
  'map.title': 'World map',
  'map.back': 'Back',
  'game.hexa-lines.name': 'Hexa Lines',
  'game.hexa-lines.place': 'Line Station',
  'game.hexa-fit.name': 'Hexa Fit',
  'game.hexa-fit.place': 'The Hive',
  'game.hexa-sort.name': 'Hexa Sort',
  'game.hexa-sort.place': 'Stackville',
  'game.hexa-merge.name': 'Hexa Merge',
  'game.hexa-merge.place': 'Merge Fountain',
} as const;
