import { Vector2 } from "@mousepox/math";
export class Unit {
    constructor(type, info) {
        this.id = 0;
        this.position = new Vector2();
        this.health = 1;
        this.data = {};
        this.asleep = false;
        this.forSale = false;
        this.ttl = -1;
        this.type = type;
        this.info = info;
        this.health = info.health;
    }
    static deserialize(data, info) {
        const unit = new Unit(data.type, info);
        unit.position.set(data.x, data.y);
        unit.data = data.data;
        unit.forSale = data.sale;
        unit.ttl = data.ttl;
        return unit;
    }
    serialize() {
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
