import { Actor, Box, Scene, Sprite, SpriteSheet, SpriteText, TileMap, } from "@mousepox/jack";
import { lerp, AutoGrid, } from "@mousepox/math";
import { Ease, Tween } from "@mousepox/tween";
import { wait } from "../util/async";
import { IconValue } from "./ui/IconValue";
const UIBarHeight = 8;
function mapX(x) {
    return x * 16 + 8;
}
function mapY(y) {
    return y * 16 + 8;
}
export class WorldScene extends Scene {
    constructor() {
        super(...arguments);
        this.unitSprites = new Map();
        this.acceptInput = true;
        this.onWon = () => {
            return;
        };
        this.onLost = () => {
            return;
        };
    }
    reset() {
        const world = this.world;
        this.tweens.cancel();
        this.actionQueue.reset();
        this.overlay.visible = false;
        this.healthValue.set(String(world.player.health));
        this.poisonValue.set("0");
        this.keysValue.set(String(this.world.inventory.get("key")));
        this.magicValue.set(String(this.world.inventory.get("magic")));
        this.floorValue.set("0");
        this.floorValue.visible = world.floor > 0;
        this.stepsValue.set("0");
        this.stepsValue.visible = this.floorValue.visible;
        this.goldValue.set("0");
        if (this.world.environment !== "") {
            this.mapView.sheet = this.tilesets[this.world.environment];
        }
        this.autoMap.resize(world.map.width, world.map.height);
        this.autoMap.update();
        this.unitSprites.forEach((sprite) => sprite.dispose());
        this.unitSprites.clear();
        world.units.forEach((unit) => this.onUnitAdd(unit));
        this.snapCamera(mapX(this.world.player.position.x), mapY(this.world.player.position.y));
    }
    setWorld(world) {
        this.world = world;
        world.onAction = (type, ...params) => {
            this.actionQueue.process(type, params, true);
        };
        const autoGridRules = this.data.get("data/automap.json");
        this.autoMap = new AutoGrid(world.map, autoGridRules);
        this.mapView.grid = this.autoMap;
        this.mapView.position.set(this.mapView.width / 2, this.mapView.height / 2 + UIBarHeight);
        this.reset();
    }
    async suppressInput(duration) {
        this.acceptInput = false;
        await wait(duration);
        this.acceptInput = true;
    }
    update() {
        if (this.acceptInput) {
            if (this.keyboard.getKeyState(37, Infinity) ||
                this.keyboard.getKeyState(65, Infinity)) {
                this.suppressInput(150);
                this.world.movePlayer(3);
            }
            else if (this.keyboard.getKeyState(38, Infinity) ||
                this.keyboard.getKeyState(87, Infinity)) {
                this.suppressInput(150);
                this.world.movePlayer(0);
            }
            else if (this.keyboard.getKeyState(39, Infinity) ||
                this.keyboard.getKeyState(68, Infinity)) {
                this.suppressInput(150);
                this.world.movePlayer(1);
            }
            else if (this.keyboard.getKeyState(40, Infinity) ||
                this.keyboard.getKeyState(83, Infinity)) {
                this.suppressInput(150);
                this.world.movePlayer(2);
            }
            else if (this.keyboard.getKeyState(32)) {
                this.suppressInput(150);
                this.world.activatePlayerSkill();
            }
        }
        this.world.update();
    }
    intro() {
        this.actionQueue.process(-1, []);
    }
    init() {
        this.actionQueue.handle(-1, this.animateIntro.bind(this));
        this.actionQueue.handle(13, this.animateWon.bind(this));
        this.actionQueue.handle(14, this.animateLost.bind(this));
        this.actionQueue.handle(0, this.animateStepAwait.bind(this));
        this.actionQueue.handle(12, this.animateMapChange.bind(this));
        this.actionQueue.handle(1, this.animateUnitMove.bind(this));
        this.actionQueue.handle(2, this.animateUnitNegate.bind(this));
        this.actionQueue.handle(3, this.animateUnitSpawn.bind(this));
        this.actionQueue.handle(4, this.animateUnitHealthChange.bind(this));
        this.actionQueue.handle(6, this.animateUnitKnockback.bind(this));
        this.actionQueue.handle(8, this.animateUnitRemove.bind(this));
        this.actionQueue.handle(7, this.animateUnitPickup.bind(this));
        this.actionQueue.handle(9, this.animateUnitOpen.bind(this));
        this.actionQueue.handle(10, this.animateUnitDie.bind(this));
        this.actionQueue.handle(5, this.animateUnitAttack.bind(this));
        this.actionQueue.handle(15, this.animatePlayerInventoryChange.bind(this));
        this.actionQueue.handle(16, this.animatePlayerStarve.bind(this));
        this.actionQueue.handle(17, this.animatePlayerHumanityRestore.bind(this));
        this.actionQueue.handle(18, this.animateCombust.bind(this));
        this.tilesets = {
            library: new SpriteSheet(this.images.get("images/library.png"), 16, 16),
            sewer: new SpriteSheet(this.images.get("images/sewer.png"), 16, 16),
        };
        this.sprites = new SpriteSheet(this.images.get("images/sprites.png"), 16, 16);
        this.icons = new SpriteSheet(this.images.get("images/sprites-small.png"), 8, 8);
        this.worldView = new Actor();
        this.addChild(this.worldView);
        this.mapView = new TileMap(this.width, this.height - UIBarHeight, this.tilesets.library);
        this.worldView.addChild(this.mapView);
        this.unitLayer = new Actor();
        this.unitLayer.position.y = UIBarHeight;
        this.worldView.addChild(this.unitLayer);
        const topBar = new Box(this.width, UIBarHeight, "#140C1C");
        topBar.position.set(this.width / 2, UIBarHeight / 2);
        this.addChild(topBar);
        this.healthValue = new IconValue(this.icons, 0, "0");
        this.healthValue.position.set(0, 0);
        this.addChild(this.healthValue);
        this.poisonValue = new IconValue(this.icons, 6, "0");
        this.poisonValue.position.set(32, 0);
        this.addChild(this.poisonValue);
        this.magicValue = new IconValue(this.icons, 7, "0");
        this.magicValue.position.set(64, 0);
        this.addChild(this.magicValue);
        this.keysValue = new IconValue(this.icons, 3, "0");
        this.keysValue.position.set(96, 0);
        this.addChild(this.keysValue);
        this.goldValue = new IconValue(this.icons, 4, "0");
        this.goldValue.position.set(128, 0);
        this.addChild(this.goldValue);
        this.floorValue = new IconValue(this.icons, 5, "0");
        this.floorValue.position.set(176, 0);
        this.addChild(this.floorValue);
        this.stepsValue = new IconValue(this.icons, 8, "0");
        this.stepsValue.position.set(208, 0);
        this.addChild(this.stepsValue);
        this.messageBG = new Box(this.width, UIBarHeight, "#D04648");
        this.messageBG.visible = false;
        this.addChild(this.messageBG);
        this.message = new SpriteText(undefined);
        this.message.visible = false;
        this.addChild(this.message);
        this.overlay = new Box(this.width, this.height, "#140C1C");
        this.overlay.position.set(this.width / 2, this.height / 2);
        this.overlay.visible = false;
        this.addChild(this.overlay);
    }
    getUnitSprite(id) {
        const sprite = this.unitSprites.get(id);
        if (sprite !== undefined) {
            return sprite;
        }
        else {
            throw new Error(`No sprite for unit: ${id}`);
        }
    }
    removeUnitSprite(id) {
        const sprite = this.unitSprites.get(id);
        if (sprite !== undefined) {
            sprite.dispose();
            this.unitSprites.delete(id);
        }
    }
    snapCamera(x, y) {
        this.mapView.offsetX = x - this.mapView.width / 2;
        this.mapView.offsetY = y - this.mapView.height / 2;
        this.unitLayer.position.set(-this.mapView.offsetX, -this.mapView.offsetY + UIBarHeight);
    }
    panCamera(x, y, duration) {
        const px = this.mapView.offsetX;
        const py = this.mapView.offsetY;
        this.mapView.offsetX = x - this.mapView.width / 2;
        this.mapView.offsetY = y - this.mapView.height / 2;
        const tx = this.mapView.offsetX;
        const ty = this.mapView.offsetY;
        this.mapView.offsetX = px;
        this.mapView.offsetY = py;
        this.tweens.create(this.mapView).to({
            offsetX: tx,
            offsetY: ty,
        }, duration, Ease.QuadInOut);
        this.tweens.create(this.unitLayer.position).to({
            x: -tx,
            y: -ty + UIBarHeight,
        }, duration, Ease.QuadInOut);
    }
    async animateUnitSpawn(unit) {
        this.onUnitAdd(unit);
        const sprite = this.getUnitSprite(unit.id);
        sprite.scale.set(0, 0);
        await this.tweens
            .create(sprite.scale)
            .to({
            x: 1.2,
            y: 1.2,
        }, 150)
            .to({
            x: 1,
            y: 1,
        }, 100)
            .call(() => {
            if (unit.type === "player" || unit.type === "playerAlive") {
                this.animateUnitHealthChange(unit.id, 0, unit.health);
                this.animatePlayerInventoryChange("food", 0, this.world.inventory.get("food"));
            }
        })
            .promise();
    }
    async animateUnitMove(unit, target) {
        const duration = 150;
        if (unit.info.role === "player") {
            this.panCamera(mapX(target.x), mapY(target.y), duration);
            this.sounds.play(this.world.steps % 2 === 0 ? "footsteps1b" : "footsteps1a");
        }
        const sprite = this.getUnitSprite(unit.id);
        const spriteX = Math.floor(sprite.position.x / 16);
        const offsetX = target.x - spriteX;
        const tween = new Tween(sprite.position);
        if (offsetX === 0) {
            const targetX = mapX(target.x);
            const targetY = mapY(target.y) - 4;
            tween.to({
                x: targetX,
                y: targetY,
            }, duration, Ease.QuadInOut);
        }
        else {
            const halfX = lerp(sprite.position.x, mapX(target.x), 0.5);
            const halfY = mapY(target.y) - 8;
            const targetX = mapX(target.x);
            const targetY = mapY(target.y) - 4;
            tween
                .to({
                x: halfX,
                y: halfY,
            }, duration / 2, Ease.QuadIn)
                .to({
                x: targetX,
                y: targetY,
            }, duration / 2, Ease.QuadOut);
        }
        this.tweens.add(tween);
        await tween.promise();
    }
    async animateUnitNegate(unit, target) {
        const distance = 4;
        const offset = {
            x: unit.position.x - target.x,
            y: unit.position.y - target.y,
        };
        const sprite = this.getUnitSprite(unit.id);
        await this.tweens
            .create(sprite.position)
            .to({
            x: sprite.position.x - offset.x * distance,
            y: sprite.position.y - offset.y * distance,
        }, 50)
            .to({
            x: sprite.position.x,
            y: sprite.position.y,
        }, 50)
            .wait(150)
            .promise();
    }
    async animateUnitAttack(id, position, target) {
        const distance = 8;
        const offset = {
            x: position.x - target.x,
            y: position.y - target.y,
        };
        this.sounds.play("punch1");
        const sprite = this.getUnitSprite(id);
        const tw = this.tweens.create(sprite.position).to({
            x: sprite.position.x - offset.x * distance,
            y: sprite.position.y - offset.y * distance,
        }, 60, Ease.QuadOut);
        this.tweens.create(sprite.position).wait(60).to({
            x: sprite.position.x,
            y: sprite.position.y,
        }, 80, Ease.QuadIn);
        return tw.promise();
    }
    async animateUnitPickup(id) {
        this.sounds.play("pickup1");
        const sprite = this.getUnitSprite(id);
        await this.tweens
            .create(sprite.position)
            .to({
            y: sprite.position.y - 16,
        }, 100)
            .wait(200)
            .call(() => this.removeUnitSprite(id))
            .promise();
    }
    async animateUnitRemove(id) {
        this.removeUnitSprite(id);
    }
    async animateUnitOpen(id) {
        const sprite = this.getUnitSprite(id);
        this.sounds.play("open1");
        await this.tweens
            .create(sprite.position)
            .to({
            x: sprite.position.x - 2,
        }, 75)
            .to({
            x: sprite.position.x + 2,
        }, 75)
            .to({
            x: sprite.position.x,
        }, 75)
            .call(() => this.removeUnitSprite(id))
            .promise();
    }
    async animateUnitHealthChange(id, amount, health, source) {
        if (amount !== 0) {
            if (amount < 0) {
                this.sounds.play("damage2");
            }
            const sprite = this.getUnitSprite(id);
            this.tweens
                .create(sprite.scale)
                .to({
                x: 1.3,
                y: 1.3,
            }, 75)
                .to({
                x: 1,
                y: 1,
            }, 75);
            if (id === this.world.player.id && amount < 0) {
                const color = source === "poison" ? "#6DAA2C" : "#D04648";
                this.showOverlay(75, color);
                this.hideOverlay(75, 75);
                this.shake(this.worldView, 150, 4, 1);
                if (source === "poison") {
                    this.showMessage("You are poisoned!");
                }
            }
        }
        if (id === this.world.player.id) {
            this.healthValue.set(String(health));
        }
    }
    async animateUnitDie(id) {
        const sprite = this.getUnitSprite(id);
        const tw = this.tweens.create(sprite);
        tw.wait(175);
        tw.to({
            opacity: 0,
        }, 150);
        tw.call(() => this.removeUnitSprite(id));
        return tw.promise();
    }
    async animateUnitKnockback(id, target) {
        const sprite = this.getUnitSprite(id);
        await this.tweens
            .create(sprite.position)
            .to({
            x: mapX(target.x),
            y: mapY(target.y),
        }, 100, Ease.QuadOut)
            .promise();
    }
    async animateMapChange(dir) {
        const overlayDuration = 200;
        this.sounds.play("stairs1");
        await this.showOverlay(overlayDuration, "#140C1C");
        await wait(overlayDuration);
        this.resetMessage();
        this.unitSprites.forEach((sprite) => sprite.dispose());
        this.unitSprites.clear();
        const floor = this.world.floor + (dir === "down" ? 1 : -1);
        this.world.loadMap(floor);
        this.mapView.sheet = this.tilesets[this.world.environment];
        this.floorValue.set(String(floor));
        this.floorValue.visible = floor > 0;
        this.stepsValue.set(String(this.world.steps));
        this.stepsValue.visible = this.floorValue.visible;
        this.autoMap.resize(this.world.map.width, this.world.map.height);
        this.autoMap.update();
        this.world.units.forEach((unit) => this.onUnitAdd(unit));
        this.snapCamera(mapX(this.world.player.position.x), mapY(this.world.player.position.y));
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
    async animateWon() {
        await this.tweens
            .create(this)
            .wait(250)
            .call(() => this.onWon())
            .promise();
    }
    async animateLost() {
        this.sounds.play("negative1");
        await this.showOverlay(1500, "#D04648");
        await this.tweens
            .create(this)
            .wait(500)
            .call(() => this.onLost())
            .promise();
    }
    async animateStepAwait() {
        this.world.step();
        this.stepsValue.set(String(this.world.steps));
    }
    async animatePlayerInventoryChange(type, _amount, count) {
        switch (type) {
            case "poison":
                this.poisonValue.set(String(count));
                break;
            case "magic":
                this.magicValue.set(String(count));
                break;
            case "key":
                this.keysValue.set(String(count));
                break;
            case "gold":
                this.goldValue.set(String(count));
                break;
        }
    }
    async animatePlayerStarve() {
        if (this.world.player.type === "player") {
            this.showMessage("You starved to death!");
        }
        else {
            this.showMessage("You are starving, find food!");
        }
    }
    async animatePlayerHumanityRestore() {
        this.showMessage("Humanity restored!", "powerup10");
    }
    async animateCombust(positions) {
        for (const pos of positions) {
            this.spawnEffect(pos.x, pos.y, 17);
        }
        this.shake(this.worldView, 150, 4, 1);
    }
    spawnEffect(x, y, sprite) {
        const effect = new Sprite(this.sprites, sprite);
        effect.position.x = mapX(x);
        effect.position.y = mapY(y);
        this.unitLayer.addChild(effect);
        this.tweens
            .create(effect)
            .to({
            opacity: 0,
            rotation: Math.PI,
        }, 150)
            .call(() => effect.dispose());
        this.tweens.create(effect.scale).to({
            x: 2,
            y: 2,
        }, 150);
    }
    async animateIntro() {
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
        this.tweens.create(sprite).to({
            opacity: 1,
        }, duration, Ease.QuadInOut);
        this.tweens.create(sprite.position).to({
            y: sprite.position.y - 8,
        }, duration, Ease.QuadInOut);
        this.tweens.create(sprite.scale).to({
            y: 1,
        }, duration, Ease.QuadInOut);
        await this.shake(sprite, duration, 5, 1).promise();
    }
    onUnitAdd(unit) {
        var _a, _b;
        if (this.unitSprites.has(unit.id)) {
            console.warn(`Unit sprite ${unit.id} exists`);
            return;
        }
        const sprite = new Sprite(this.sprites, unit.info.sprite);
        if (unit.forSale) {
            const cost = new IconValue(this.icons, 4, String((_b = (_a = unit.info.data) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0));
            cost.position.set(-cost.width / 2, -16);
            sprite.addChild(cost);
        }
        const offset = unit.info.flat ? 0 : 4;
        sprite.position.set(mapX(unit.position.x), mapY(unit.position.y) - offset);
        sprite.drawOrder = unit.info.drawOrder;
        this.unitSprites.set(unit.id, sprite);
        this.unitLayer.addChild(sprite);
    }
    showMessage(text, sound) {
        let y = this.height - 16;
        const playerSprite = this.unitSprites.get(this.world.player.id);
        if (playerSprite !== undefined &&
            playerSprite.position.y + this.unitLayer.position.y > this.height * 0.75) {
            y = 32;
        }
        this.messageBG.position.set(this.width / 2, y);
        this.messageBG.opacity = 0;
        this.messageBG.visible = true;
        this.tweens
            .create(this.messageBG)
            .to({
            opacity: 1,
        }, 250)
            .wait(2500)
            .to({
            opacity: 0,
        }, 250)
            .call(() => (this.messageBG.visible = false));
        this.message.text = text;
        this.message.position.set(this.width / 2 - this.message.width / 2, y - this.message.size / 2);
        this.message.opacity = 0;
        this.message.visible = true;
        this.tweens
            .create(this.message)
            .to({
            opacity: 1,
        }, 250)
            .wait(2500)
            .to({
            opacity: 0,
        }, 250)
            .call(() => (this.message.visible = false));
        this.sounds.play(sound !== null && sound !== void 0 ? sound : "interaction13");
    }
    resetMessage() {
        this.tweens.cancel(this.messageBG);
        this.tweens.cancel(this.message);
        this.messageBG.visible = false;
        this.message.visible = false;
    }
    async showOverlay(duration, fillStyle) {
        this.overlay.fillStyle = fillStyle;
        this.overlay.opacity = 0;
        this.overlay.visible = true;
        await this.tweens
            .create(this.overlay)
            .to({
            opacity: 1,
        }, duration, Ease.QuadIn)
            .promise();
    }
    async hideOverlay(duration, delay = 0) {
        await this.tweens
            .create(this.overlay)
            .wait(delay)
            .to({
            opacity: 0,
        }, duration, Ease.QuadOut)
            .call(() => (this.overlay.visible = false))
            .promise();
    }
    shake(actor, duration, iterations, amount) {
        const tw = this.tweens.create(actor.position);
        const d = (duration * 2) / iterations / 4;
        const x = actor.position.x;
        tw.to({
            x: x - amount,
        }, d, Ease.QuadOut)
            .to({
            x: x + amount,
        }, d * 2, Ease.QuadInOut)
            .to({
            x,
        }, d, Ease.QuadIn)
            .loop(iterations - 1);
        this.tweens.add(tw);
        return tw;
    }
}
