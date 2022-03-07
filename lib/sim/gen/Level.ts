import {
  StandardGenerator,
  Floor,
  RoomRole,
  RoomShapeSymbols,
} from "@mousepox/dungen";
import { Grid, Random, distance } from "@mousepox/math";

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

const RoomRoles = ["generic", "start", "boss", "end"];

export class Level {
  public readonly map = new Grid();

  public readonly entities: LevelEntity[] = [];

  private readonly random = new Random();

  private readonly rooms: RoomTemplates;

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

    // Place entities
    this.placeWarps();
    this.placeMonsters();
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
      if (room.rotation > 0) {
        grid.rotate(room.rotation);
      }

      this.map.paste(grid, room.x * this.roomSize, room.y * this.roomSize);
    }
  }

  private placeWarps(): void {
    // Place entrance
    const start = this.blueprint.getFirstRoom(
      (room) => room.role === RoomRole.Start
    );
    if (start !== undefined) {
      this.entities.push({
        type: "stairsUp",
        x: Math.floor(start.x * this.roomSize + this.roomSize / 2),
        y: Math.floor(start.y * this.roomSize + this.roomSize / 2),
      });
    }

    // Place exit
    const end = this.blueprint.getFirstRoom(
      (room) => room.role === RoomRole.End
    );
    if (end !== undefined) {
      this.entities.push({
        type: "stairsDown",
        x: Math.floor(end.x * this.roomSize + this.roomSize / 2),
        y: Math.floor(end.y * this.roomSize + this.roomSize / 2),
      });
    }
  }

  private placeMonsters(): void {
    this.map.forEach((tile, x, y) => {
      if (tile !== 0) {
        return;
      }
      if (this.random.chance(0.1)) {
        this.entities.push({
          type: "mold",
          x,
          y,
        });
      }
      // if (ctx.room.blocked(x, y)) {
      //   return;
      // }
      // const d = distance(x, y, ctx.room.player.x, ctx.room.player.y);
      // if (d >= 9 && ctx.random.chance(1 / 25)) {
      //   ctx.room.spawnEntity("guard", x, y);
      // } else if (d >= 20 && ctx.random.chance(1 / 40)) {
      //   ctx.room.spawnEntity("mob_drone", x, y);
      // }
    });
  }
}
