import { Vector2 } from "@mousepox/math";

export const enum UnitBehavior {
  Random = "random",
  MoveH = "move_horz",
  MoveV = "move_vert",
  Hunt = "hunt",
  Retreat = "retreat",
  TrapH = "trap_horz",
  TrapV = "trap_vert",
  FireSpout = "fire_spout",
  StraightThenTurn = "straight_then_turn",
  Spawner = "spawner",
  Replicate = "replicate",
}

export const enum UnitRole {
  Player = "player",
  Monster = "monster",
  Trap = "trap",
  Pickup = "pickup",
  Door = "door",
  RestoreHealth = "restore_health",
  CurePoison = "cure_poison",
  Warp = "warp",
  Doodad = "doodad",
}

export interface IUnitSerialization {
  type: string;
  x: number;
  y: number;
  data: { [index: string]: any };
  sale: boolean;
  ttl: number;
}

export interface IUnitInfo {
  behavior?: UnitBehavior;
  health: number;
  data?: any;
  drawOrder: number;
  name: string;
  role?: UnitRole;
  solid: boolean;
  sprite: number;
  corpse?: string;
  flat?: boolean;
}

/** A unit is a single entity within the world */
export class Unit {
  public static deserialize(data: IUnitSerialization, info: IUnitInfo): Unit {
    const unit = new Unit(data.type, info);
    unit.position.set(data.x, data.y);
    unit.data = data.data;
    unit.forSale = data.sale;
    unit.ttl = data.ttl;
    return unit;
  }

  /** Identifier */
  public id = 0;

  /** Type */
  public type: string;

  /** Position, in cell coordinates */
  public position = new Vector2();

  /** Current health */
  public health = 1;

  public data: { [index: string]: any } = {};

  /** Whether or not this unit is "sleeping" and cannot act */
  public asleep = false;

  public forSale = false;

  public ttl = -1;

  public readonly info: IUnitInfo;

  constructor(type: string, info: IUnitInfo) {
    this.type = type;
    this.info = info;
    this.health = info.health;
  }

  public serialize(): IUnitSerialization {
    return {
      data: this.data,
      sale: this.forSale,
      ttl: this.ttl,
      type: this.type,
      x: this.position.x,
      y: this.position.y,
    };
  }
}
