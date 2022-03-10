import { Game, SpriteSheet, SpriteText } from "@mousepox/jack";
import { LoadingScene } from "./scene/LoadingScene";
import { LostScene } from "./scene/LostScene";
import { TitleOption, TitleScene } from "./scene/TitleScene";
import { WorldScene } from "./scene/WorldScene";
import { World } from "./sim/World";
import { getSave, setSave } from "./util/save";
import type { Config } from "./types";

// Boot configuration
const BootConfig = {
  Width: 256,
  Height: 160,
  ConfigFile: "data/config.json",
};

const save = getSave();

async function main() {
  function restart() {
    world.restart();
    worldScene.reset();
    game.activateScene("world");
    // worldScene.intro();
  }

  // Init game
  const game = new Game(BootConfig.Width, BootConfig.Height);

  // Load main configuration
  const config = (await game.data.load(BootConfig.ConfigFile)) as Config;

  // Preload sprite font
  const fontImage = await game.images.load(config.font.image);
  SpriteText.DefaultFont = {
    glyphs: config.font.glyphs,
    sheet: new SpriteSheet(fontImage, config.font.width, config.font.height),
  };

  // Init and activate loading scene
  game.addScene("loading", LoadingScene);
  game.activateScene("loading");

  // Start game
  game.start();

  // Register and load sounds in the background
  game.sounds.volume = config.soundVolume;
  game.sounds.register(config.preload.sounds);

  // Preload assets
  await Promise.all([
    game.images.loadBatch(config.preload.images),
    game.data.loadBatch(config.preload.data),
  ]);

  // Use first keyboard interaction to trigger sounds
  game.keyboard.onFirstInteract = () => {
    game.sounds.play("menu_select", 0.000001);
  };

  // Init world sim
  const world = new World(game.data);

  // Title scene
  const titleScene = game.addScene("title", TitleScene);
  if (save.highScore > 0) {
    titleScene.setHighScore(save.highScore);
  }
  titleScene.onOptionSelect = (option) => {
    if (option === TitleOption.NewGame) {
      restart();
    } else if (option === TitleOption.Continue) {
      console.warn("TBD: Continue game");
    }
  };

  // Lost/Game Over scene
  const lostScene = game.addScene("lost", LostScene);
  lostScene.onRestart = () => restart();

  // World scene
  const worldScene = game.addScene("world", WorldScene);
  worldScene.onWon = () => game.activateScene("won");
  worldScene.onLost = () => {
    let best = false;
    if (world.floor > save.highScore) {
      save.highScore = world.floor;
      setSave(save);
      best = true;
    }
    lostScene.set(world.floor, best);
    game.activateScene("lost");
  };
  worldScene.setWorld(world);

  // Activate title scene
  game.activateScene(config.entryScene);
}

main().catch((e) => {
  console.error(`Boot error: ${e.message}`);
});
