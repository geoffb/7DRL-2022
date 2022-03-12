import { Box, Scene, Sprite, SpriteSheet, SpriteText, } from "@mousepox/jack";
const OptionX = 100;
const OptionY = 64;
const OptionSize = 8;
const OptionSpacing = 8;
const Options = [
    {
        enabled: true,
        text: "New Game",
        value: 0,
    },
];
export class TitleScene extends Scene {
    constructor() {
        super(...arguments);
        this.cursorIndex = 0;
        this.onOptionSelect = (_option) => {
            return;
        };
    }
    update() {
        if (this.actionQueue.busy) {
            return;
        }
        if (this.keyboard.getKeyState(38) && this.cursorIndex > 0) {
            this.actionQueue.process(0, [--this.cursorIndex]);
        }
        else if (this.keyboard.getKeyState(40) &&
            this.cursorIndex < Options.length - 1) {
            this.actionQueue.process(0, [++this.cursorIndex]);
        }
        if (this.keyboard.getKeyState(32) || this.keyboard.getKeyState(13)) {
            const opt = Options[this.cursorIndex];
            if (opt.enabled) {
                this.sounds.play("menu_select");
                this.onOptionSelect(opt.value);
            }
            else {
                this.actionQueue.process(1, []);
            }
        }
    }
    setHighScore(score) {
        this.high.text = `Best: ${score}`;
        this.high.position.set(2, this.height - 36);
        this.high.visible = true;
    }
    init() {
        const icons = new SpriteSheet(this.images.get("images/sprites-small.png"), 8, 8);
        const bg = new Box(this.width, this.height, "#346524");
        bg.position.set(this.width / 2, this.height / 2);
        this.addChild(bg);
        const title = new SpriteText("Sewermancer", 16);
        title.position.set(this.width / 2 - title.width / 2, 16);
        this.addChild(title);
        for (let i = 0; i < Options.length; ++i) {
            const option = Options[i];
            const opt = new SpriteText(option.text, OptionSize);
            const optY = Math.floor(OptionY + (opt.size + OptionSpacing) * i);
            opt.position.set(OptionX, optY);
            opt.opacity = option.enabled ? 1 : 0.25;
            this.addChild(opt);
        }
        this.cursor = new Sprite(icons, 1);
        this.cursor.position.copy(this.getCursorPosition(0));
        this.addChild(this.cursor);
        const high = (this.high = new SpriteText(undefined, 8));
        high.visible = false;
        this.addChild(high);
        this.actionQueue.handle(0, this.animateCursorMove.bind(this));
        this.actionQueue.handle(1, this.animateCursorNegate.bind(this));
    }
    getCursorPosition(index) {
        return {
            x: OptionX - OptionSize * 2 + 4,
            y: OptionY + (OptionSize + OptionSpacing) * index + 4,
        };
    }
    async animateCursorMove(index) {
        this.sounds.play("menu_move");
        const pos = this.getCursorPosition(index);
        await this.tweens
            .create(this.cursor.position)
            .to({
            x: pos.x,
            y: pos.y,
        }, 80)
            .promise();
    }
    async animateCursorNegate() {
        this.sounds.play("damage1");
        const x = this.cursor.position.x;
        await this.tweens
            .create(this.cursor.position)
            .to({
            x: x + 4,
        }, 25)
            .to({
            x: x - 4,
        }, 50)
            .to({
            x,
        }, 25)
            .promise();
    }
}
