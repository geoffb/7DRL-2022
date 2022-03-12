import { StandardGenerator, RoomShapeSymbols, } from "@mousepox/dungen";
import { Grid, Random, distance } from "@mousepox/math";
const RoomRoles = ["generic", "start", "boss", "end"];
export class Level {
    constructor(data, bags) {
        this.map = new Grid();
        this.entities = [];
        this.random = new Random();
        this.hints = new Map();
        this.spawns = new Grid();
        this.start = { x: 0, y: 0 };
        this.end = { x: 0, y: 0 };
        this.environment = "";
        this.bags = bags;
        this.levels = data.get("data/levels.json");
        this.rooms = data.get("data/rooms.json");
        this.chunks = data.get("data/chunks.json");
    }
    get roomSize() {
        return this.rooms.size;
    }
    get roomCount() {
        return Math.floor((this.map.width / this.roomSize) * (this.map.height / this.roomSize));
    }
    clear() {
        this.environment = "";
        this.map.resize(0, 0);
        this.map.fill(0);
        this.entities.length = 0;
        this.hints.clear();
    }
    load(name) {
        this.clear();
        const level = this.levels[name];
        if (level === undefined) {
            console.error(`Invalid level: ${name}`);
            return;
        }
        this.environment = level.environment;
        this.start.x = level.start.x;
        this.start.y = level.start.y;
        this.map.resize(level.width, level.height);
        this.map.cells = level.tiles.slice();
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
                }
                else {
                    this.entities.push({
                        type: entity.type,
                        x: entity.x,
                        y: entity.y,
                    });
                }
            }
        }
    }
    generate(width, height, environment) {
        this.clear();
        this.environment = environment;
        const generator = new StandardGenerator(width, height);
        this.blueprint = generator.generate();
        this.map.resize(width * this.rooms.size, height * this.rooms.size);
        this.map.fill(1);
        this.placeRoomGeometry();
        this.parseHints();
        this.spawns.resize(this.map.width, this.map.height);
        this.map.forEach((value, x, y) => this.spawns.set(x, y, value === 0 ? 0 : 1));
        this.placeWarps();
        this.placeDoors();
        this.placeTreasue();
        this.placeMonsters();
        this.placeMold();
    }
    placeEntity(type, x, y, buffer) {
        this.entities.push({ type, x, y });
        if (buffer === undefined) {
            this.spawns.set(x, y, 1);
        }
        else {
            this.removeSpawns(x, y, buffer);
        }
    }
    removeSpawns(x, y, buffer) {
        this.spawns.forEachInArea(x - buffer, y - buffer, 1 + buffer * 2, 1 + buffer * 2, (_, tx, ty) => {
            if (distance(x, y, tx, ty) <= buffer) {
                this.spawns.set(tx, ty, 1);
            }
        });
    }
    addHint(type, x, y) {
        let hints = this.hints.get(type);
        if (hints === undefined) {
            hints = [];
            this.hints.set(type, hints);
        }
        hints.push({ x, y, random: this.random.next() });
    }
    getHints(type, sort) {
        var _a;
        const hints = (_a = this.hints.get(type)) !== null && _a !== void 0 ? _a : [];
        if (sort !== undefined) {
            hints.sort(sort);
        }
        return hints;
    }
    popValidSpot(spots) {
        let spot;
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
    placeRoomGeometry() {
        for (const room of this.blueprint.getRooms()) {
            const role = RoomRoles[room.role];
            const shape = RoomShapeSymbols[room.shape];
            const name = this.bags.get(`rooms_${role}_${shape}`);
            const template = this.rooms.templates[name];
            const roomGrid = new Grid(this.roomSize, this.roomSize);
            roomGrid.cells = template.slice();
            roomGrid.forEach((value, x, y) => {
                if (value === 5) {
                    const chunk = this.random.choice(this.chunks.templates);
                    const chunkGrid = new Grid(this.chunks.size, this.chunks.size);
                    chunkGrid.cells = chunk.slice();
                    const rot = this.random.integer(0, 3);
                    if (rot > 0) {
                        chunkGrid.rotate(rot);
                    }
                    roomGrid.paste(chunkGrid, x, y);
                }
            });
            if (room.rotation > 0) {
                roomGrid.rotate(room.rotation);
            }
            this.map.paste(roomGrid, room.x * this.roomSize, room.y * this.roomSize);
        }
    }
    parseHints() {
        const cells = this.map.cells;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] >= 7) {
                this.addHint(cells[i], i % this.map.width, Math.floor(i / this.map.width));
                cells[i] = 0;
            }
        }
    }
    placeWarps() {
        const start = this.blueprint.getFirstRoom((r) => r.role === 1);
        if (start !== undefined) {
            this.start.x = Math.floor(start.x * this.roomSize + this.roomSize / 2);
            this.start.y = Math.floor(start.y * this.roomSize + this.roomSize / 2);
            this.removeSpawns(this.start.x, this.start.y, 5);
        }
        const end = this.blueprint.getFirstRoom((r) => r.role === 3);
        if (end !== undefined) {
            this.end.x = Math.floor(end.x * this.roomSize + this.roomSize / 2);
            this.end.y = Math.floor(end.y * this.roomSize + this.roomSize / 2);
            this.placeEntity("stairsDown", this.end.x, this.end.y, 2);
        }
    }
    placeDoors() {
        const hints = this.getHints(7, (a, b) => {
            const scoreA = distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
                distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
                a.random * 25;
            const scoreB = distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
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
    placeTreasue() {
        const hints = this.getHints(9, (a, b) => {
            const scoreA = distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
                distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
                a.random * 25;
            const scoreB = distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
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
    placeMonsters() {
        const hints = this.getHints(8, (a, b) => {
            const scoreA = distance(this.start.x, this.start.y, a.x, a.y) * 0.8 +
                distance(this.end.x, this.end.y, a.x, a.y) * 0.3 +
                a.random * 25;
            const scoreB = distance(this.start.x, this.start.y, b.x, b.y) * 0.8 +
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
    placeMold() {
        this.spawns.forEach((value, x, y) => {
            if (value === 0 && this.random.chance(0.2)) {
                this.placeEntity("mold", x, y);
            }
        });
    }
}
