import { Box, Scene, SpriteText } from "@mousepox/jack";
export class LostScene extends Scene {
    constructor() {
        super(...arguments);
        this.onRestart = () => {
            return;
        };
    }
    update() {
        if (this.keyboard.getKeyState(32)) {
            this.onRestart();
        }
    }
    set(floors, best) {
        this.score.text = String(floors);
        this.score.position.x = this.width / 2 - this.score.width / 2;
        this.best.visible = best;
    }
    init() {
        const bg = new Box(this.width, this.height, "#442434");
        bg.position.set(this.width / 2, this.height / 2);
        this.addChild(bg);
        const title = new SpriteText("You died!", 16);
        title.position.set(this.width / 2 - title.width / 2, 8);
        this.addChild(title);
        const floors = new SpriteText("Lowest Floor", 8);
        floors.position.set(this.width / 2 - floors.width / 2, 40);
        this.addChild(floors);
        const score = (this.score = new SpriteText("N", 24));
        score.position.set(this.width / 2 - score.width / 2, 56);
        this.addChild(score);
        const best = (this.best = new SpriteText("New High Score!", 8));
        best.position.set(this.width / 2 - best.width / 2, 88);
        this.addChild(best);
        const restart = new SpriteText("Press SPACE to restart", 8);
        restart.position.set(this.width / 2 - restart.width / 2, 120);
        this.addChild(restart);
    }
}
