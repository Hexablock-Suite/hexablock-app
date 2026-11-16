// The Spanish texts of the app (APP-FR-11). Each key names one visible text.
// `en.ts` holds the same keys. `text-catalog.ts` joins both languages.
// The texts of one game live under `game.<id>.<part>`, where `<id>` is the text
// of its `GameId`: the game selector finds the names of each registered game there (#169).
export const es = {
  'home.title': 'HexaBlock Suite',
  'home.brand': 'HexaBlock',
  'home.suite': 'Suite',
  'home.play': 'Jugar',
  'map.title': 'Mapa de mundos',
  'map.back': 'Atrás',
  'game.hexa-lines.name': 'Hexa Lines',
  'game.hexa-lines.place': 'Estación Línea',
  'game.hexa-fit.name': 'Hexa Fit',
  'game.hexa-fit.place': 'La Colmena',
  'game.hexa-sort.name': 'Hexa Sort',
  'game.hexa-sort.place': 'Pilópolis',
  'game.hexa-merge.name': 'Hexa Merge',
  'game.hexa-merge.place': 'Fuente Fusión',
} as const;
