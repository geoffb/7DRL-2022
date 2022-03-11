import { Random } from "@mousepox/math";
import { Bag } from "./Bag";

export interface BagData<T> {
  [index: string]: T[];
}

export class BagSet<T> {
  private readonly rng: Random;

  private readonly bags: Map<string, Bag<T>>;

  constructor(rng: Random, bags: BagData<T>) {
    this.rng = rng;
    this.bags = new Map();
    for (const name in bags) {
      this.bags.set(name, new Bag(this.rng, bags[name]));
    }
  }

  public get(name: string): T {
    const bag = this.bags.get(name);
    if (bag !== undefined) {
      return bag.grab();
    } else {
      throw new Error(`Invalid bag: ${name}`);
    }
  }
}
