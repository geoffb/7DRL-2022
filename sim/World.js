import { Grid, manhattanDistance, Random, Vector2, distance, } from "@mousepox/math";
import { BagSet } from "./BagSet";
import { Inventory } from "./Inventory";
import { Unit } from "./Unit";
import { Level } from "./gen/Level";
function applyDirection(point, direction) {
    switch (direction) {
        case 0:
            point.y--;
            return;
        case 1:
            point.x++;
            return;
        case 2:
            point.y++;
            return;
        case 3:
            point.x--;
            return;
    }
}
function flipDirection(direction) {
    return (direction + 2) % 4;
}
function getDirection(x, y) {
    if (x < 0) {
        return 3;
    }
    else if (x > 0) {
        return 1;
    }
    else if (y < 0) {
        return 0;
    }
    else {
        return 2;
    }
}
function getUnitDirection(unit, target) {
    return getDirection(target.position.x - unit.position.x, target.position.y - unit.position.y);
}
function getUnitDistance(unit, target) {
    return manhattanDistance(unit.position.x, unit.position.y, target.position.x, target.position.y);
}
export class World {
    constructor(data) {
        this.units = new Map();
        this.inventory = new Inventory();
        this.steps = 0;
        this.nextUnitId = 1;
        this.rng = new Random();
        this.map = new Grid(0, 0);
        this.mapCache = new Map();
        this.timeElapsed = 0;
        this.timeLast = Date.now();
        this.awaitingMapChange = false;
        this.floorIndex = -1;
        this.getTimeElapsed = () => this.timeElapsed;
        this.onAction = (_type, ..._params) => {
            return;
        };
        this.config = data.get("data/world.json");
        this.prefabs = data.get("data/prefabs.json");
        const bagsData = data.get("data/bags.json");
        this.bags = new BagSet(this.rng, bagsData);
        this.level = new Level(data, this.bags);
        this.player = this.createUnit("player");
    }
    get floor() {
        return this.floorIndex;
    }
    get over() {
        return this.player.health < 1;
    }
    get environment() {
        return this.level.environment;
    }
    restart() {
        this.steps = 0;
        this.floorIndex = -1;
        this.timeElapsed = 0;
        this.timeLast = Date.now();
        this.player = this.createUnit("player");
        this.player.health = this.player.info.health;
        this.inventory.empty();
        for (const type in this.config.inventory) {
            this.inventory.add(type, this.config.inventory[type]);
        }
        this.units.clear();
        this.mapCache.clear();
        this.nextUnitId = 1;
        this.loadMap(0);
    }
    getUnitInfo(type) {
        const info = this.prefabs[type];
        if (info !== undefined) {
            return info;
        }
        else {
            throw new Error(`Invalid unit type: ${type}`);
        }
    }
    loadMap(floor) {
        this.unloadMap();
        this.generateMap(floor);
        this.addUnit(this.player);
        this.player.position.set(this.level.start.x, this.level.start.y);
        this.floorIndex = floor;
        this.awaitingMapChange = false;
    }
    addUnit(unit) {
        unit.id = this.nextUnitId++;
        this.units.set(unit.id, unit);
    }
    removeUnit(unit) {
        this.units.delete(unit.id);
    }
    spawnUnitCorpse(unit) {
        if (unit.info.corpse) {
            const corpse = this.createUnit(unit.info.corpse);
            corpse.position.set(unit.position.x, unit.position.y);
            this.addUnit(corpse);
            this.onAction(3, corpse);
        }
    }
    createUnit(type) {
        return new Unit(type, this.getUnitInfo(type));
    }
    activatePlayerSkill() {
        if (this.over) {
            return;
        }
        if (this.removePlayerInventory("magic", 1)) {
            const px = this.player.position.x;
            const py = this.player.position.y;
            const radius = 2;
            const sx = this.player.position.x - radius;
            const sy = this.player.position.y - radius;
            const size = radius * 2 + 1;
            const positions = [];
            this.map.forEachInArea(sx, sy, size, size, (value, x, y) => {
                if (value !== 0 || (x === px && y === py)) {
                    return;
                }
                if (distance(px, py, x, y) <= radius) {
                    positions.push({ x, y });
                    const units = this.getUnitsAt(x, y);
                    for (const unit of units) {
                        if (unit.info.role === "player" ||
                            unit.info.role === "warp") {
                            return;
                        }
                        this.damageUnit(unit, 1);
                    }
                }
                this.onAction(18, positions);
            });
        }
        else {
            this.onAction(2, this.player, {
                x: this.player.position.x,
                y: this.player.position.y - 1,
            });
        }
        this.steps++;
        this.onAction(0);
    }
    movePlayer(direction) {
        if (this.over) {
            return;
        }
        this.steps += 1;
        this.moveUnit(this.player, direction);
        if (this.checkGameOver() || this.awaitingMapChange) {
            return;
        }
        const pos = this.player.position;
        if (pos.x < 0 ||
            pos.y < 0 ||
            pos.x >= this.map.width ||
            pos.y >= this.map.height) {
            this.onAction(11, direction);
        }
        else {
            this.onAction(0);
        }
    }
    step() {
        this.units.forEach((unit) => {
            if (this.over) {
                return;
            }
            this.updateUnit(unit);
        });
        if (this.steps % 20 === 0) {
            const poisonDamage = Math.floor(this.inventory.get("poison") / 25);
            if (poisonDamage > 0) {
                this.damageUnit(this.player, poisonDamage, "poison");
            }
        }
        this.checkGameOver();
    }
    update() {
        const timeDelta = Date.now() - this.timeLast;
        this.timeElapsed += timeDelta;
        this.timeLast = Date.now();
    }
    getUnitByType(type) {
        for (const [, unit] of this.units) {
            if (unit.type === type) {
                return unit;
            }
        }
    }
    getUnitAt(x, y) {
        for (const [, unit] of this.units) {
            if (unit.position.x === x && unit.position.y === y) {
                return unit;
            }
        }
    }
    getUnitsAt(x, y) {
        const units = [];
        for (const [, unit] of this.units) {
            if (unit.position.x === x && unit.position.y === y) {
                units.push(unit);
            }
        }
        return units;
    }
    checkGameOver() {
        if (this.player.health < 1) {
            this.onAction(14);
            return true;
        }
        if (this.inventory.has("crown")) {
            this.onAction(13);
            return true;
        }
        return false;
    }
    generateMap(floor) {
        if (floor === 0) {
            this.level.load("library");
        }
        else if (floor % 3 === 0) {
            this.level.load("shop");
        }
        else {
            this.level.generate(2, 3, "sewer");
        }
        this.map.resize(this.level.map.width, this.level.map.height);
        this.map.copy(this.level.map);
        for (const entity of this.level.entities) {
            const unit = this.spawnUnit(entity.type, entity.x, entity.y, true);
            if (entity.forSale) {
                unit.forSale = true;
            }
        }
    }
    unloadMap() {
        this.steps = 0;
        this.units.clear();
    }
    moveUnit(unit, direction) {
        const target = new Vector2(unit.position.x, unit.position.y);
        applyDirection(target, direction);
        if (this.isBlocked(unit, direction, false)) {
            this.onAction(2, unit, target);
            return;
        }
        const others = this.getUnitsAt(target.x, target.y);
        if (!others.some((u) => u.info.solid)) {
            unit.position.set(target.x, target.y);
            this.onAction(1, unit, target);
        }
        this.triggerUnitInteractions(unit, others);
    }
    triggerUnitInteractions(unit, others) {
        for (const other of others) {
            if (unit.id === other.id) {
                continue;
            }
            if (!this.units.has(unit.id) || !this.units.has(other.id)) {
                continue;
            }
            if ((unit.info.role === "player" && other !== undefined) ||
                (unit.info.role === "monster" &&
                    ((other === null || other === void 0 ? void 0 : other.info.role) === "player" ||
                        (other === null || other === void 0 ? void 0 : other.info.role) === "trap"))) {
                this.interactUnits(unit, other);
            }
        }
    }
    damageUnit(unit, amount, source) {
        var _a;
        unit.health -= amount;
        this.onAction(4, unit.id, -amount, unit.health, source);
        if (unit.health < 1) {
            this.removeUnit(unit);
            this.onAction(10, unit.id, unit.type);
            if (unit.type === "playerAlive") {
                this.player = this.spawnUnit("player", unit.position.x, unit.position.y);
            }
            if (((_a = unit.info.data) === null || _a === void 0 ? void 0 : _a.loot) !== undefined) {
                const drop = this.bags.get(unit.info.data.loot);
                if (drop !== "") {
                    this.spawnUnit(drop, unit.position.x, unit.position.y);
                }
            }
            if (this.affix === "combust" && unit.info.role === "monster") {
                const flame = this.spawnUnit("flame", unit.position.x, unit.position.y);
                flame.ttl = 10;
            }
            if (this.affix === "vengeful" && unit.info.role === "monster") {
                const ghost = this.spawnUnit("ghost", unit.position.x, unit.position.y);
                ghost.ttl = 3;
            }
        }
    }
    spawnUnit(type, x, y, quiet = false) {
        const unit = this.createUnit(type);
        unit.asleep = true;
        unit.position.set(x, y);
        this.addUnit(unit);
        if (!quiet) {
            this.onAction(3, unit);
        }
        return unit;
    }
    interactUnits(unit, target) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const info = target.info;
        if (target.forSale &&
            (info.role === "pickup" ||
                info.role === "restore_health" ||
                info.role === "cure_poison")) {
            const cost = (_b = (_a = info.data) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0;
            if (!this.canPlayerUseItem(target) ||
                !this.removePlayerInventory("gold", cost)) {
                this.onAction(2, target, {
                    x: target.position.x,
                    y: target.position.y - 1,
                });
                return;
            }
        }
        switch (info.role) {
            case "monster":
            case "player":
            case "doodad":
                this.onAction(5, unit.id, unit.position, target.position);
                if ((unit.info.role === "player" &&
                    this.inventory.has("powerGloves")) ||
                    unit.type === "giant_skeleton" ||
                    unit.type === "zombie") {
                    const kx = target.position.x + (target.position.x - unit.position.x);
                    const ky = target.position.y + (target.position.y - unit.position.y);
                    if (!this.isBlockedXY(kx, ky)) {
                        target.position.set(kx, ky);
                        this.onAction(6, target.id, {
                            x: kx,
                            y: ky,
                        });
                        const others = this.getUnitsAt(kx, ky);
                        this.triggerUnitInteractions(target, others);
                    }
                }
                this.damageUnit(target, 1);
                break;
            case "trap":
                this.damageUnit(unit, 1);
                break;
            case "pickup":
                if (!this.canPlayerUseItem(target)) {
                    this.onAction(2, target, {
                        x: target.position.x,
                        y: target.position.y - 1,
                    });
                    break;
                }
                this.removeUnit(target);
                this.onAction(7, target.id);
                this.addPlayerInventory(info.data.pickup.type, info.data.pickup.amount);
                break;
            case "restore_health":
                this.removeUnit(target);
                this.onAction(7, target.id);
                const amount = (_d = (_c = info.data) === null || _c === void 0 ? void 0 : _c.heal) !== null && _d !== void 0 ? _d : 0;
                if (amount > 0) {
                    unit.health += amount;
                    this.onAction(4, unit.id, amount, unit.health);
                }
                break;
            case "cure_poison": {
                this.removeUnit(target);
                this.onAction(7, target.id);
                const amount = (_f = (_e = info.data) === null || _e === void 0 ? void 0 : _e.cure) !== null && _f !== void 0 ? _f : 0;
                if (amount > 0) {
                    this.removePlayerInventory("poison", amount, true);
                }
                break;
            }
            case "door":
                if (this.removePlayerInventory(info.data, 1)) {
                    this.removeUnit(target);
                    this.onAction(9, target.id);
                }
                else {
                    this.onAction(2, unit, target.position);
                }
                break;
            case "warp":
                this.awaitingMapChange = true;
                this.onAction(12, (_h = (_g = target.info.data) === null || _g === void 0 ? void 0 : _g.warp) !== null && _h !== void 0 ? _h : "down");
                break;
        }
    }
    isBlockedXY(x, y, forceEmpty = false) {
        const tile = this.map.get(x, y);
        if (this.config.walkable.indexOf(tile) === -1) {
            return true;
        }
        const unit = this.getUnitAt(x, y);
        if (unit !== undefined && (unit.info.solid || forceEmpty)) {
            return true;
        }
        return false;
    }
    isBlocked(unit, direction, includeSolid = true) {
        const target = new Vector2(unit.position.x, unit.position.y);
        applyDirection(target, direction);
        let tile = -1;
        if (this.map.valid(target.x, target.y)) {
            tile = this.map.get(target.x, target.y);
        }
        if (tile === -1 && unit !== this.player) {
            return true;
        }
        if (tile !== -1 && this.config.walkable.indexOf(tile) === -1) {
            return true;
        }
        if (includeSolid) {
            const other = this.getUnitAt(target.x, target.y);
            if (other !== undefined && other.info.solid) {
                return true;
            }
        }
        return false;
    }
    updateUnit(unit) {
        if (unit.asleep) {
            unit.asleep = false;
            return;
        }
        if (unit.ttl > -1) {
            if (unit.ttl === 0) {
                this.removeUnit(unit);
                this.onAction(8, unit.id);
                return;
            }
            else {
                unit.ttl--;
            }
        }
        switch (unit.info.behavior) {
            case "replicate":
                this.behaviorReplicate(unit);
                break;
            case "random":
                this.behaviorRandom(unit);
                break;
            case "move_horz":
                if (getUnitDistance(unit, this.player) === 1) {
                    this.moveUnit(unit, getUnitDirection(unit, this.player));
                    break;
                }
                if (unit.data.dir === undefined) {
                    unit.data.dir = this.rng.chance(0.5)
                        ? 3
                        : 1;
                }
                if (this.isBlocked(unit, unit.data.dir)) {
                    unit.data.dir = flipDirection(unit.data.dir);
                }
                this.moveUnit(unit, unit.data.dir);
                break;
            case "move_vert":
                if (getUnitDistance(unit, this.player) === 1) {
                    this.moveUnit(unit, getUnitDirection(unit, this.player));
                    break;
                }
                if (unit.data.dir === undefined) {
                    unit.data.dir = this.rng.chance(0.5) ? 0 : 2;
                }
                if (this.isBlocked(unit, unit.data.dir)) {
                    unit.data.dir = flipDirection(unit.data.dir);
                }
                this.moveUnit(unit, unit.data.dir);
                break;
            case "hunt":
                this.behaviorHunt(unit);
                break;
            case "retreat":
                this.behaviorRetreat(unit);
                break;
            case "trap_horz": {
                if (unit.data.dir === undefined) {
                    unit.data.dir = this.rng.chance(0.5)
                        ? 3
                        : 1;
                }
                const pointCopy = {
                    x: unit.position.x,
                    y: unit.position.y,
                };
                applyDirection(pointCopy, unit.data.dir);
                const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
                if (targetUnit === undefined) {
                    if (this.isBlocked(unit, unit.data.dir)) {
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    this.moveUnit(unit, unit.data.dir);
                }
                else {
                    this.interactUnits(unit, targetUnit);
                    unit.data.dir = flipDirection(unit.data.dir);
                }
                break;
            }
            case "trap_vert": {
                if (unit.data.dir === undefined) {
                    unit.data.dir = this.rng.chance(0.5) ? 0 : 2;
                }
                const pointCopy = {
                    x: unit.position.x,
                    y: unit.position.y,
                };
                applyDirection(pointCopy, unit.data.dir);
                const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
                if (targetUnit === undefined) {
                    if (this.isBlocked(unit, unit.data.dir)) {
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    this.moveUnit(unit, unit.data.dir);
                }
                else {
                    this.interactUnits(unit, targetUnit);
                    unit.data.dir = flipDirection(unit.data.dir);
                }
                break;
            }
            case "fire_spout": {
                if (unit.data.step === undefined) {
                    unit.data.step = 0;
                }
                unit.data.step += 1;
                if (unit.data.step > 3) {
                    unit.data.step = 1;
                }
                switch (unit.data.step) {
                    case 1:
                        console.log("wait");
                        break;
                    case 2:
                        console.log("warn");
                        break;
                    case 3:
                        console.log("spout");
                        break;
                }
                break;
            }
            case "straight_then_turn": {
                const dirs = [
                    0,
                    1,
                    2,
                    3,
                ];
                if (unit.data.dir === undefined) {
                    unit.data.dirStep = 0;
                    unit.data.dir = dirs[unit.data.dirStep];
                }
                if (this.isBlocked(unit, unit.data.dir)) {
                    unit.data.dirStep += 1;
                    if (unit.data.dirStep >= dirs.length) {
                        unit.data.dirStep = 0;
                    }
                    unit.data.dir = dirs[unit.data.dirStep];
                }
                this.moveUnit(unit, unit.data.dir);
                break;
            }
        }
    }
    behaviorReplicate(unit) {
        const others = this.getUnitsAt(unit.position.x, unit.position.y);
        for (const other of others) {
            if (other !== undefined && other.info.role === "player") {
                this.addPlayerInventory("poison", 1);
            }
        }
        if (this.steps % 20 !== 0) {
            return;
        }
        let neighbors = 0;
        for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
            for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                if (x === unit.position.x && y === unit.position.y) {
                    continue;
                }
                const other = this.getUnitAt(x, y);
                if (other !== undefined && other.type === unit.type) {
                    neighbors++;
                }
            }
        }
        if (neighbors === 8) {
            for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
                for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                    const other = this.getUnitAt(x, y);
                    if (other !== undefined && other.type === unit.type) {
                        this.removeUnit(other);
                        this.onAction(10, other.id, other.type);
                    }
                }
            }
            this.spawnUnit("slime_green", unit.position.x, unit.position.y);
        }
        else if ((neighbors < 1 || neighbors > 4) && Math.random() > 0.5) {
            this.removeUnit(unit);
            this.onAction(10, unit.id, unit.type);
        }
        else if (neighbors > 1 && neighbors < 4 && Math.random() > 0.5) {
            const points = [];
            for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
                for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                    if (!this.isBlockedXY(x, y, true)) {
                        points.push({ x, y });
                    }
                }
            }
            if (points.length > 0) {
                const point = this.rng.choice(points);
                this.spawnUnit(unit.type, point.x, point.y);
            }
        }
    }
    behaviorRandom(unit) {
        const valid = [];
        for (let d = 0; d <= 3; ++d) {
            const target = new Vector2(unit.position.x, unit.position.y);
            applyDirection(target, d);
            const other = this.getUnitAt(target.x, target.y);
            if (other !== undefined && other.info.role === "player") {
                valid.length = 0;
                valid.push(d);
                break;
            }
            else if (!this.isBlocked(unit, d)) {
                valid.push(d);
            }
        }
        if (valid.length > 0) {
            const index = this.rng.integer(0, valid.length - 1);
            this.moveUnit(unit, valid[index]);
        }
    }
    behaviorHunt(unit) {
        const direction = getUnitDirection(unit, this.player);
        if (this.isBlocked(unit, direction)) {
            this.behaviorRandom(unit);
        }
        else {
            this.moveUnit(unit, direction);
        }
    }
    behaviorRetreat(unit) {
        const direction = flipDirection(getUnitDirection(unit, this.player));
        if (this.isBlocked(unit, direction)) {
            this.behaviorRandom(unit);
        }
        else {
            this.moveUnit(unit, direction);
        }
    }
    addPlayerInventory(type, amount) {
        this.inventory.add(type, amount);
        this.onAction(15, type, amount, this.inventory.get(type));
    }
    removePlayerInventory(type, amount, force = false) {
        const success = this.inventory.remove(type, amount, force);
        if (success) {
            this.onAction(15, type, amount, this.inventory.get(type));
        }
        return success;
    }
    canPlayerUseItem(_item) {
        return true;
    }
}
