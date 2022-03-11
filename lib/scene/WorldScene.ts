import {
  Actor,
  Box,
  Scene,
  Sprite,
  SpriteSheet,
  SpriteText,
  TileMap,
} from "@mousepox/jack";
import {
  IPoint,
  lerp,
  Vector2,
  AutoGrid,
  IAutoGridRules,
} from "@mousepox/math";
import { Ease, Tween } from "@mousepox/tween";
import { Unit, UnitRole } from "../sim/Unit";
import { Direction, World, WorldAction } from "../sim/World";
import { wait } from "../util/async";
import { IconValue } from "./ui/IconValue";
import { Palette } from "./ui/Palette";

const UIBarHeight = 8;

function mapX(x: number): number {
  return x * 16 + 8;
}

function mapY(y: number): number {
  return y * 16 + 8;
}

export class WorldScene extends Scene {
  private world: World;

  private worldView: Actor;

  private tilesets: Record<string, SpriteSheet>;

  private sprites: SpriteSheet;

  private icons: SpriteSheet;

  private autoMap: AutoGrid;

  private mapView: TileMap;

  private unitSprites: Map<number, Sprite> = new Map();

  private unitLayer: Actor;

  private healthValue: IconValue;

  private poisonValue: IconValue;

  private foodValue: IconValue;

  private keysValue: IconValue;

  private goldValue: IconValue;

  private floorValue: IconValue;

  private stepsValue: IconValue;

  private message: SpriteText;

  private messageBG: Box;

  private acceptInput = true;

  private overlay: Box;

  /** Emitted when the game has been won */
  public onWon = () => {
    return;
  };

  /** Emitted when the game has been lost */
  public onLost = () => {
    return;
  };

  public reset(): void {
    const world = this.world;

    this.tweens.cancel();
    this.actionQueue.reset();

    this.overlay.visible = false;

    this.healthValue.set(String(world.player.health));
    this.poisonValue.set("0");
    this.keysValue.set(String(this.world.inventory.get("key")));
    this.floorValue.set("0");
    this.floorValue.visible = world.floor > 0;
    this.stepsValue.set("0");
    this.stepsValue.visible = this.floorValue.visible;
    this.goldValue.set("0");

    this.autoMap.resize(world.map.width, world.map.height);
    this.autoMap.update();

    // Clear unit sprites
    this.unitSprites.forEach((sprite) => sprite.dispose());
    this.unitSprites.clear();

    world.units.forEach((unit) => this.onUnitAdd(unit));

    this.snapCamera(
      mapX(this.world.player.position.x),
      mapY(this.world.player.position.y)
    );
  }

  public setWorld(world: World) {
    this.world = world;

    // Pipe world events into the action queue
    world.onAction = (type, ...params) => {
      // HACK: For non-player actions to animate immediately
      // const immediate =
      //   type === WorldAction.UnitMove &&
      //   params[0].type !== "player" &&
      //   params[0].type !== "playerAlive";
      this.actionQueue.process(type, params, true);
    };

    const autoGridRules: IAutoGridRules = this.data.get("data/automap.json");
    this.autoMap = new AutoGrid(world.map, autoGridRules);

    this.mapView.grid = this.autoMap;
    this.mapView.position.set(
      this.mapView.width / 2,
      this.mapView.height / 2 + UIBarHeight
    );

    this.reset();
  }

  private async suppressInput(duration: number) {
    this.acceptInput = false;
    await wait(duration);
    this.acceptInput = true;
  }

  public update() {
    if (this.acceptInput) {
      if (
        this.keyboard.getKeyState(37, Infinity) ||
        this.keyboard.getKeyState(65, Infinity)
      ) {
        this.suppressInput(150);
        this.world.movePlayer(Direction.Left);
      } else if (
        this.keyboard.getKeyState(38, Infinity) ||
        this.keyboard.getKeyState(87, Infinity)
      ) {
        this.suppressInput(150);
        this.world.movePlayer(Direction.Up);
      } else if (
        this.keyboard.getKeyState(39, Infinity) ||
        this.keyboard.getKeyState(68, Infinity)
      ) {
        this.suppressInput(150);
        this.world.movePlayer(Direction.Right);
      } else if (
        this.keyboard.getKeyState(40, Infinity) ||
        this.keyboard.getKeyState(83, Infinity)
      ) {
        this.suppressInput(150);
        this.world.movePlayer(Direction.Down);
      }
    }

    this.world.update();
  }

  /** Trigger the intro animation/polish */
  public intro() {
    this.actionQueue.process(-1, []);
  }

  protected init() {
    // Setup action queue handlers
    this.actionQueue.handle(-1, this.animateIntro.bind(this));
    this.actionQueue.handle(WorldAction.Won, this.animateWon.bind(this));
    this.actionQueue.handle(WorldAction.Lost, this.animateLost.bind(this));
    this.actionQueue.handle(
      WorldAction.StepAwait,
      this.animateStepAwait.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.MapChange,
      this.animateMapChange.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitMove,
      this.animateUnitMove.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitNegate,
      this.animateUnitNegate.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitSpawn,
      this.animateUnitSpawn.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitHealthChange,
      this.animateUnitHealthChange.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitKnockback,
      this.animateUnitKnockback.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitRemove,
      this.animateUnitRemove.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitPickup,
      this.animateUnitPickup.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitOpen,
      this.animateUnitOpen.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitDie,
      this.animateUnitDie.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.UnitAttack,
      this.animateUnitAttack.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.PlayerInventoryChange,
      this.animatePlayerInventoryChange.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.PlayerStarve,
      this.animatePlayerStarve.bind(this)
    );
    this.actionQueue.handle(
      WorldAction.PlayerHumanityRestore,
      this.animatePlayerHumanityRestore.bind(this)
    );

    this.tilesets = {
      library: new SpriteSheet(this.images.get("images/library.png"), 16, 16),
      sewer: new SpriteSheet(this.images.get("images/sewer.png"), 16, 16),
    };

    this.sprites = new SpriteSheet(
      this.images.get("images/sprites.png"),
      16,
      16
    );
    this.icons = new SpriteSheet(
      this.images.get("images/sprites-small.png"),
      8,
      8
    );

    this.worldView = new Actor();
    this.addChild(this.worldView);

    // this.mapView = new SpriteGrid(this.tileset);
    this.mapView = new TileMap(
      this.width,
      this.height - UIBarHeight,
      this.tilesets.library
    );
    this.worldView.addChild(this.mapView);

    // Init unit layer
    this.unitLayer = new Actor();
    this.unitLayer.position.y = UIBarHeight;
    this.worldView.addChild(this.unitLayer);

    // UI bars
    const topBar = new Box(this.width, UIBarHeight, Palette.Black);
    topBar.position.set(this.width / 2, UIBarHeight / 2);
    this.addChild(topBar);

    // Init UI
    this.healthValue = new IconValue(this.icons, 0, "0");
    this.healthValue.position.set(0, 0);
    this.addChild(this.healthValue);

    this.poisonValue = new IconValue(this.icons, 6, "");
    this.poisonValue.position.set(32, 0);
    this.addChild(this.poisonValue);

    this.keysValue = new IconValue(this.icons, 3, "0");
    this.keysValue.position.set(64, 0);
    this.addChild(this.keysValue);

    this.goldValue = new IconValue(this.icons, 4, "0");
    this.goldValue.position.set(96, 0);
    this.addChild(this.goldValue);

    this.floorValue = new IconValue(this.icons, 5, "0");
    this.floorValue.position.set(176, 0);
    this.addChild(this.floorValue);

    this.stepsValue = new IconValue(this.icons, 8, "0");
    this.stepsValue.position.set(208, 0);
    this.addChild(this.stepsValue);

    this.messageBG = new Box(this.width, UIBarHeight, "#D27D2C");
    this.messageBG.visible = false;
    this.addChild(this.messageBG);

    this.message = new SpriteText(undefined);
    this.message.visible = false;
    this.addChild(this.message);

    this.overlay = new Box(this.width, this.height, Palette.Black);
    this.overlay.position.set(this.width / 2, this.height / 2);
    this.overlay.visible = false;
    this.addChild(this.overlay);
  }

  private getUnitSprite(id: number): Sprite {
    const sprite = this.unitSprites.get(id);
    if (sprite !== undefined) {
      return sprite;
    } else {
      throw new Error(`No sprite for unit: ${id}`);
    }
  }

  private removeUnitSprite(id: number) {
    const sprite = this.unitSprites.get(id);
    if (sprite !== undefined) {
      sprite.dispose();
      this.unitSprites.delete(id);
    }
  }

  private snapCamera(x: number, y: number) {
    this.mapView.offsetX = x - this.mapView.width / 2;
    this.mapView.offsetY = y - this.mapView.height / 2;
    this.unitLayer.position.set(
      -this.mapView.offsetX,
      -this.mapView.offsetY + UIBarHeight
    );
  }

  private panCamera(x: number, y: number, duration: number) {
    const px = this.mapView.offsetX;
    const py = this.mapView.offsetY;

    this.mapView.offsetX = x - this.mapView.width / 2;
    this.mapView.offsetY = y - this.mapView.height / 2;

    const tx = this.mapView.offsetX;
    const ty = this.mapView.offsetY;

    this.mapView.offsetX = px;
    this.mapView.offsetY = py;

    this.tweens.create(this.mapView).to(
      {
        offsetX: tx,
        offsetY: ty,
      },
      duration,
      Ease.QuadInOut
    );
    this.tweens.create(this.unitLayer.position).to(
      {
        x: -tx,
        y: -ty + UIBarHeight,
      },
      duration,
      Ease.QuadInOut
    );
  }

  private async animateUnitSpawn(unit: Unit): Promise<void> {
    this.onUnitAdd(unit);
    const sprite = this.getUnitSprite(unit.id);
    sprite.scale.set(0, 0);
    await this.tweens
      .create(sprite.scale)
      .to(
        {
          x: 1.2,
          y: 1.2,
        },
        150
      )
      .to(
        {
          x: 1,
          y: 1,
        },
        100
      )
      .call(() => {
        if (unit.type === "player" || unit.type === "playerAlive") {
          this.animateUnitHealthChange(unit.id, 0, unit.health);
          this.animatePlayerInventoryChange(
            "food",
            0,
            this.world.inventory.get("food")
          );
        }
      })
      .promise();
  }

  private async animateUnitMove(unit: Unit, target: Vector2): Promise<void> {
    const duration = 150;

    if (unit.info.role === UnitRole.Player) {
      this.panCamera(mapX(target.x), mapY(target.y), duration);
      this.sounds.play(
        this.world.steps % 2 === 0 ? "footsteps1b" : "footsteps1a"
      );
    }

    // Calculate positions
    const sprite = this.getUnitSprite(unit.id);
    const spriteX = Math.floor(sprite.position.x / 16);
    const offsetX = target.x - spriteX;

    // Prepare the tween
    const tween = new Tween(sprite.position);

    // Execute tween based on axis
    if (offsetX === 0) {
      // Vertical
      const targetX = mapX(target.x);
      const targetY = mapY(target.y) - 4;
      tween.to(
        {
          x: targetX,
          y: targetY,
        },
        duration,
        Ease.QuadInOut
      );
    } else {
      // Horizontal
      const halfX = lerp(sprite.position.x, mapX(target.x), 0.5);
      const halfY = mapY(target.y) - 8;
      const targetX = mapX(target.x);
      const targetY = mapY(target.y) - 4;
      tween
        .to(
          {
            x: halfX,
            y: halfY,
          },
          duration / 2,
          Ease.QuadIn
        )
        .to(
          {
            x: targetX,
            y: targetY,
          },
          duration / 2,
          Ease.QuadOut
        );
    }

    this.tweens.add(tween);
    await tween.promise();
  }

  private async animateUnitNegate(unit: Unit, target: Vector2): Promise<void> {
    // Calculate the direction offset
    const distance = 4;
    const offset = {
      x: unit.position.x - target.x,
      y: unit.position.y - target.y,
    };

    // Animate the unit to look like it's nudging up against the target
    const sprite = this.getUnitSprite(unit.id);
    await this.tweens
      .create(sprite.position)
      .to(
        {
          x: sprite.position.x - offset.x * distance,
          y: sprite.position.y - offset.y * distance,
        },
        50
      )
      .to(
        {
          x: sprite.position.x,
          y: sprite.position.y,
        },
        50
      )
      .wait(150)
      .promise();
  }

  private async animateUnitAttack(
    id: number,
    position: Vector2,
    target: Vector2
  ): Promise<void> {
    // Calculate the direction offset
    const distance = 8;
    const offset = {
      x: position.x - target.x,
      y: position.y - target.y,
    };

    // Animate the unit to look like it's nudging up agaisnt the target
    this.sounds.play("punch1");
    const sprite = this.getUnitSprite(id);
    const tw = this.tweens.create(sprite.position).to(
      {
        x: sprite.position.x - offset.x * distance,
        y: sprite.position.y - offset.y * distance,
      },
      60,
      Ease.QuadOut
    );

    this.tweens.create(sprite.position).wait(60).to(
      {
        x: sprite.position.x,
        y: sprite.position.y,
      },
      80,
      Ease.QuadIn
    );

    return tw.promise();
  }

  private async animateUnitPickup(id: number): Promise<void> {
    this.sounds.play("pickup1");
    const sprite = this.getUnitSprite(id);
    await this.tweens
      .create(sprite.position)
      .to(
        {
          y: sprite.position.y - 16,
        },
        100
      )
      .wait(200)
      .call(() => this.removeUnitSprite(id))
      .promise();
  }

  private async animateUnitRemove(id: number): Promise<void> {
    this.removeUnitSprite(id);
  }

  private async animateUnitOpen(id: number): Promise<void> {
    const sprite = this.getUnitSprite(id);
    this.sounds.play("open1");
    await this.tweens
      .create(sprite.position)
      .to(
        {
          x: sprite.position.x - 2,
        },
        75
      )
      .to(
        {
          x: sprite.position.x + 2,
        },
        75
      )
      .to(
        {
          x: sprite.position.x,
        },
        75
      )
      .call(() => this.removeUnitSprite(id))
      .promise();
  }

  private async animateUnitHealthChange(
    id: number,
    amount: number,
    health: number,
    source?: string
  ): Promise<void> {
    // TODO: Polish unit health change
    if (amount !== 0) {
      if (amount < 0) {
        this.sounds.play("damage2");
      }

      const sprite = this.getUnitSprite(id);
      this.tweens
        .create(sprite.scale)
        .to(
          {
            x: 1.3,
            y: 1.3,
          },
          75
        )
        .to(
          {
            x: 1,
            y: 1,
          },
          75
        );

      if (id === this.world.player.id && amount < 0) {
        const color = source === "poison" ? Palette.Green : Palette.Red;
        this.showOverlay(75, color);
        this.hideOverlay(75, 75);
        this.shake(this.worldView, 150, 4, 1);
      }
    }

    if (id === this.world.player.id) {
      this.healthValue.set(String(health));
    }
  }

  private async animateUnitDie(id: number, type: string): Promise<void> {
    const info = this.world.getUnitInfo(type);
    const sprite = this.getUnitSprite(id);
    const tw = this.tweens.create(sprite);
    tw.wait(175);
    if (info.role === UnitRole.Monster || info.role === UnitRole.Player) {
      // Fall over
      tw.to(
        {
          rotation: Math.PI / 2,
        },
        250
      );
    }
    tw.to(
      {
        opacity: 0,
      },
      150
    );
    tw.call(() => this.removeUnitSprite(id));
    return tw.promise();
  }

  private async animateUnitKnockback(
    id: number,
    target: IPoint
  ): Promise<void> {
    const sprite = this.getUnitSprite(id);
    await this.tweens
      .create(sprite.position)
      .to(
        {
          x: mapX(target.x),
          y: mapY(target.y),
        },
        100,
        Ease.QuadOut
      )
      .promise();
  }

  private async animateMapChange(dir: string): Promise<void> {
    const overlayDuration = 200;

    this.sounds.play("stairs1");
    await this.showOverlay(overlayDuration, Palette.Black);
    await wait(overlayDuration);

    this.resetMessage();

    // Clear unit sprites
    this.unitSprites.forEach((sprite) => sprite.dispose());
    this.unitSprites.clear();

    // Trigger map change in the sim
    const floor = this.world.floor + (dir === "down" ? 1 : -1);
    this.world.loadMap(floor);

    this.mapView.sheet = this.tilesets[this.world.environment];

    this.floorValue.set(String(floor));
    this.floorValue.visible = floor > 0;

    this.stepsValue.set(String(this.world.steps));
    this.stepsValue.visible = this.floorValue.visible;

    this.autoMap.resize(this.world.map.width, this.world.map.height);
    this.autoMap.update();

    // Create unit sprites for new room
    this.world.units.forEach((unit) => this.onUnitAdd(unit));

    this.snapCamera(
      mapX(this.world.player.position.x),
      mapY(this.world.player.position.y)
    );

    await this.hideOverlay(overlayDuration);

    switch (this.world.affix) {
      case "combust":
        this.showMessage("Warm air crackles around you...");
        break;
      case "vengeful":
        this.showMessage("A chill runs down your spine...");
        break;
    }
  }

  private async animateWon(): Promise<void> {
    // TODO: Do something FANCY
    await this.tweens
      .create(this)
      .wait(250)
      .call(() => this.onWon())
      .promise();
  }

  private async animateLost(): Promise<void> {
    this.sounds.play("negative1");
    await this.showOverlay(1500, Palette.Red);
    await this.tweens
      .create(this)
      .wait(500)
      .call(() => this.onLost())
      .promise();
  }

  private async animateStepAwait(): Promise<void> {
    // Trigger a world step
    this.world.step();
    this.stepsValue.set(String(this.world.steps));
  }

  private async animatePlayerInventoryChange(
    type: string,
    _amount: number,
    count: number
  ) {
    switch (type) {
      case "poison":
        this.poisonValue.set(String(count));
        break;
      case "food":
        if (this.world.player.type === "playerAlive") {
          this.foodValue.set(String(count));
        } else {
          this.foodValue.set("-");
        }
        break;
      case "key":
        this.keysValue.set(String(count));
        break;
      case "gold":
        this.goldValue.set(String(count));
        break;
    }
  }

  private async animatePlayerStarve() {
    if (this.world.player.type === "player") {
      this.showMessage("You starved to death!");
    } else {
      this.showMessage("You are starving, find food!");
    }
  }

  private async animatePlayerHumanityRestore() {
    this.showMessage("Humanity restored!", "powerup10");
  }

  private async animateIntro() {
    const duration = 800;

    const sprite = this.getUnitSprite(this.world.player.id);
    sprite.opacity = 0;
    sprite.position.y += 8;
    sprite.scale.y = 0;

    await this.tweens
      .create(sprite)
      .wait(500)
      .call(() => {
        this.showMessage("RISE!");
        this.shake(this.worldView, 1000, 10, 1);
      })
      .wait(650)
      .call(() => this.sounds.play("portal6"))
      .wait(350)
      .promise();

    this.tweens.create(sprite).to(
      {
        opacity: 1,
      },
      duration,
      Ease.QuadInOut
    );

    this.tweens.create(sprite.position).to(
      {
        y: sprite.position.y - 8,
      },
      duration,
      Ease.QuadInOut
    );

    this.tweens.create(sprite.scale).to(
      {
        y: 1,
      },
      duration,
      Ease.QuadInOut
    );

    await this.shake(sprite, duration, 5, 1).promise();
  }

  private onUnitAdd(unit: Unit) {
    if (this.unitSprites.has(unit.id)) {
      console.warn(`Unit sprite ${unit.id} exists`);
      return;
    }
    const sprite = new Sprite(this.sprites, unit.info.sprite);
    if (unit.forSale) {
      const cost = new IconValue(
        this.icons,
        4,
        String(unit.info.data?.cost ?? 0)
      );
      cost.position.set(-cost.width / 2, -16);
      sprite.addChild(cost);
    }
    const offset = unit.info.flat ? 0 : 4;
    sprite.position.set(mapX(unit.position.x), mapY(unit.position.y) - offset);
    sprite.drawOrder = unit.info.drawOrder;
    this.unitSprites.set(unit.id, sprite);
    this.unitLayer.addChild(sprite);
  }

  private showMessage(text: string, sound?: string) {
    // Position message relative to player
    let y = this.height - 16;
    const playerSprite = this.unitSprites.get(this.world.player.id);
    if (
      playerSprite !== undefined &&
      playerSprite.position.y + this.unitLayer.position.y > this.height * 0.75
    ) {
      y = 32;
    }

    // Animate message background
    this.messageBG.position.set(this.width / 2, y);
    this.messageBG.opacity = 0;
    this.messageBG.visible = true;
    this.tweens
      .create(this.messageBG)
      .to(
        {
          opacity: 1,
        },
        250
      )
      .wait(2500)
      .to(
        {
          opacity: 0,
        },
        250
      )
      .call(() => (this.messageBG.visible = false));

    // Animate message text
    this.message.text = text;
    this.message.position.set(
      this.width / 2 - this.message.width / 2,
      y - this.message.size / 2
    );
    this.message.opacity = 0;
    this.message.visible = true;
    this.tweens
      .create(this.message)
      .to(
        {
          opacity: 1,
        },
        250
      )
      .wait(2500)
      .to(
        {
          opacity: 0,
        },
        250
      )
      .call(() => (this.message.visible = false));

    // Play associated sound effect
    this.sounds.play(sound ?? "interaction13");
  }

  private resetMessage() {
    this.tweens.cancel(this.messageBG);
    this.tweens.cancel(this.message);
    this.messageBG.visible = false;
    this.message.visible = false;
  }

  private async showOverlay(duration: number, fillStyle: string) {
    this.overlay.fillStyle = fillStyle;
    this.overlay.opacity = 0;
    this.overlay.visible = true;
    await this.tweens
      .create(this.overlay)
      .to(
        {
          opacity: 1,
        },
        duration,
        Ease.QuadIn
      )
      .promise();
  }

  private async hideOverlay(duration: number, delay = 0) {
    await this.tweens
      .create(this.overlay)
      .wait(delay)
      .to(
        {
          opacity: 0,
        },
        duration,
        Ease.QuadOut
      )
      .call(() => (this.overlay.visible = false))
      .promise();
  }

  private shake(
    actor: Actor,
    duration: number,
    iterations: number,
    amount: number
  ) {
    const tw = this.tweens.create(actor.position);
    const d = (duration * 2) / iterations / 4;
    const x = actor.position.x;
    tw.to(
      {
        x: x - amount,
      },
      d,
      Ease.QuadOut
    )
      .to(
        {
          x: x + amount,
        },
        d * 2,
        Ease.QuadInOut
      )
      .to(
        {
          x,
        },
        d,
        Ease.QuadIn
      )
      .loop(iterations - 1);
    this.tweens.add(tw);
    return tw;
  }
}
