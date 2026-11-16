// The Spanish texts of the app (APP-FR-11). Each key names one visible text.
// `en.ts` holds the same keys. `text-catalog.ts` joins both languages.
// The texts of one game live under `game.<id>.<part>`, where `<id>` is the text
// of its `GameId`: the game selector finds the names of each registered game there (#169).
// The texts of the game screen live under `play.<part>`, so no key of the game screen
// looks like the key of a game (#170). The texts of the move controls of one variant
// live under `play.<variant>.<part>`, such as `play.fit.rotate` (#175).
// The name of each board figure lives under `figure.<id>`, where `<id>` is the text
// of its `TopologyId` (#171).
// The texts of the achievements screen live under `achievements.<part>`, and the name of each
// achievement lives under `achievement.<id>`, where `<id>` is the id that the composition root
// gives to the achievement (#188).
export const es = {
  'home.title': 'HexaBlock Suite',
  'home.brand': 'HexaBlock',
  'home.suite': 'Suite',
  'home.play': 'Jugar',
  'home.figure': 'Figura del tablero',
  'figure.hex': 'Hexágono',
  'figure.square': 'Cuadrado',
  'figure.triangle': 'Triángulo',
  'map.title': 'Mapa de mundos',
  'map.back': 'Atrás',
  'play.back': 'Mapa',
  'play.board': 'Tablero',
  'play.score': 'Puntos',
  'play.starting': 'Preparando el tablero',
  'play.outcome.playing': 'En juego',
  'play.outcome.victory': '¡Victoria!',
  'play.outcome.game-over': 'Fin del juego',
  'play.error.move-rejected': 'Esa jugada no se puede hacer',
  'play.error': 'No se pudo jugar. Vuelve al mapa y abre el juego otra vez.',
  'play.time': 'Tiempo',
  'play.fit.moves': 'Movimientos',
  'play.fit.tray': 'Bandeja de piezas',
  'play.fit.piece': 'Pieza',
  'play.fit.rotate': 'Girar',
  'play.fit.hint.pick': 'Elige una pieza. Toca una pieza puesta para quitarla.',
  'play.fit.hint.place': 'Toca una casilla libre: el punto de la pieza va ahí.',
  'play.fit.hint.done': 'Todas las piezas están en la figura.',
  'game.hexa-lines.name': 'Hexa Lines',
  'game.hexa-lines.place': 'Estación Línea',
  'game.hexa-fit.name': 'Hexa Fit',
  'game.hexa-fit.place': 'La Colmena',
  'game.hexa-sort.name': 'Hexa Sort',
  'game.hexa-sort.place': 'Pilópolis',
  'game.hexa-merge.name': 'Hexa Merge',
  'game.hexa-merge.place': 'Fuente Fusión',
  'achievements.title': 'Logros',
  'achievements.back': 'Atrás',
  'achievements.loading': 'Cargando los logros',
  'achievements.error': 'No se pudieron leer los logros. Vuelve atrás y ábrelos otra vez.',
  'achievements.in-progress': 'En progreso',
  'achievements.completed': 'Completados',
  'achievements.none-in-progress': 'Completaste todos los logros.',
  'achievements.none-completed': 'Aún no completas ningún logro.',
  'achievement.lines-combo': 'Completa 3 líneas a la vez',
  'achievement.merge-256': 'Llega a 256 en Hexa Merge',
  'achievement.merge-2048': 'Llega a 2048 en Hexa Merge',
  'achievement.fit-3': 'Gana 3 niveles de Hexa Fit',
  'achievement.sort-3': 'Gana 3 niveles de Hexa Sort',
  'achievement.fit-all': 'Gana todos los niveles de Hexa Fit',
  'achievement.sort-goals': 'Cumple 10 metas en Hexa Sort',
} as const;
