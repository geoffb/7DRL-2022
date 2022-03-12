import { Box, Scene, SpriteText } from "@mousepox/jack";
export class LoadingScene extends Scene {
    update() {
        return;
    }
    init() {
        this.bg = new Box(this.width, this.height, "#140C1C");
        this.bg.position.set(this.width / 2, this.height / 2);
        this.addChild(this.bg);
        this.label = new SpriteText("Loading...");
        this.label.position.set(2, this.height - 10);
        this.addChild(this.label);
    }
}
