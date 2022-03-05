# Sewermancer

A game for [7DRL Challenge 2022](https://itch.io/jam/7drl-challenge-2022).

## Development

### Repository Structure

- `assets`: Source assets, e.g. icons.
- `htdocs`: Static web app files, e.g. HTML, CSS, etc.
  - `images`: Game textures.
  - `data`: Game JSON data files, e.g. Tiled maps/tilesets.
  - `index.html`: The main HTML entry point.
  - `main.js`: The main _compiled_ script entry point. Automatically generated from TypeScript source in `lib`. **DO NOT EDIT.**
- `lib`: TypeScript game source.
  - `scene`: View-related scripts.
  - `sim`: Sim/model-related scripts.
  - `main.ts`: The main game script entry point. Everything starts here.

### Game Engine

Much of the game code is built upon [`@mousepox/jack`](https://github.com/geoffb/mousepox-jack), a 2D canvas-based game engine.

### Prerequisites

- [Node.js](https://nodejs.org/en/) _REQUIRED_
- [Yarn](https://classic.yarnpkg.com/en/) _REQUIRED_
- [Tiled](https://www.mapeditor.org/) 1.8+ (required for editing maps/tilesets in `htdocs/data/`)
- Image editor, e.g. [Pixen](https://pixenapp.com/) (required for editing images in `htdocs/images` and `assets`)

### Setup

Run `yarn` in the project folder to install dependencies for the first time, or when dependencies have been updated.

### Making Changes

Run `yarn develop` in the project folder which serves the game over HTTP (on port `8080` by default)

The TypeScript code in `lib` will be watched for changes and automatically transpiled and bundled for the browser into `htdocs/main.js`.

Point your browser to `http://localhost:8081` to test the game. Edit code in `lib`, switch to browser, reload to see changes. Rinse, repeat.

### Releasing

Run `yarn release` to create builds and automatically publish them to itch.io.
