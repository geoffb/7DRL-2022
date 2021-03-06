import { Box, Scene, SpriteText } from "@mousepox/jack";
import { Palette } from "./ui/Palette";

export class LoadingScene extends Scene {
  private bg: Box;

  private label: SpriteText;

  public update() {
    return;
  }

  protected init() {
    // Init background
    this.bg = new Box(this.width, this.height, Palette.Black);
    this.bg.position.set(this.width / 2, this.height / 2);
    this.addChild(this.bg);

    // Init label
    this.label = new SpriteText("Loading...");
    this.label.position.set(2, this.height - 10);
    this.addChild(this.label);
  }
}
