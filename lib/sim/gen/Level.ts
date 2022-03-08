import {
  StandardGenerator,
  Floor,
  RoomRole,
  RoomShapeSymbols,
} from "@mousepox/dungen";
import {
  Grid,
  Random,
  distance,
  // DirectionMask,
  // BitFlags,
  IPoint,
} from "@mousepox/math";

export interface LevelEntity {
  type: string;
  x: number;
  y: number;
}

interface RoomTemplates {
  size: number;
  roles: Record<string, Record<string, string[]>>;
  templates: Record<string, number[]>;
}

// interface OpenSpot {
//   x: number;
//   y: number;
//   openNeighbors: number;
//   originDistance: number;
//   random: number;
//   walls: number;
// }

const RoomRoles = ["generic", "start", "boss", "end"];

// interface GridCellOffset extends IPoint {
//   mask: DirectionMask;
// }

const enum TemplateTile {
  Floor = 0,
  Wall = 1,
  HintMonster = 8,
  HintTreasure = 9,
}

interface TemplateHint extends IPoint {
  random: number;
}

/** Cardinal and intercardinal adjacent cell offsets */
// const AdjacentOffsets: GridCellOffset[] = [
//   { x: -1, y: -1, mask: DirectionMask.NorthWest },
//   { x: 0, y: -1, mask: DirectionMask.North },
//   { x: 1, y: -1, mask: DirectionMask.NorthEast },
//   { x: -1, y: 0, mask: DirectionMask.West },
//   { x: 1, y: 0, mask: DirectionMask.East },
//   { x: -1, y: 1, mask: DirectionMask.SouthWest },
//   { x: 0, y: 1, mask: DirectionMask.South },
//   { x: 1, y: 1, mask: DirectionMask.SouthEast },
// ];

// const EnclosureMasks = [
//   DirectionMask.West | DirectionMask.North,
//   DirectionMask.South | DirectionMask.West,
//   DirectionMask.East | DirectionMask.South,
//   DirectionMask.North | DirectionMask.East,
//   DirectionMask.North | DirectionMask.West | DirectionMask.South,
//   DirectionMask.North | DirectionMask.South | DirectionMask.East,
//   DirectionMask.West | DirectionMask.South | DirectionMask.East,
//   DirectionMask.East | DirectionMask.North | DirectionMask.West,
// ];

// function getAdjacentFlags(grid: Grid, x: number, y: number): number {
//   let flags = 0;
//   const v = grid.get(x, y);
//   for (const offset of AdjacentOffsets) {
//     const ox = x + offset.x;
//     const oy = y + offset.y;
//     if (grid.valid(ox, oy) && grid.get(ox, oy) !== v) {
//       flags |= offset.mask;
//     }
//   }
//   return flags;
// }

export class Level {
  public readonly map = new Grid();

  public readonly entities: LevelEntity[] = [];

  private readonly random = new Random();

  private readonly rooms: RoomTemplates;

  private readonly hints: Map<TemplateTile, TemplateHint[]> = new Map();

  private readonly spawns = new Grid();

  private readonly start: IPoint = { x: 0, y: 0 };

  private readonly end: IPoint = { x: 0, y: 0 };

  private blueprint: Floor;

  private get roomSize(): number {
    return this.rooms.size;
  }

  constructor(rooms: RoomTemplates) {
    this.rooms = rooms;
  }

  public generate(width: number, height: number): void {
    // Clear entities
    this.entities.length = 0;

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
    this.placeTreasue();
    this.placeMonsters();
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
  }

  // private getOpenSpots(ox = 0, oy = 0): OpenSpot[] {
  //   const spots: OpenSpot[] = [];
  //   this.spawns.forEach((value, x, y) => {
  //     if (value !== 0) {
  //       return;
  //     }
  //     let walls = -1;
  //     let flags = getAdjacentFlags(this.map, x, y);
  //     for (let i = EnclosureMasks.length - 1; i >= 0; i--) {
  //       if ((flags & EnclosureMasks[i]) === EnclosureMasks[i]) {
  //         // console.log("found matching walls " + flags, EnclosureMasks[i]);
  //         walls = i;
  //         break;
  //       }
  //     }
  //     const random = this.random.next();
  //     const originDistance = distance(ox, oy, x, y);
  //     let openNeighbors = 0;
  //     this.spawns.forEachAdjacent(x, y, (av) => {
  //       if (av === 0) {
  //         openNeighbors++;
  //       }
  //     });
  //     spots.push({ x, y, openNeighbors, originDistance, random, walls });
  //   });
  //   return spots;
  // }

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
      } else {
        console.debug("not a valid spot", s, this.spawns.get(s.x, s.y));
      }
    }
    return spot;
  }

  private placeRoomGeometry(): void {
    for (const room of this.blueprint.getRooms()) {
      const role = RoomRoles[room.role];
      const templates = this.rooms.roles[role];

      const shape = RoomShapeSymbols[room.shape];
      const pool = templates[shape];

      const name = this.random.choice(pool);
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
      switch (cells[i]) {
        case TemplateTile.HintMonster:
        case TemplateTile.HintTreasure:
          this.addHint(
            cells[i],
            i % this.map.width,
            Math.floor(i / this.map.width)
          );
          cells[i] = TemplateTile.Floor;
          break;
      }
    }
  }

  private placeWarps(): void {
    // Place entrance
    const start = this.blueprint.getFirstRoom((r) => r.role === RoomRole.Start);
    if (start !== undefined) {
      this.start.x = Math.floor(start.x * this.roomSize + this.roomSize / 2);
      this.start.y = Math.floor(start.y * this.roomSize + this.roomSize / 2);
      this.placeEntity("stairsUp", this.start.x, this.start.y, 3);
    }

    // Place exit
    const end = this.blueprint.getFirstRoom((r) => r.role === RoomRole.End);
    if (end !== undefined) {
      this.end.x = Math.floor(end.x * this.roomSize + this.roomSize / 2);
      this.end.y = Math.floor(end.y * this.roomSize + this.roomSize / 2);
      this.placeEntity("stairsDown", this.end.x, this.end.y, 2);
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

    const count = Math.floor(
      (this.map.width / this.roomSize) * (this.map.height / this.roomSize)
    );
    for (let i = 0; i < count; i++) {
      const spot = this.popValidSpot(hints);
      if (spot !== undefined) {
        const type = this.random.choice(["gold1", "gold2", "crown", "chest"]);
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

    const count = Math.floor(
      (this.map.width / this.roomSize) * (this.map.height / this.roomSize) * 2
    );
    for (let i = 0; i < count; i++) {
      const spot = this.popValidSpot(hints);
      if (spot !== undefined) {
        const type = this.random.choice(["slime"]);
        this.placeEntity(type, spot.x, spot.y);
      }
    }
  }
}
