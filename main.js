import { Game, SpriteSheet, SpriteText } from "@mousepox/jack";
import { LoadingScene } from "./scene/LoadingScene";
import { LostScene } from "./scene/LostScene";
import { TitleScene } from "./scene/TitleScene";
import { WorldScene } from "./scene/WorldScene";
import { World } from "./sim/World";
import { getSave, setSave } from "./util/save";
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
    }
    const game = new Game(BootConfig.Width, BootConfig.Height);
    const config = (await game.data.load(BootConfig.ConfigFile));
    const fontImage = await game.images.load(config.font.image);
    SpriteText.DefaultFont = {
        glyphs: config.font.glyphs,
        sheet: new SpriteSheet(fontImage, config.font.width, config.font.height),
    };
    game.addScene("loading", LoadingScene);
    game.activateScene("loading");
    game.start();
    game.sounds.volume = config.soundVolume;
    game.sounds.register(config.preload.sounds);
    await Promise.all([
        game.images.loadBatch(config.preload.images),
        game.data.loadBatch(config.preload.data),
    ]);
    game.keyboard.onFirstInteract = () => {
        game.sounds.play("menu_select", 0.000001);
    };
    const world = new World(game.data);
    const titleScene = game.addScene("title", TitleScene);
    if (save.highScore > 0) {
        titleScene.setHighScore(save.highScore);
    }
    titleScene.onOptionSelect = (option) => {
        if (option === 0) {
            restart();
        }
        else if (option === 1) {
            console.warn("TBD: Continue game");
        }
    };
    const lostScene = game.addScene("lost", LostScene);
    lostScene.onRestart = () => restart();
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
    game.activateScene(config.entryScene);
}
main().catch((e) => {
    console.error(`Boot error: ${e.message}`);
});
