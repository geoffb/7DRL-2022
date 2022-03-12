export class Bag {
    constructor(rng, values) {
        this.items = [];
        this.rng = rng;
        this.values = values;
        this.refill();
    }
    grab() {
        if (this.items.length < 1) {
            this.refill();
        }
        return this.rng.choice(this.items, true);
    }
    refill() {
        this.items.push(...this.values);
    }
}
