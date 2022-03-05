import { DataCache } from "@mousepox/jack";
import {
  Grid,
  IPoint,
  manhattanDistance,
  Random,
  Vector2,
} from "@mousepox/math";
import { Bag } from "./Bag";
import { Inventory } from "./Inventory";
import {
  getLayerByName,
  getLayersByType,
  getWalkableTiles,
  ITiledMap,
  ITiledObjectGroup,
  ITiledTileLayer,
  parseProperties,
} from "./tiled";
import {
  IUnitInfo,
  IUnitSerialization,
  Unit,
  UnitBehavior,
  UnitRole,
} from "./Unit";

/** Action types emitted by the world */
export const enum WorldAction {
  StepAwait,
  UnitMove,
  UnitNegate,
  UnitSpawn,
  UnitHealthChange,
  UnitAttack,
  UnitKnockback,
  UnitPickup,
  UnitRemove,
  UnitOpen,
  UnitDie,
  RoomChange,
  MapChange,
  Won,
  Lost,
  PlayerInventoryChange,
  PlayerStarve,
  PlayerHumanityRestore,
}

interface IMapContext {
  enter: IPoint;
  exit: IPoint;
}

interface IMapSerialization {
  width: number;
  height: number;
  // rooms: IRoomSerialization[];
  units: IUnitSerialization[];
  context: IMapContext;
  tiles: number[];
}

export const enum Direction {
  Up,
  Right,
  Down,
  Left,
}

/** Apply a direction to a vector */
function applyDirection(point: IPoint, direction: Direction) {
  switch (direction) {
    case Direction.Up:
      point.y--;
      return;
    case Direction.Right:
      point.x++;
      return;
    case Direction.Down:
      point.y++;
      return;
    case Direction.Left:
      point.x--;
      return;
  }
}

function flipDirection(direction: Direction): Direction {
  return (direction + 2) % 4;
}

function getDirection(x: number, y: number): Direction {
  if (x < 0) {
    return Direction.Left;
  } else if (x > 0) {
    return Direction.Right;
  } else if (y < 0) {
    return Direction.Up;
  } else {
    return Direction.Down;
  }
}

function getUnitDirection(unit: Unit, target: Unit): Direction {
  return getDirection(
    target.position.x - unit.position.x,
    target.position.y - unit.position.y
  );
}

function getUnitDistance(unit: Unit, target: Unit): number {
  return manhattanDistance(
    unit.position.x,
    unit.position.y,
    target.position.x,
    target.position.y
  );
}

interface IWorldConfig {
  start: string;
  bags: {
    [index: string]: any;
  };
}

export class World {
  public readonly units: Map<number, Unit> = new Map();

  public player: Unit;

  public readonly inventory = new Inventory();

  public steps = 0;

  public affix: string | undefined;

  private readonly data: DataCache;

  private readonly config: IWorldConfig;

  private readonly prefabs: Record<string, IUnitInfo>;

  private nextUnitId = 1;

  private readonly rng = new Random();

  public readonly map = new Grid(0, 0);

  /** Map context (entry/exit points, etc) */
  private mapContext: IMapContext = {
    enter: { x: 0, y: 0 },
    exit: { x: 0, y: 0 },
  };

  /** Cache of JSON encoded map data */
  private readonly mapCache: Map<number, string> = new Map();

  private readonly walkableTiles: number[] = [];

  private timeElapsed = 0;
  private timeLast = Date.now();

  private awaitingMapChange = false;

  /** Index of the currently active floor  */
  private floorIndex = -1;

  private readonly bags: Map<string, any> = new Map();

  public get floor(): number {
    return this.floorIndex;
  }

  public get over(): boolean {
    return this.player.health < 1;
  }

  constructor(data: DataCache) {
    this.data = data;
    this.config = data.get("data/config.json");
    this.prefabs = data.get("data/prefabs.json");

    this.player = this.createUnit("player");

    // Init bags
    for (const name in this.config.bags) {
      this.bags.set(name, new Bag(this.rng, this.config.bags[name]));
    }

    // Parse tileset data
    const tileset = data.get("data/tilesets/forest.json");
    this.walkableTiles = getWalkableTiles(tileset);
  }

  public getTimeElapsed = () => this.timeElapsed;

  /** Emitted when an action has occurred within the world */
  public onAction = (_type: WorldAction, ..._params: any[]) => {
    return;
  };

  public restart() {
    this.steps = 0;
    this.floorIndex = -1;

    this.timeElapsed = 0;
    this.timeLast = Date.now();

    this.player = this.createUnit("player");
    this.player.health = this.player.info.health;

    this.inventory.empty();

    this.units.clear();
    this.mapCache.clear();
    this.nextUnitId = 1;

    this.loadMap(0);
  }

  /** Return the unit type definition */
  public getUnitInfo(type: string): IUnitInfo {
    const info = this.prefabs[type];
    if (info !== undefined) {
      return info;
    } else {
      throw new Error(`Invalid unit type: ${type}`);
    }
  }

  /** Load a floor */
  public loadMap(floor: number) {
    // Unload current map first
    this.unloadMap();

    // Load map data
    const map = this.unpackMap(floor);
    if (map !== undefined) {
      // Load map from cached data
      this.mapContext = map.context;
      this.map.resize(map.width, map.height);
      this.map.cells = map.tiles;
    } else {
      // Generate a new map
      this.generateMap(floor);
    }

    let spawnX = 0;
    let spawnY = 0;

    // Determine player spawn location
    if (floor < this.floorIndex) {
      // Going up
      spawnX = this.mapContext.exit.x;
      spawnY = this.mapContext.exit.y;
    } else {
      // Going down
      spawnX = this.mapContext.enter.x;
      spawnY = this.mapContext.enter.y;
    }

    // Place player within room
    this.addUnit(this.player);
    this.player.position.set(spawnX, spawnY);

    // Update floor index
    this.floorIndex = floor;

    this.awaitingMapChange = false;
  }

  public addUnit(unit: Unit) {
    unit.id = this.nextUnitId++;
    this.units.set(unit.id, unit);
  }

  public removeUnit(unit: Unit) {
    this.units.delete(unit.id);
  }

  public spawnUnitCorpse(unit: Unit) {
    if (unit.info.corpse) {
      const corpse = this.createUnit(unit.info.corpse);
      corpse.position.set(unit.position.x, unit.position.y);
      this.addUnit(corpse);
      this.onAction(WorldAction.UnitSpawn, corpse);
    }
  }

  public createUnit(type: string): Unit {
    return new Unit(type, this.getUnitInfo(type));
  }

  public movePlayer(direction: Direction) {
    if (this.over) {
      return;
    }

    this.steps += 1;

    this.moveUnit(this.player, direction);

    if (this.checkGameOver() || this.awaitingMapChange) {
      return;
    }

    const pos = this.player.position;
    if (
      pos.x < 0 ||
      pos.y < 0 ||
      pos.x >= this.map.width ||
      pos.y >= this.map.height
    ) {
      this.onAction(WorldAction.RoomChange, direction);
    } else {
      this.onAction(WorldAction.StepAwait);
    }
  }

  /** Step the world by a single iteration */
  public step() {
    // The player consumes a food resource for every world step when alive
    if (
      this.player.type === "playerAlive" &&
      !this.player.asleep &&
      !this.removePlayerInventory("food", 1)
    ) {
      this.damageUnit(this.player, 1);
      this.onAction(WorldAction.PlayerStarve);
      this.addPlayerInventory("food", 20);
    }

    // Update units
    this.units.forEach((unit) => {
      if (this.over) {
        return;
      }
      this.updateUnit(unit);
    });

    this.checkGameOver();
  }

  public update() {
    const timeDelta = Date.now() - this.timeLast;
    this.timeElapsed += timeDelta;
    this.timeLast = Date.now();
  }

  public getUnitByType(type: string): Unit | undefined {
    for (const [, unit] of this.units) {
      if (unit.type === type) {
        return unit;
      }
    }
  }

  public getUnitAt(x: number, y: number): Unit | undefined {
    for (const [, unit] of this.units) {
      if (unit.position.x === x && unit.position.y === y) {
        return unit;
      }
    }
  }

  public getUnitsAt(x: number, y: number): Unit[] {
    const units: Unit[] = [];
    for (const [, unit] of this.units) {
      if (unit.position.x === x && unit.position.y === y) {
        units.push(unit);
      }
    }
    return units;
  }

  private checkGameOver(): boolean {
    // End game when the player has died
    if (this.player.health < 1) {
      this.onAction(WorldAction.Lost);
      return true;
    }

    // HACK: End game when picking up crown
    if (this.inventory.has("crown")) {
      this.onAction(WorldAction.Won);
      return true;
    }

    // Not over yet
    return false;
  }

  /** Unpack map data from the map cache */
  private packMap(floor: number, data: IMapSerialization) {
    this.mapCache.set(floor, JSON.stringify(data));
  }

  /** Pack map data into the map cache */
  private unpackMap(floor: number): IMapSerialization | undefined {
    const data = this.mapCache.get(floor);
    if (data !== undefined) {
      this.mapCache.delete(floor);
      return JSON.parse(data);
    } else {
      return undefined;
    }
  }

  private generateMap(floor: number) {
    this.affix = undefined;
    if (floor === 0) {
      // DEBUG: Uncomment to force a specific map/variant
      // this.loadMapFromData("crypt4", "unit_a");
      this.loadMapFromData(this.config.start);
    } else if (floor % 4 === 0) {
      this.loadMapFromData(this.getFromBag("maps_rest"));
    } else {
      if (floor % 5 === 0) {
        this.affix = this.getFromBag("affixes");
      }
      this.loadMapFromData(this.getFromBag("maps_floors"));
    }
  }

  /** Load map from data cache */
  private loadMapFromData(name: string, layout?: string) {
    // Get map data
    const data = this.data.get(`data/maps/${name}.json`) as ITiledMap;

    // Load map properties
    if (data.properties !== undefined) {
      const props = parseProperties(data.properties);
      this.mapContext.enter.x = props.PlayerStartX ?? 0;
      this.mapContext.enter.y = props.PlayerStartY ?? 0;
    }

    // Initialize map
    // Get the first tile layer found
    const tiles = getLayersByType<ITiledTileLayer>(data, "tilelayer")[0];
    this.map.resize(data.width, data.height);
    for (let i = 0; i < tiles.data.length; i++) {
      this.map.cells[i] = tiles.data[i] - 1;
    }

    let group: ITiledObjectGroup | undefined;
    if (layout !== undefined) {
      // Specific object group
      group = getLayerByName<ITiledObjectGroup>(data, layout);
    } else {
      // Chose one of the available object groups
      const objectGroups = getLayersByType<ITiledObjectGroup>(
        data,
        "objectgroup"
      );
      group = layout ?? this.rng.choice(objectGroups);
    }

    if (group !== undefined) {
      // Create units from object group
      for (const unitData of group.objects) {
        // Determine map grid location
        const mapX = Math.floor(unitData.x / 16);
        const mapY = Math.floor(unitData.y / 16 - 1);

        // Ensure object has a valid type
        if (unitData.type.length === 0) {
          console.warn(`Skipping undefined unit type at: ${mapX}, ${mapY}`);
          continue;
        }

        // Create unit structure
        const unit: IUnitSerialization = {
          data: {},
          sale: false,
          ttl: -1,
          type: unitData.type,
          x: mapX,
          y: mapY,
        };

        // Transfer custom object properties to free-form unit data
        if (unitData.properties) {
          for (const prop of unitData.properties) {
            unit.data[prop.name] = prop.value;
          }
        }

        // Update map context
        switch (unit.type) {
          case "stairsDown":
            this.mapContext.exit.x = mapX;
            this.mapContext.exit.y = mapY;
            break;
          case "stairsUp":
            this.mapContext.enter.x = mapX;
            this.mapContext.enter.y = mapY;
            break;
        }

        // Add unit
        const u = Unit.deserialize(unit, this.getUnitInfo(unit.type));
        this.addUnit(u);
      }
    } else {
      console.error("Invalid object group");
    }
  }

  /** Unload the currently loaded map and store it in the map cache */
  private unloadMap() {
    // Bail out of a floor isn't currently loaded
    if (this.floorIndex < 0) {
      return;
    }

    // Pack units
    const units: IUnitSerialization[] = [];
    for (const [, unit] of this.units) {
      if (unit.info.role === UnitRole.Player) {
        continue;
      }
      units.push(unit.serialize());
    }

    // Clear out active units
    this.units.clear();

    // Pack map into map cache
    this.packMap(this.floorIndex, {
      context: this.mapContext,
      height: this.map.height,
      // rooms,
      units,
      tiles: this.map.cells.slice(),
      width: this.map.width,
    });
  }

  private moveUnit(unit: Unit, direction: Direction) {
    // Create move target: unit's position + move direction
    const target = new Vector2(unit.position.x, unit.position.y);
    applyDirection(target, direction);

    // Ensure unit doesn't move into blocked tiles
    // This ONLY checks for walls, not solid units
    if (this.isBlocked(unit, direction, false)) {
      this.onAction(WorldAction.UnitNegate, unit, target);
      return;
    }

    // Check for units at target
    const others = this.getUnitsAt(target.x, target.y);

    // Ensure other units are not blocking movement
    if (!others.some((u) => u.info.solid)) {
      // No units blocking, move unit
      unit.position.set(target.x, target.y);
      // this.emitUnitAction(unit, UnitActionType.Move, target);

      this.onAction(WorldAction.UnitMove, unit, target);
    }

    this.triggerUnitInteractions(unit, others);
  }

  private triggerUnitInteractions(unit: Unit, others: Unit[]) {
    // Interact with other units
    for (const other of others) {
      if (unit.id === other.id) {
        continue;
      }
      if (!this.units.has(unit.id) || !this.units.has(other.id)) {
        continue;
      }
      if (
        // Player vs anything OR
        // Monster vs Player
        (unit.info.role === UnitRole.Player && other !== undefined) ||
        (unit.info.role === UnitRole.Monster &&
          (other?.info.role === UnitRole.Player ||
            other?.info.role === UnitRole.Trap))
      ) {
        this.interactUnits(unit, other);
      }
    }
  }

  private damageUnit(unit: Unit, amount: number) {
    unit.health -= amount;
    this.onAction(WorldAction.UnitHealthChange, unit.id, -amount, unit.health);

    // Handle unit death
    if (unit.health < 1) {
      this.removeUnit(unit);
      this.onAction(WorldAction.UnitDie, unit.id, unit.type);

      // If the player was alive, revert them to a skeleton
      if (unit.type === "playerAlive") {
        this.player = this.spawnUnit(
          "player",
          unit.position.x,
          unit.position.y
        );
      }

      // Spawn loot on death
      if (unit.info.data?.loot !== undefined) {
        const suffix = this.player.type === "player" ? "_dead" : "_alive";
        const drop: string = this.getFromBag(unit.info.data.loot + suffix);
        if (drop !== "") {
          this.spawnUnit(drop, unit.position.x, unit.position.y);
        }
      }

      // Combustible Affix: Spawn a flame when a monster dies
      if (this.affix === "combust" && unit.info.role === UnitRole.Monster) {
        const flame = this.spawnUnit("flame", unit.position.x, unit.position.y);
        flame.ttl = 10;
      }

      // Vengeful Affix: Spawn a ghost when a monster dies
      if (this.affix === "vengeful" && unit.info.role === UnitRole.Monster) {
        const ghost = this.spawnUnit("ghost", unit.position.x, unit.position.y);
        ghost.ttl = 3;
      }
    }
  }

  /** Spawn a new unit into the world at a specified location */
  private spawnUnit(type: string, x: number, y: number): Unit {
    const unit = this.createUnit(type);
    unit.asleep = true;
    unit.position.set(x, y);
    this.addUnit(unit);
    this.onAction(WorldAction.UnitSpawn, unit);
    return unit;
  }

  private interactUnits(unit: Unit, target: Unit) {
    const info = target.info;

    // Handle shop logic before attempting to interact
    if (
      target.forSale &&
      (info.role === UnitRole.Pickup || info.role === UnitRole.RestoreHealth)
    ) {
      const cost = info.data?.cost ?? 0;
      // Negate the sale transation if:
      // 1. The player cannot use the item
      // 2. The player cannot afford the item
      if (
        !this.canPlayerUseItem(target) ||
        !this.removePlayerInventory("gold", cost)
      ) {
        this.onAction(WorldAction.UnitNegate, target, {
          x: target.position.x,
          y: target.position.y - 1,
        });
        return;
      }
    }

    switch (info.role) {
      case UnitRole.Monster:
      case UnitRole.Player:
      case UnitRole.Doodad:
        this.onAction(
          WorldAction.UnitAttack,
          unit.id,
          unit.position,
          target.position
        );
        if (
          (unit.info.role === UnitRole.Player &&
            this.inventory.has("powerGloves")) ||
          unit.type === "giant_skeleton" ||
          unit.type === "zombie"
        ) {
          // Apply knockback
          const kx = target.position.x + (target.position.x - unit.position.x);
          const ky = target.position.y + (target.position.y - unit.position.y);
          if (!this.isBlockedXY(kx, ky)) {
            target.position.set(kx, ky);
            this.onAction(WorldAction.UnitKnockback, target.id, {
              x: kx,
              y: ky,
            });
            const others = this.getUnitsAt(kx, ky);
            this.triggerUnitInteractions(target, others);
          }
        }
        this.damageUnit(target, 1);
        break;

      case UnitRole.Trap:
        this.damageUnit(unit, 1);
        break;

      case UnitRole.Pickup:
        // Negate pickup if the player cannot use the target
        if (!this.canPlayerUseItem(target)) {
          this.onAction(WorldAction.UnitNegate, target, {
            x: target.position.x,
            y: target.position.y - 1,
          });
          break;
        }
        this.removeUnit(target);
        this.onAction(WorldAction.UnitPickup, target.id);
        this.addPlayerInventory(info.data.pickup.type, info.data.pickup.amount);
        if (target.type === "elixir_life" && unit.type === "player") {
          // Resurrect player
          this.removeUnit(this.player);
          this.onAction(WorldAction.UnitRemove, this.player.id);
          this.player = this.spawnUnit(
            "playerAlive",
            this.player.position.x,
            this.player.position.y
          );
          this.onAction(WorldAction.PlayerHumanityRestore);
        }
        break;

      case UnitRole.RestoreHealth:
        if (this.player.type === "player") {
          this.onAction(WorldAction.UnitNegate, target, {
            x: target.position.x,
            y: target.position.y - 1,
          });
          break;
        }
        this.removeUnit(target);
        this.onAction(WorldAction.UnitPickup, target.id);
        const amount = info.data?.heal ?? 0;
        if (amount > 0) {
          unit.health += amount;
          this.onAction(
            WorldAction.UnitHealthChange,
            unit.id,
            amount,
            unit.health
          );
        }
        break;

      case UnitRole.Door:
        if (this.removePlayerInventory(info.data, 1)) {
          this.removeUnit(target);
          this.onAction(WorldAction.UnitOpen, target.id);
        } else {
          this.onAction(WorldAction.UnitNegate, unit, target.position);
        }
        break;

      case UnitRole.Warp:
        this.awaitingMapChange = true;
        this.onAction(WorldAction.MapChange, target.info.data?.warp ?? "down");
        break;
    }
  }

  /** Returns whether a given tile is blocked */
  private isBlockedXY(x: number, y: number): boolean {
    // Check for non-walkable tiles
    const tile = this.map.get(x, y);
    if (this.walkableTiles.indexOf(tile) === -1) {
      return true;
    }

    // Check for solid units
    const unit = this.getUnitAt(x, y);
    if (unit !== undefined && unit.info.solid) {
      return true;
    }

    // No blockers
    return false;
  }

  /**
   * Returns if the specified unit is blocked from moving in the specified direction
   * @param unit Unit to be moved
   * @param direction Direction unit wishes to move
   * @param includeSolid Whether solid units should be treated as blockers
   */
  private isBlocked(
    unit: Unit,
    direction: Direction,
    includeSolid = true
  ): boolean {
    const target = new Vector2(unit.position.x, unit.position.y);
    applyDirection(target, direction);

    // Get tile type at target location
    let tile = -1;
    if (this.map.valid(target.x, target.y)) {
      tile = this.map.get(target.x, target.y);
    }

    // Check if tile is walkable
    if (tile === -1 && unit !== this.player) {
      return true;
    }
    if (tile !== -1 && this.walkableTiles.indexOf(tile) === -1) {
      return true;
    }

    // Get existing unit at target location (if any)
    if (includeSolid) {
      const other = this.getUnitAt(target.x, target.y);
      // Check if existing unit is solid
      if (other !== undefined && other.info.solid) {
        return true;
      }
    }

    // Nothing blocking
    return false;
  }

  private updateUnit(unit: Unit) {
    // Sleeping units skip their first turn
    if (unit.asleep) {
      unit.asleep = false;
      return;
    }

    if (unit.ttl > -1) {
      if (unit.ttl === 0) {
        this.removeUnit(unit);
        this.onAction(WorldAction.UnitRemove, unit.id);
        return;
      } else {
        unit.ttl--;
      }
    }

    // Act
    switch (unit.info.behavior) {
      case UnitBehavior.Random:
        this.behaviorRandom(unit);
        break;

      case UnitBehavior.MoveH:
        // Attack player if within range
        if (getUnitDistance(unit, this.player) === 1) {
          this.moveUnit(unit, getUnitDirection(unit, this.player));
          break;
        }

        // Randomly choose left/right if direction not set
        if (unit.data.dir === undefined) {
          unit.data.dir = this.rng.chance(0.5)
            ? Direction.Left
            : Direction.Right;
        }
        // If blocked flip direction, otherwise move in current direction
        if (this.isBlocked(unit, unit.data.dir)) {
          unit.data.dir = flipDirection(unit.data.dir);
        }
        this.moveUnit(unit, unit.data.dir);
        break;

      case UnitBehavior.MoveV:
        // Attack player if within range
        if (getUnitDistance(unit, this.player) === 1) {
          this.moveUnit(unit, getUnitDirection(unit, this.player));
          break;
        }

        // Randomly choose up/down if direction not set
        if (unit.data.dir === undefined) {
          unit.data.dir = this.rng.chance(0.5) ? Direction.Up : Direction.Down;
        }
        // If blocked flip direction, otherwise move in current direction
        if (this.isBlocked(unit, unit.data.dir)) {
          unit.data.dir = flipDirection(unit.data.dir);
        }
        this.moveUnit(unit, unit.data.dir);
        break;

      case UnitBehavior.Hunt:
        this.behaviorHunt(unit);
        break;
      case UnitBehavior.Retreat:
        this.behaviorRetreat(unit);
        break;

      case UnitBehavior.TrapH: {
        // Randomly choose left/right if direction not set
        if (unit.data.dir === undefined) {
          unit.data.dir = this.rng.chance(0.5)
            ? Direction.Left
            : Direction.Right;
        }

        // When there's a unit on our path, interact with it
        const pointCopy: IPoint = {
          x: unit.position.x,
          y: unit.position.y,
        };
        applyDirection(pointCopy, unit.data.dir);

        // Either interact with the unit in our path, or move
        const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
        if (targetUnit === undefined) {
          // Flip direction when blocked
          if (this.isBlocked(unit, unit.data.dir)) {
            unit.data.dir = flipDirection(unit.data.dir);
          }
          this.moveUnit(unit, unit.data.dir);
        } else {
          this.interactUnits(unit, targetUnit);
          unit.data.dir = flipDirection(unit.data.dir);
        }
        break;
      }

      case UnitBehavior.TrapV: {
        // Randomly choose left/right if direction not set
        if (unit.data.dir === undefined) {
          unit.data.dir = this.rng.chance(0.5) ? Direction.Up : Direction.Down;
        }

        // When there's a unit on our path, interact with it
        const pointCopy: IPoint = {
          x: unit.position.x,
          y: unit.position.y,
        };
        applyDirection(pointCopy, unit.data.dir);

        // Either interact with the unit in our path, or move
        const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
        if (targetUnit === undefined) {
          // Flip direction when blocked
          if (this.isBlocked(unit, unit.data.dir)) {
            unit.data.dir = flipDirection(unit.data.dir);
          }
          this.moveUnit(unit, unit.data.dir);
        } else {
          this.interactUnits(unit, targetUnit);
          unit.data.dir = flipDirection(unit.data.dir);
        }
        break;
      }

      case UnitBehavior.FireSpout: {
        // Increment step
        if (unit.data.step === undefined) {
          unit.data.step = 0;
        }
        unit.data.step += 1;
        if (unit.data.step > 3) {
          unit.data.step = 1;
        }

        switch (unit.data.step) {
          case 1:
            // Do nothing
            console.log("wait");
            break;
          case 2:
            // Warn
            console.log("warn");
            break;
          case 3:
            // Spout
            console.log("spout");
            break;
        }
        break;
      }

      case UnitBehavior.StraightThenTurn: {
        // Randomly choose direction when not set
        const dirs = [
          Direction.Up,
          Direction.Right,
          Direction.Down,
          Direction.Left,
        ];
        if (unit.data.dir === undefined) {
          unit.data.dirStep = 0;
          unit.data.dir = dirs[unit.data.dirStep];
        }

        if (this.isBlocked(unit, unit.data.dir)) {
          // unit.data.dir = flipDirection(unit.data.dir);
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

  private behaviorRandom(unit: Unit) {
    // Pick a random, empty orthogonal cell
    const valid: Direction[] = [];
    for (let d = Direction.Up; d <= Direction.Left; ++d) {
      const target = new Vector2(unit.position.x, unit.position.y);
      applyDirection(target, d);
      const other = this.getUnitAt(target.x, target.y);
      if (other !== undefined && other.info.role === UnitRole.Player) {
        valid.length = 0;
        valid.push(d);
        break;
      } else if (!this.isBlocked(unit, d)) {
        valid.push(d);
      }
    }
    if (valid.length > 0) {
      const index = this.rng.integer(0, valid.length - 1);
      this.moveUnit(unit, valid[index]);
    }
  }

  private behaviorHunt(unit: Unit) {
    const direction = getUnitDirection(unit, this.player);
    if (this.isBlocked(unit, direction)) {
      this.behaviorRandom(unit);
    } else {
      this.moveUnit(unit, direction);
    }
  }

  private behaviorRetreat(unit: Unit) {
    const direction = flipDirection(getUnitDirection(unit, this.player));
    if (this.isBlocked(unit, direction)) {
      this.behaviorRandom(unit);
    } else {
      this.moveUnit(unit, direction);
    }
  }

  private getFromBag<T>(name: string): T {
    const bag = this.bags.get(name) as Bag<T>;
    if (bag !== undefined) {
      return bag.grab();
    } else {
      throw new Error(`Invalid bag: ${name}`);
    }
  }

  private addPlayerInventory(type: string, amount: number) {
    this.inventory.add(type, amount);
    this.onAction(
      WorldAction.PlayerInventoryChange,
      type,
      amount,
      this.inventory.get(type)
    );
  }

  private removePlayerInventory(
    type: string,
    amount: number,
    force = false
  ): boolean {
    const success = this.inventory.remove(type, amount, force);
    if (success) {
      this.onAction(
        WorldAction.PlayerInventoryChange,
        type,
        amount,
        this.inventory.get(type)
      );
    }
    return success;
  }

  /** Returns whether or not the player can make use of a given item in their current state */
  private canPlayerUseItem(item: Unit): boolean {
    const info = item.info;

    // Restrict usable items in skeleton form
    if (this.player.type === "player") {
      if (
        // Cannot use HP restoring items
        info.role === UnitRole.RestoreHealth ||
        // Cannot use food restoring items (except elixir_life)
        (info.role === UnitRole.Pickup &&
          info.data?.pickup.type === "food" &&
          item.type !== "elixir_life")
      ) {
        return false;
      }
    }

    // Player can use everything by default
    return true;
  }
}
