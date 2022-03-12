import { Actor, Sprite, SpriteText } from "@mousepox/jack";
const Spacing = 4;
export class IconValue extends Actor {
    constructor(sheet, sprite, value) {
        super();
        this.icon = new Sprite(sheet, sprite);
        this.icon.position.set(sheet.width / 2, sheet.height / 2);
        this.addChild(this.icon);
        this.value = new SpriteText(value);
        this.value.position.x = sheet.width / 2 + Spacing;
        this.addChild(this.value);
    }
    get width() {
        return this.icon.sheet.width + Spacing + this.value.width;
    }
    set(value) {
        this.value.text = value;
    }
}
