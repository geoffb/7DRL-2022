import { Random } from "@mousepox/math";

export class Bag<T = unknown> {
  private readonly rng: Random;

  private readonly values: T[];

  private readonly items: T[] = [];

  constructor(rng: Random, values: T[]) {
    this.rng = rng;
    this.values = values;
    this.refill();
  }

  /** Grab a random item and remove it from the bag */
  public grab(): T {
    if (this.items.length < 1) {
      this.refill();
    }
    return this.rng.choice(this.items, true);
  }

  private refill() {
    this.items.push(...this.values);
  }
}
