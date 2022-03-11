import {
  StandardGenerator,
  Floor,
  RoomRole,
  RoomShapeSymbols,
} from "@mousepox/dungen";
import { DataCache } from "@mousepox/jack";
import { Grid, Random, distance, IPoint } from "@mousepox/math";
import { BagSet } from "../BagSet";

export interface LevelEntity {
  type: string;
  x: number;
  y: number;
  forSale?: boolean;
}

interface RoomTemplates {
  size: number;
  templates: Record<string, number[]>;
}

interface Levels {
  [index: string]: {
    environment: string;
    width: number;
    height: number;
    start: IPoint;
    tiles: number[];
    entities?: LevelEntity[];
  };
}

const RoomRoles = ["generic", "start", "boss", "end"];

const enum TemplateTile {
  Floor = 0,
  Wall = 1,
  HintDoor = 7,
  HintMonster = 8,
  HintTreasure = 9,
}

interface TemplateHint extends IPoint {
  random: number;
}

export class Level {
  public readonly map = new Grid();

  public readonly entities: LevelEntity[] = [];

  private readonly bags: BagSet<string>;

  private readonly random = new Random();

  private readonly rooms: RoomTemplates;

  private readonly levels: Levels;

  private readonly hints: Map<TemplateTile, TemplateHint[]> = new Map();

  private readonly spawns = new Grid();

  public readonly start: IPoint = { x: 0, y: 0 };

  public readonly end: IPoint = { x: 0, y: 0 };

  public environment = "";

  private blueprint: Floor;

  private get roomSize(): number {
    return this.rooms.size;
  }

  private get roomCount(): number {
    return Math.floor(
      (this.map.width / this.roomSize) * (this.map.height / this.roomSize)
    );
  }

  constructor(data: DataCache, bags: BagSet<string>) {
    this.bags = bags;
    this.levels = data.get("data/levels.json");
    this.rooms = data.get("data/rooms.json");
  }

  /** Clear level state */
  public clear(): void {
    this.environment = "";
    this.map.resize(0, 0);
    this.map.fill(0);
    this.entities.length = 0;
  }

  /** Load a level from data */
  public load(name: string): void {
    this.clear();

    // Load level
    const level = this.levels[name];
    if (level === undefined) {
      console.error(`Invalid level: ${name}`);
      return;
    }

    // Set environment
    this.environment = level.environment;
    this.start.x = level.start.x;
    this.start.y = level.start.y;

    // Resize and populate map
    this.map.resize(level.width, level.height);
    this.map.cells = level.tiles.slice();

    // Populate entities
    if (level.entities !== undefined) {
      for (const entity of level.entities) {
        if (entity.type === "shopItem") {
          const type = this.bags.get("shop");
          this.entities.push({
            type,
            x: entity.x,
            y: entity.y,
            forSale: true,
          });
        } else {
          this.entities.push({
            type: entity.type,
            x: entity.x,
            y: entity.y,
          });
        }
      }
    }
  }

  public generate(width: number, height: number, environment: string): void {
    this.clear();

    this.environment = environment;

    // Generate blueprint
    const generator = new StandardGenerator(width, height);
    this.blueprint = generator.generate();

    // Resize map to fit generated blueprint
    this.map.resize(width * this.rooms.size, height * this.rooms.size);
    this.map.fill(1);

    // Update room geometry according to blueprint
    this.placeRoomGeometry();

    // Parse the map for entity placement hints
    this.parseHints();

    this.spawns.resize(this.map.width, this.map.height);
    this.map.forEach((value, x, y) =>
      this.spawns.set(x, y, value === 0 ? 0 : 1)
    );

    // Place entities
    this.placeWarps();
    this.placeDoors();
    this.placeTreasue();
    this.placeMonsters();
    this.placeMold();
  }

  private placeEntity(
    type: string,
    x: number,
    y: number,
    buffer?: number
  ): void {
    this.entities.push({ type, x, y });
    if (buffer === undefined) {
      // Restrict spawning at this location
      this.spawns.set(x, y, 1);
    } else {
      // Restrict spawning in a buffer radius around this location
      this.removeSpawns(x, y, buffer);
    }
  }

  private removeSpawns(x: number, y: number, buffer: number): void {
    this.spawns.forEachInArea(
      x - buffer,
      y - buffer,
      1 + buffer * 2,
      1 + buffer * 2,
      (_, tx, ty) => {
        if (distance(x, y, tx, ty) <= buffer) {
          this.spawns.set(tx, ty, 1);
        }
      }
    );
  }

  private addHint(type: TemplateTile, x: number, y: number): void {
    let hints = this.hints.get(type);
    if (hints === undefined) {
      hints = [];
      this.hints.set(type, hints);
    }
    hints.push({ x, y, random: this.random.next() });
  }

  private getHints(
    type: TemplateTile,
    sort?: (a: TemplateHint, b: TemplateHint) => number
  ): IPoint[] {
    const hints = this.hints.get(type) ?? [];
    if (sort !== undefined) {
      hints.sort(sort);
    }
    return hints;
  }

  private popValidSpot(spots: IPoint[]): IPoint | undefined {
    let spot: IPoint | undefined;
    while (spot === undefined && spots.length > 0) {
      const s = spots.pop();
      if (s === undefined) {
        break;
      }
      if (this.spawns.get(s.x, s.y) === 0) {
        spot = s;
      }
    }
    return spot;
  }

  private placeRoomGeometry(): void {
    for (const room of this.blueprint.getRooms()) {
      const role = RoomRoles[room.role];
      const shape = RoomShapeSymbols[room.shape];
      const name = this.bags.get(`rooms_${role}_${shape}`);
      const template = this.rooms.templates[name];

      const grid = new Grid(this.roomSize, this.roomSize);
      grid.cells = template.slice();

      // Apply room rotation
      if (room.rotation > 0) {
        grid.rotate(room.rotation);
      }

      // Paste final room grid into level map
      this.map.paste(grid, room.x * this.roomSize, room.y * this.roomSize);
    }
  }

  private parseHints(): void {
    const cells = this.map.cells;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] >= TemplateTile.HintDoor) {
        this.addHint(
          cells[i],
          i % this.map.width,
          Math.floor(i / this.map.width)
        );
        cells[i] = TemplateTile.Floor;
      }
    }
  }

  private placeWarps(): void {
    // Place entrance
    const start = this.blueprint.getFirstRoom((r) => r.role === RoomRole.Start);
    if (start !== undefined) {
      this.start.x = Math.floor(start.x * this.roomSize + this.roomSize / 2);
      this.start.y = Math.floor(start.y * this.roomSize + this.roomSize / 2);
      this.removeSpawns(this.start.x, this.start.y, 5);
    }

    // Place exit
    const end = this.blueprint.getFirstRoom((r) => r.role === RoomRole.End);
    if (end !== undefined) {
      this.end.x = Math.floor(end.x * this.roomSize + this.roomSize / 2);
      this.end.y = Math.floor(end.y * this.roomSize + this.roomSize / 2);
      this.placeEntity("stairsDown", this.end.x, this.end.y, 2);
    }
  }

  private placeDoors(): void {
    const hints = this.getHints(TemplateTile.HintDoor, (a, b) => {
      // Sort hints by a combined score of distance from start and end
      // Add a bit of randomization spice up the results
      const scoreA =
        distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
        distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
        a.random * 25;
      const scoreB =
        distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
        distance(this.end.x, this.end.y, b.x, b.y) * 0.3 +
        b.random * 25;
      return scoreA - scoreB;
    });

    const count = this.random.integer(0, 2);
    for (let i = 0; i < count; i++) {
      const spot = this.popValidSpot(hints);
      if (spot !== undefined) {
        const type = this.bags.get("doors");
        this.placeEntity(type, spot.x, spot.y);
      }
    }
  }

  private placeTreasue(): void {
    const hints = this.getHints(TemplateTile.HintTreasure, (a, b) => {
      // Sort hints by a combined score of distance from start and end
      // Add a bit of randomization spice up the results
      const scoreA =
        distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
        distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
        a.random * 25;
      const scoreB =
        distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
        distance(this.end.x, this.end.y, b.x, b.y) * 0.3 +
        b.random * 25;
      return scoreA - scoreB;
    });

    const count = this.roomCount;
    for (let i = 0; i < count; i++) {
      const spot = this.popValidSpot(hints);
      if (spot !== undefined) {
        const type = this.bags.get("treasure");
        this.placeEntity(type, spot.x, spot.y);
      }
    }
  }

  private placeMonsters(): void {
    const hints = this.getHints(TemplateTile.HintMonster, (a, b) => {
      // Sort hints by a combined score of distance from start and end
      // Add a bit of randomization spice up the results
      const scoreA =
        distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
        distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
        a.random * 25;
      const scoreB =
        distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
        distance(this.end.x, this.end.y, b.x, b.y) * 0.3 +
        b.random * 25;
      return scoreA - scoreB;
    });

    const count = this.roomCount * 2;
    for (let i = 0; i < count; i++) {
      const spot = this.popValidSpot(hints);
      if (spot !== undefined) {
        const type = this.bags.get("monsters");
        this.placeEntity(type, spot.x, spot.y);
      }
    }
  }

  private placeMold(): void {
    this.spawns.forEach((value, x, y) => {
      if (value === 0 && this.random.chance(0.2)) {
        this.placeEntity("mold", x, y);
      }
    });
  }
}
