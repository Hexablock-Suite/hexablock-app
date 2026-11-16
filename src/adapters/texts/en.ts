// The English texts of the app (APP-FR-11). Each key names one visible text.
// `es.ts` holds the same keys. `text-catalog.ts` joins both languages.
// The texts of one game live under `game.<id>.<part>`, where `<id>` is the text
// of its `GameId`: the game selector finds the names of each registered game there (#169).
// The texts of the game screen live under `play.<part>`, so no key of the game screen
// looks like the key of a game (#170). The texts of the move controls of one variant
// live under `play.<variant>.<part>`, such as `play.fit.rotate` (#175).
// The name of each board figure lives under `figure.<id>`, where `<id>` is the text
// of its `TopologyId` (#171).
export const en = {
  'home.title': 'HexaBlock Suite',
  'home.brand': 'HexaBlock',
  'home.suite': 'Suite',
  'home.play': 'Play',
  'home.figure': 'Board figure',
  'figure.hex': 'Hexagon',
  'figure.square': 'Square',
  'figure.triangle': 'Triangle',
  'map.title': 'World map',
  'map.back': 'Back',
  'play.back': 'Map',
  'play.board': 'Board',
  'play.score': 'Score',
  'play.starting': 'Setting up the board',
  'play.outcome.playing': 'In play',
  'play.outcome.victory': 'Victory!',
  'play.outcome.game-over': 'Game over',
  'play.error.move-rejected': 'That move is not allowed',
  'play.error': 'The game could not go on. Go back to the map and open the game again.',
  'play.time': 'Time',
  'play.undo': 'Undo',
  'play.redo': 'Redo',
  'play.error.nothing-to-undo': 'There is no move to undo',
  'play.error.nothing-to-redo': 'There is no move to redo',
  'play.fit.moves': 'Moves',
  'play.fit.tray': 'Piece tray',
  'play.fit.piece': 'Piece',
  'play.fit.rotate': 'Rotate',
  'play.fit.hint.pick': 'Pick a piece. Tap a placed piece to take it back.',
  'play.fit.hint.place': 'Tap a free space: the dot of the piece goes there.',
  'play.fit.hint.done': 'Every piece is on the figure.',
  'game.hexa-lines.name': 'Hexa Lines',
  'game.hexa-lines.place': 'Line Station',
  'game.hexa-fit.name': 'Hexa Fit',
  'game.hexa-fit.place': 'The Hive',
  'game.hexa-sort.name': 'Hexa Sort',
  'game.hexa-sort.place': 'Stackville',
  'game.hexa-merge.name': 'Hexa Merge',
  'game.hexa-merge.place': 'Merge Fountain',
} as const;
