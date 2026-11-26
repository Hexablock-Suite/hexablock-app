# The app and the team prototype

This list compares the web export of the app with the team prototype, https://prototipo-hexablock.vercel.app/ (#287). Only the design tokens of #169 and the achievement list of #188 came from the prototype. Both were opened on 2026-11-22 in the same headless Chromium, at 430 × 932 and at 1280 × 800. The app screens are the screenshots of [README.md](README.md). Each item is a difference that the two screens showed. The list says nothing about which side is right: the team decides that.

## Every screen

- At the desktop width the prototype shows one column 440 px wide in the middle, with a slate-blue band on each side. The app fills the window with its scenery and keeps its content in a centered column of at most 560 points.
- The prototype draws its titles in a display serif with a dark outline. The app takes the serif face of the system, because it bundles no font yet (`src/infrastructure/ui/theme.ts`).
- The prototype has a mascot, a yellow hexagon with a face, on the home screen and on each game screen. The app has none.
- The prototype shows a settings screen, «Ajustes», with sound, music, the language (ES or EN), the figure catalog and the tutorials. The app has no settings screen.

## Home

- The prototype shows the logo as outlined letters with the «SUITE» ribbon. The app shows the logo on a wooden plaque with the same ribbon.
- The prototype shows the mascot and floating colored hexagons with faces. The app shows four stones in the shape of the chosen figure.
- The prototype shows the hint «TOCA PARA JUGAR» and one button, «JUGAR». The app shows the figure selector, «JUGAR» and «LOGROS».
- The prototype chooses the figure in Ajustes, under «Figuras», «CATÁLOGO». The app chooses it on the home screen.

## Game selector map

- Both show the four worlds in the same order and with the same colors: Estación Línea, La Colmena, Pilópolis and Fuente Fusión, from the bottom.
- The prototype draws each world as a scene: a train, a beehive, colored towers and a fountain with 2048. The app draws each world as a stone in the shape of the figure.
- The sign of a world in the prototype holds the place and three stars. The sign in the app holds the game name and the place, and no stars.
- The prototype shows the total of stars and a settings button at the top. The app shows a back button, «ATRÁS», and the title «Mapa de mundos».
- A tap on a world in the prototype opens a sheet with the place, the game, «Niveles 0 / 6» or «Tu mejor 0», «JUGAR» and «¿CÓMO JUGAR?». A tap in the app opens the game screen.
- Hexa Fit and Hexa Sort open a level selector of six levels in the prototype, with levels 2 to 6 locked. The app also opens a level selector (#173), with every level of the chosen figure shown as completed, open or locked.

## Game screens

- Each game opens with a tutorial in the prototype, «Cómo jugar» with «SIGUIENTE» and «Saltar», and then a short title card such as «¡Fusiona!». The app opens on the board.
- The prototype shows a yellow pause button, with «CONTINUAR», «REINICIAR», «MAPA», «¿CÓMO JUGAR?» and the sound. The app shows a «MAPA» button and the title of the game.
- The score card of the prototype holds «Puntos» and «Mejor». The status bar of the app holds «PUNTOS» and the state of the game, such as «En juego».
- Each game has its own scenery in the prototype: a desert sunset for Hexa Lines, a mint field with a beehive for Hexa Fit, a pink city for Hexa Sort and a pale blue sky for Hexa Merge. The app shows the same sky and hills on every game.
- The prototype draws the cells as raised beige hexagons. The app draws them as dark brown hexagons in a wooden frame.
- Undo, redo and rotate are icon buttons in the prototype. They are text buttons in the app: «DESHACER», «REHACER» and «GIRAR».
- Hexa Lines: both boards have 61 cells. The prototype shows a tray of three pieces below the board. The app shows the board alone (#174).
- Hexa Fit: the first level of the prototype has 7 cells and 3 pieces, with the counter «Nivel 1, 0 / 3 piezas» and a progress bar at the top. The first level of the app has 3 cells and 2 pieces, with «TIEMPO» and «MOVIMIENTOS».
- Hexa Sort: both boards have 19 cells. The prototype shows «Nivel 1, 0 / 2 metas» and a «SIGUIENTE» panel with three stacks. The app shows the board alone.
- Hexa Merge: both boards have 19 cells and start with two tiles of 2. The prototype shows the next tile, «NUEVA FICHA», and takes a swipe. The app shows a ring of six slide buttons, and on the web it also takes the keyboard (#292).

## Not compared

- The achievements screen. The prototype showed no achievements screen from its home screen, its map, its settings or its pause menu, so the app screen has nothing to compare with.
- The square and triangle boards. The figure catalog of the prototype was opened, but no game was played on another figure.
- Anything after the first view of a game: moves, the end of a game and the stars.
