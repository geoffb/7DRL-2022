import {
  Box,
  Scene,
  Sprite,
  // SpriteGrid,
  SpriteSheet,
  SpriteText,
} from "@mousepox/jack";
// import { Grid } from "@mousepox/math";
import { IPoint } from "@mousepox/math";
import { Palette } from "./ui/Palette";

export const enum TitleOption {
  NewGame,
  Continue,
}

const OptionX = 100;

const OptionY = 64;

const OptionSize = 8;

const OptionSpacing = 8;

const Options = [
  {
    enabled: true,
    text: "New Game",
    value: TitleOption.NewGame,
  },
  // {
  //   enabled: false,
  //   text: "Continue",
  //   value: TitleOption.Continue,
  // },
];

const enum Action {
  CursorMove,
  CursorNegate,
}

export class TitleScene extends Scene {
  private cursor: Sprite;

  private high: SpriteText;

  private cursorIndex = 0;

  public onOptionSelect = (_option: TitleOption) => {
    return;
  };

  public update() {
    if (this.actionQueue.busy) {
      return;
    }

    // Handle cursor movement
    if (this.keyboard.getKeyState(38) && this.cursorIndex > 0) {
      this.actionQueue.process(Action.CursorMove, [--this.cursorIndex]);
    } else if (
      this.keyboard.getKeyState(40) &&
      this.cursorIndex < Options.length - 1
    ) {
      this.actionQueue.process(Action.CursorMove, [++this.cursorIndex]);
    }

    // Handle option select
    if (this.keyboard.getKeyState(32) || this.keyboard.getKeyState(13)) {
      const opt = Options[this.cursorIndex];
      if (opt.enabled) {
        this.sounds.play("menu_select");
        this.onOptionSelect(opt.value);
      } else {
        this.actionQueue.process(Action.CursorNegate, []);
      }
    }
  }

  public setHighScore(score: number) {
    this.high.text = `Best: ${score}`;
    this.high.position.set(2, this.height - 36);
    this.high.visible = true;
  }

  protected init() {
    const tiles = new SpriteSheet(this.images.get("images/title.png"), 16, 16);
    const icons = new SpriteSheet(
      this.images.get("images/sprites-small.png"),
      8,
      8
    );

    // Init background
    const bg = new Box(this.width, this.height, Palette.Green);
    bg.position.set(this.width / 2, this.height / 2);
    this.addChild(bg);

    //     const decoGrid = new Grid(16, 2);
    //     decoGrid.cells = [
    //       4, 4, 4, 4, 4, 4, 5, -1, -1, 5, 4, 4, 4, 4, 4, 4, 0, 1, 0, 0, 2, 0, 0, 6,
    //       6, 0, 0, 2, 0, 0, 1, 0,
    //     ];
    //
    //     const deco = new SpriteGrid(tiles, decoGrid);
    //     deco.position.set(128, this.height - 16);
    //     this.addChild(deco);

    // Game title
    const title = new SpriteText("Sewermancer", 16);
    title.position.set(this.width / 2 - title.width / 2, 16);
    this.addChild(title);

    // Create option labels
    for (let i = 0; i < Options.length; ++i) {
      const option = Options[i];
      const opt = new SpriteText(option.text, OptionSize);
      const optY = Math.floor(OptionY + (opt.size + OptionSpacing) * i);
      opt.position.set(OptionX, optY);
      opt.opacity = option.enabled ? 1 : 0.25;
      this.addChild(opt);
    }

    // Create cursor
    this.cursor = new Sprite(icons, 1);
    // BUG: this.cursorIndex is undefined here
    this.cursor.position.copy(this.getCursorPosition(0));
    this.addChild(this.cursor);

    // High score
    const high = (this.high = new SpriteText(undefined, 8));
    high.visible = false;
    this.addChild(high);

    this.actionQueue.handle(
      Action.CursorMove,
      this.animateCursorMove.bind(this)
    );
    this.actionQueue.handle(
      Action.CursorNegate,
      this.animateCursorNegate.bind(this)
    );
  }

  private getCursorPosition(index: number): IPoint {
    return {
      x: OptionX - OptionSize * 2 + 4,
      y: OptionY + (OptionSize + OptionSpacing) * index + 4,
    };
  }

  private async animateCursorMove(index: number) {
    this.sounds.play("menu_move");
    const pos = this.getCursorPosition(index);
    await this.tweens
      .create(this.cursor.position)
      .to(
        {
          x: pos.x,
          y: pos.y,
        },
        80
      )
      .promise();
  }

  private async animateCursorNegate() {
    this.sounds.play("damage1");
    const x = this.cursor.position.x;
    await this.tweens
      .create(this.cursor.position)
      .to(
        {
          x: x + 4,
        },
        25
      )
      .to(
        {
          x: x - 4,
        },
        50
      )
      .to(
        {
          x,
        },
        25
      )
      .promise();
  }
}
