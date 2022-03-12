export class Inventory {
    constructor() {
        this.items = new Map();
        this.onAdd = (_type) => {
            return;
        };
        this.onRemove = (_type) => {
            return;
        };
    }
    add(type, count) {
        const exists = this.items.get(type);
        if (exists === undefined) {
            this.items.set(type, count);
        }
        else {
            this.items.set(type, exists + count);
        }
    }
    get(type) {
        var _a;
        return (_a = this.items.get(type)) !== null && _a !== void 0 ? _a : 0;
    }
    has(type, count = 1) {
        const amount = this.items.get(type);
        return amount !== undefined && amount >= count;
    }
    remove(type, count, force = false) {
        const exists = this.items.get(type);
        if (force || (exists !== undefined && exists >= count)) {
            this.items.set(type, Math.max((exists !== null && exists !== void 0 ? exists : 0) - count, 0));
            return true;
        }
        else {
            return false;
        }
    }
    empty() {
        this.items.clear();
    }
}
