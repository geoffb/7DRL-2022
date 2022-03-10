export class Inventory {
  private items: Map<string, number> = new Map();

  public onAdd = (_type: string) => {
    return;
  };
  public onRemove = (_type: string) => {
    return;
  };

  public add(type: string, count: number) {
    const exists = this.items.get(type);
    if (exists === undefined) {
      this.items.set(type, count);
    } else {
      this.items.set(type, exists + count);
    }
  }

  public get(type: string): number {
    return this.items.get(type) ?? 0;
  }

  public has(type: string, count = 1): boolean {
    const amount = this.items.get(type);
    return amount !== undefined && amount >= count;
  }

  public remove(type: string, count: number, force = false): boolean {
    const exists = this.items.get(type);
    if (force || (exists !== undefined && exists >= count)) {
      this.items.set(type, Math.max((exists ?? 0) - count, 0));
      return true;
    } else {
      // Not enough of specified item
      return false;
    }
  }

  public empty() {
    this.items.clear();
  }
}
