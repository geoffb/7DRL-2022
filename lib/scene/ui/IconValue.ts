import { Actor, Sprite, SpriteSheet, SpriteText } from "@mousepox/jack";

const Spacing = 4;

export class IconValue extends Actor {
  private icon: Sprite;

  private value: SpriteText;

  public get width(): number {
    return this.icon.sheet.width + Spacing + this.value.width;
  }

  constructor(sheet: SpriteSheet, sprite: number, value: string) {
    super();

    this.icon = new Sprite(sheet, sprite);
    this.icon.position.set(sheet.width / 2, sheet.height / 2);
    this.addChild(this.icon);

    this.value = new SpriteText(value);
    this.value.position.x = sheet.width / 2 + Spacing;
    this.addChild(this.value);
  }

  public set(value: string) {
    this.value.text = value;
  }
}
