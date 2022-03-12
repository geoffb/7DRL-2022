import { Bag } from "./Bag";
export class BagSet {
    constructor(rng, bags) {
        this.rng = rng;
        this.bags = new Map();
        for (const name in bags) {
            this.bags.set(name, new Bag(this.rng, bags[name]));
        }
    }
    get(name) {
        const bag = this.bags.get(name);
        if (bag !== undefined) {
            return bag.grab();
        }
        else {
            throw new Error(`Invalid bag: ${name}`);
        }
    }
}
