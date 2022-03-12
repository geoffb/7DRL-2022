(function () {
    'use strict';

    class ActionQueue {
        constructor() {
            this.handlers = new Map();
            this.queue = [];
            this.processing = 0;
        }
        get busy() {
            return this.processing > 0;
        }
        reset() {
            this.queue.length = 0;
            this.processing = 0;
        }
        handle(type, handler) {
            this.handlers.set(type, handler);
        }
        process(type, params, immediate = false) {
            const action = { type, params };
            if (immediate || !this.busy) {
                this.execute(action, !immediate);
            }
            else {
                this.queue.push(action);
            }
        }
        async execute(action, block = true) {
            const handler = this.handlers.get(action.type);
            if (handler === undefined) {
                return;
            }
            if (block) {
                this.processing++;
            }
            await handler(...action.params);
            if (block) {
                this.processing = Math.max(this.processing - 1, 0);
            }
            if (!this.busy) {
                const next = this.queue.shift();
                if (next !== undefined) {
                    this.execute(next);
                }
            }
        }
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    function distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    function manhattanDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    function lerp$1(a, b, t) {
        return a + ((b - a) * t);
    }

    class BitFlags {
        constructor(value) {
            this.value = value ?? 0;
        }
        clear() {
            this.value = 0;
        }
        set(mask) {
            this.value |= mask;
        }
        has(mask) {
            return (this.value & mask) !== 0;
        }
    }

    class Vector2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        static fromAngle(radians) {
            return new Vector2(Math.cos(radians), Math.sin(radians));
        }
        get angle() {
            return Math.atan2(this.y, this.x);
        }
        get magnitude() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }
        set(x, y) {
            this.x = x;
            this.y = y;
            return this;
        }
        add(p) {
            this.x += p.x;
            this.y += p.y;
            return this;
        }
        copy(p) {
            this.x = p.x;
            this.y = p.y;
            return this;
        }
        normalize() {
            const mag = this.magnitude;
            if (mag === 0) {
                return this;
            }
            else {
                return this.scale(1 / mag);
            }
        }
        scale(n) {
            this.x *= n;
            this.y *= n;
            return this;
        }
        subtract(p) {
            this.x -= p.x;
            this.y -= p.y;
            return this;
        }
        constrain(x, y, width, height) {
            this.x = clamp(this.x, x, x + width);
            this.y = clamp(this.y, y, y + height);
            return this;
        }
        rotate(angle, origin) {
            const ox = origin?.x ?? 0;
            const oy = origin?.y ?? 0;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = ((this.x - ox) * cos - (this.y - oy) * sin) + ox;
            const y = ((this.x - ox) * sin + (this.y - oy) * cos) + oy;
            return this.set(x, y);
        }
    }

    const ScratchBitFlags = new BitFlags();
    const ScratchVector2 = new Vector2();
    const OrthogonalAdjacentOffsets = [
        { x: 0, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
    ];
    const AdjacentOffsets = [
        { x: -1, y: -1, mask: 128 },
        { x: 0, y: -1, mask: 1 },
        { x: 1, y: -1, mask: 16 },
        { x: -1, y: 0, mask: 8 },
        { x: 1, y: 0, mask: 2 },
        { x: -1, y: 1, mask: 64 },
        { x: 0, y: 1, mask: 4 },
        { x: 1, y: 1, mask: 32 },
    ];
    class Grid {
        constructor(width = 0, height = 0) {
            this.width = 0;
            this.height = 0;
            this.cells = [];
            this.center = { x: 0, y: 0 };
            this.resize(width, height);
        }
        static fromStrings(rows, map) {
            const grid = new Grid(rows[0].length, rows.length);
            grid.forEach((_, x, y) => {
                grid.set(x, y, map.indexOf(rows[y][x]));
            });
            return grid;
        }
        resize(width, height) {
            this.width = width;
            this.height = height;
            this.center.x = Math.floor(width / 2);
            this.center.y = Math.floor(height / 2);
            this.cells.length = width * height;
            this.fill(0);
        }
        fill(value) {
            this.cells.fill(value);
        }
        valid(x, y) {
            return x >= 0 && y >= 0 && x < this.width && y < this.height;
        }
        get(x, y) {
            if (this.valid(x, y)) {
                const index = this.xyToIndex(x, y);
                return this.cells[index];
            }
            else {
                throw new Error(`Invalid cell coordinates: ${x}, ${y}`);
            }
        }
        getAdjacentFlags(x, y) {
            const v = this.get(x, y);
            ScratchBitFlags.clear();
            for (const offset of AdjacentOffsets) {
                const ox = x + offset.x;
                const oy = y + offset.y;
                if (!this.valid(ox, oy) || this.get(ox, oy) === v) {
                    ScratchBitFlags.set(offset.mask);
                }
            }
            return ScratchBitFlags.value;
        }
        set(x, y, value) {
            if (this.valid(x, y)) {
                const index = this.xyToIndex(x, y);
                this.setIndex(index, value);
            }
            else {
                throw new Error(`Invalid cell coordinates: ${x}, ${y}`);
            }
        }
        setIndex(index, value) {
            if (index >= 0 && index < this.cells.length) {
                this.cells[index] = value;
            }
            else {
                throw new Error(`Invalid cell index: ${index}`);
            }
        }
        copy(grid) {
            grid.forEach((value, x, y) => this.set(x, y, value));
        }
        forEach(handler) {
            const len = this.cells.length;
            for (let index = 0; index < len; ++index) {
                const x = this.indexToX(index);
                const y = this.indexToY(index);
                handler(this.get(x, y), x, y);
            }
        }
        forEachInArea(x, y, width, height, handler) {
            for (let iy = y; iy < y + height; ++iy) {
                for (let ix = x; ix < x + width; ++ix) {
                    if (!this.valid(ix, iy)) {
                        continue;
                    }
                    handler(this.get(ix, iy), ix, iy);
                }
            }
        }
        forEachAdjacent(x, y, handler) {
            for (const offset of OrthogonalAdjacentOffsets) {
                const ax = x + offset.x;
                const ay = y + offset.y;
                if (!this.valid(ax, ay)) {
                    continue;
                }
                handler(this.get(ax, ay), ax, ay);
            }
        }
        rotate(rotations = 1) {
            Scratch.resize(this.height, this.width);
            for (let i = 0; i < rotations; ++i) {
                for (let y = 0; y < this.height; ++y) {
                    for (let x = 0; x < this.width; ++x) {
                        Scratch.set(Scratch.width - y - 1, x, this.get(x, y));
                    }
                }
                this.copy(Scratch);
            }
        }
        rotatePoint(p, angle) {
            ScratchVector2.set(p.x, p.y);
            ScratchVector2.rotate(angle, this.center);
            p.x = Math.round(ScratchVector2.x);
            p.y = Math.round(ScratchVector2.y);
        }
        paste(grid, x, y) {
            grid.forEach((value, sx, sy) => {
                this.set(x + sx, y + sy, value);
            });
        }
        raycast(origin, direction, result) {
            if (result === undefined) {
                result = {
                    distance: 0,
                    side: 0,
                    value: undefined,
                };
            }
            else {
                result.distance = 0;
                result.side = 0;
                result.value = undefined;
            }
            let x = Math.floor(origin.x);
            let y = Math.floor(origin.y);
            const deltaDistX = Math.sqrt(1 + (direction.y * direction.y) / (direction.x * direction.x));
            const deltaDistY = Math.sqrt(1 + (direction.x * direction.x) / (direction.y * direction.y));
            let sideDistX = 0;
            let sideDistY = 0;
            let stepX = 0;
            let stepY = 0;
            let hit = false;
            if (direction.x < 0) {
                stepX = -1;
                sideDistX = (origin.x - x) * deltaDistX;
            }
            else {
                stepX = 1;
                sideDistX = (x + 1.0 - origin.x) * deltaDistX;
            }
            if (direction.y < 0) {
                stepY = -1;
                sideDistY = (origin.y - y) * deltaDistY;
            }
            else {
                stepY = 1;
                sideDistY = (y + 1.0 - origin.y) * deltaDistY;
            }
            while (!hit) {
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX;
                    x += stepX;
                    result.side = 0;
                }
                else {
                    sideDistY += deltaDistY;
                    y += stepY;
                    result.side = 1;
                }
                if (this.valid(x, y)) {
                    const value = this.get(x, y);
                    if (value !== 0) {
                        result.value = value;
                        hit = true;
                    }
                }
                else {
                    break;
                }
            }
            if (result.side === 0) {
                result.distance = (x - origin.x + (1 - stepX) / 2) / direction.x;
            }
            else {
                result.distance = (y - origin.y + (1 - stepY) / 2) / direction.y;
            }
            return result;
        }
        xyToIndex(x, y) {
            return (y * this.width) + x;
        }
        indexToX(index) {
            return index % this.width;
        }
        indexToY(index) {
            return Math.floor(index / this.width);
        }
    }
    const Scratch = new Grid();

    class AutoGrid extends Grid {
        constructor(source, rules) {
            super(source.width, source.height);
            this.source = source;
            this.rules = rules;
            this.update();
        }
        update() {
            this.forEach((_, x, y) => this.updateSingleCell(x, y));
        }
        updateSingleCell(x, y) {
            const tile = this.source.get(x, y);
            if (this.rules[tile] !== undefined) {
                const flags = this.source.getAdjacentFlags(x, y);
                if (this.rules[tile] !== undefined) {
                    for (const rule of this.rules[tile]) {
                        if (rule.flags.indexOf(flags) !== -1) {
                            let value = 0;
                            if (Array.isArray(rule.value)) {
                                const index = Math.floor(Math.random() * rule.value.length);
                                value = rule.value[index];
                            }
                            else {
                                value = rule.value;
                            }
                            this.set(x, y, value);
                            return;
                        }
                    }
                }
            }
            this.set(x, y, tile);
        }
    }

    const M = 0x80000000;
    const A = 1103515245;
    const C = 12345;
    const DiceNotationPattern = /([0-9]+)?d([0-9]+)([+-]{1}[0-9]+)?/;
    function parseDiceNotation(notation) {
        const matches = notation.match(DiceNotationPattern);
        if (matches === null) {
            throw new Error(`Invalid dice notation: ${notation}`);
        }
        return {
            bonus: Number(matches[3]),
            count: Number(matches[1]),
            sides: Number(matches[2]),
        };
    }
    class Random {
        constructor(seed) {
            this.state = 0;
            this.reset(seed);
        }
        static getDiceNotationRange(notation) {
            const { count, sides, bonus } = parseDiceNotation(notation);
            return {
                max: count * sides + bonus,
                min: count * 1 + bonus,
            };
        }
        reset(seed) {
            if (seed !== undefined) {
                this.state = seed;
            }
            else {
                this.state = Math.floor(Math.random() * (M - 1));
            }
        }
        next() {
            this.state = (A * this.state + C) % M;
            return this.state / M;
        }
        integer(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        chance(probability) {
            return this.next() <= probability;
        }
        choice(items, remove = false) {
            const index = this.integer(0, items.length - 1);
            const pick = items[index];
            if (remove) {
                items.splice(index, 1);
            }
            return pick;
        }
        shuffle(items) {
            const len = items.length;
            if (len < 2) {
                return;
            }
            for (let i = 0; i < len; ++i) {
                const j = this.integer(i, len - 1);
                const swap = items[i];
                items[i] = items[j];
                items[j] = swap;
            }
        }
        rollDiceNotation(notation) {
            const { count, sides, bonus } = parseDiceNotation(notation);
            let result = bonus;
            for (let i = 0; i < count; ++i) {
                result += this.integer(1, sides);
            }
            return result;
        }
    }

    class Actor {
        constructor() {
            this.position = new Vector2();
            this.drawOrder = 0;
            this.scale = new Vector2(1, 1);
            this.rotation = 0;
            this.parent = null;
            this.visible = true;
            this.opacity = 1;
            this.children = [];
        }
        dispose() {
            if (this.parent !== null) {
                this.parent.removeChild(this);
            }
            this.disposeChildren();
        }
        disposeChildren() {
            for (let i = this.children.length - 1; i >= 0; --i) {
                this.children[i].dispose();
                this.children.splice(i, 1);
            }
        }
        addChild(child) {
            child.parent = this;
            this.children.push(child);
            this.sortChildren();
        }
        removeChild(child) {
            if (child.parent === this) {
                child.parent = null;
            }
            const index = this.children.indexOf(child);
            if (index !== -1) {
                this.children.splice(index, 1);
            }
        }
        render(ctx) {
            if (!this.visible || this.opacity <= 0) {
                return;
            }
            ctx.save();
            if (this.position.x !== 0 || this.position.y !== 0) {
                ctx.translate(Math.round(this.position.x), Math.round(this.position.y));
            }
            if (this.rotation !== 0) {
                ctx.rotate(this.rotation);
            }
            if (this.scale.x !== 1 || this.scale.y !== 1) {
                ctx.scale(this.scale.x, this.scale.y);
            }
            if (this.opacity < 1) {
                ctx.globalAlpha = this.opacity;
            }
            this.renderSelf(ctx);
            for (const child of this.children) {
                child.render(ctx);
            }
            ctx.restore();
        }
        sortChildren() {
            this.children.sort((a, b) => {
                return a.drawOrder - b.drawOrder;
            });
        }
        renderSelf(_ctx) {
            return;
        }
    }

    class Box extends Actor {
        constructor(width, height, fillStyle, clip = false) {
            super();
            this.width = width;
            this.height = height;
            this.fillStyle = fillStyle;
            this.clip = clip;
        }
        renderSelf(ctx) {
            const x = -Math.round(this.width / 2);
            const y = -Math.round(this.height / 2);
            if (this.clip) {
                ctx.beginPath();
                ctx.rect(x, y, this.width, this.height);
                ctx.clip();
            }
            if (this.fillStyle !== undefined) {
                ctx.fillStyle = this.fillStyle;
                ctx.fillRect(x, y, this.width, this.height);
            }
        }
    }

    async function loadData(url) {
        const data = await fetch(url);
        return await data.json();
    }
    class DataCache {
        constructor() {
            this.data = new Map();
        }
        async load(url) {
            let data = this.data.get(url);
            if (data === undefined) {
                data = await loadData(url);
                this.data.set(url, data);
            }
            return data;
        }
        loadBatch(urls) {
            const batch = [];
            for (const url of urls) {
                batch.push(this.load(url));
            }
            return Promise.all(batch);
        }
        get(url) {
            const data = this.data.get(url);
            if (data !== undefined) {
                return data;
            }
            else {
                throw new Error(`[DataCache.get] Invalid data: ${url}`);
            }
        }
    }

    function lerp(a, b, t) {
        return a + ((b - a) * t);
    }
    class Tween {
        constructor(target) {
            this.queue = [];
            this.queueIndex = 0;
            this.target = target;
        }
        get complete() {
            return this.queueIndex >= this.queue.length;
        }
        call(callback) {
            this.queue.push({
                callback,
                type: 0,
            });
            return this;
        }
        to(props, duration, easing) {
            this.queue.push({
                duration,
                easing,
                elapsed: 0,
                from: {},
                to: props,
                type: 1,
            });
            return this;
        }
        update(dt) {
            while (dt > 0 && this.queueIndex < this.queue.length) {
                let used = 0;
                const item = this.queue[this.queueIndex];
                switch (item.type) {
                    case 0:
                        used = this.processCall(item);
                        break;
                    case 1:
                        used = this.processTo(item, dt);
                        break;
                    case 2:
                        used = this.processWait(item, dt);
                        break;
                    case 3:
                        this.processLoop(item);
                        break;
                }
                dt -= used;
            }
        }
        wait(duration) {
            this.queue.push({
                duration,
                elapsed: 0,
                type: 2,
            });
            return this;
        }
        loop(count = Infinity) {
            this.queue.push({
                count,
                type: 3,
            });
            return this;
        }
        promise() {
            return new Promise((resolve) => this.call(resolve));
        }
        processCall(tween) {
            tween.callback();
            this.queueIndex++;
            return 0;
        }
        processTo(tween, dt) {
            if (tween.elapsed === 0) {
                for (const key in tween.to) {
                    if (!tween.to.hasOwnProperty(key)) {
                        continue;
                    }
                    tween.from[key] = this.target[key];
                }
            }
            const used = Math.min(tween.duration - tween.elapsed, dt);
            tween.elapsed += used;
            let t = Math.min(tween.elapsed / tween.duration, 1);
            if (tween.easing) {
                t = tween.easing(t);
            }
            for (const key in tween.to) {
                if (!tween.to.hasOwnProperty(key)) {
                    continue;
                }
                this.target[key] = lerp(tween.from[key], tween.to[key], t);
            }
            if (tween.elapsed >= tween.duration) {
                tween.elapsed = 0;
                this.queueIndex++;
            }
            return used;
        }
        processWait(tween, dt) {
            const used = Math.min(tween.duration - tween.elapsed, dt);
            tween.elapsed += used;
            if (tween.elapsed >= tween.duration) {
                tween.elapsed = 0;
                this.queueIndex++;
            }
            return used;
        }
        processLoop(tween) {
            if (tween.count > 0) {
                tween.count--;
                this.queueIndex = 0;
            }
            else {
                this.queueIndex++;
            }
        }
    }

    class TweenGroup {
        constructor() {
            this.tweens = [];
        }
        add(tween) {
            this.tweens.push(tween);
        }
        cancel(target) {
            for (let i = this.tweens.length - 1; i >= 0; --i) {
                if (target === undefined || this.tweens[i].target === target) {
                    this.tweens.splice(i, 1);
                }
            }
        }
        create(target) {
            const tween = new Tween(target);
            this.tweens.push(tween);
            return tween;
        }
        update(dt) {
            const complete = [];
            for (let i = 0; i < this.tweens.length; ++i) {
                const tween = this.tweens[i];
                tween.update(dt);
                if (tween.complete) {
                    complete.push(i);
                }
            }
            for (let i = complete.length - 1; i >= 0; --i) {
                this.tweens.splice(complete[i], 1);
            }
        }
    }

    const Ease = {
        QuadIn(k) {
            return k * k;
        },
        QuadOut(k) {
            return k * (2 - k);
        },
        QuadInOut(k) {
            k *= 2;
            if (k < 1) {
                return 0.5 * k * k;
            }
            else {
                return -0.5 * (--k * (k - 2) - 1);
            }
        },
    };

    async function loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject();
            image.src = url;
        });
    }
    class ImageCache {
        constructor() {
            this.images = new Map();
        }
        async load(url) {
            let image = this.images.get(url);
            if (image === undefined) {
                image = await loadImage(url);
                this.images.set(url, image);
            }
            return image;
        }
        loadBatch(urls) {
            const batch = [];
            for (const url of urls) {
                batch.push(this.load(url));
            }
            return Promise.all(batch);
        }
        get(url) {
            const image = this.images.get(url);
            if (image !== undefined) {
                return image;
            }
            else {
                throw new Error(`[ImageCache.get] Invalid image: ${url}`);
            }
        }
    }

    class Keyboard {
        constructor(element) {
            this.keyTime = new Map();
            this.suppressed = [
                13, 32, 37, 38, 39, 40,
            ];
            this.frame = 0;
            this.firstInteract = false;
            this.onFirstInteract = () => undefined;
            this.element = element;
            this.element.addEventListener("keydown", this.keyDown.bind(this));
            this.element.addEventListener("keyup", this.keyUp.bind(this));
        }
        suppress(...keys) {
            for (const key of keys) {
                if (this.suppressed.indexOf(key) === -1) {
                    this.suppressed.push(key);
                }
            }
        }
        endFrame() {
            this.frame++;
        }
        getKeyState(keyCode, frames = 0) {
            const start = this.keyTime.get(keyCode);
            if (start !== undefined) {
                return (this.frame - start) <= frames;
            }
            else {
                return false;
            }
        }
        keyDown(ev) {
            if (!this.keyTime.has(ev.keyCode)) {
                this.keyTime.set(ev.keyCode, this.frame);
            }
            if (this.suppressed.indexOf(ev.keyCode) !== -1) {
                ev.preventDefault();
            }
            this.triggerFirstInteract();
        }
        keyUp(ev) {
            this.keyTime.delete(ev.keyCode);
            if (this.suppressed.indexOf(ev.keyCode) !== -1) {
                ev.preventDefault();
            }
            this.triggerFirstInteract();
        }
        triggerFirstInteract() {
            if (this.firstInteract) {
                return;
            }
            this.onFirstInteract();
            this.firstInteract = true;
        }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    var howler = {};

    /*!
     *  howler.js v2.2.3
     *  howlerjs.com
     *
     *  (c) 2013-2020, James Simpson of GoldFire Studios
     *  goldfirestudios.com
     *
     *  MIT License
     */

    (function (exports) {
    (function() {

      /** Global Methods **/
      /***************************************************************************/

      /**
       * Create the global controller. All contained methods and properties apply
       * to all sounds that are currently playing or will be in the future.
       */
      var HowlerGlobal = function() {
        this.init();
      };
      HowlerGlobal.prototype = {
        /**
         * Initialize the global Howler object.
         * @return {Howler}
         */
        init: function() {
          var self = this || Howler;

          // Create a global ID counter.
          self._counter = 1000;

          // Pool of unlocked HTML5 Audio objects.
          self._html5AudioPool = [];
          self.html5PoolSize = 10;

          // Internal properties.
          self._codecs = {};
          self._howls = [];
          self._muted = false;
          self._volume = 1;
          self._canPlayEvent = 'canplaythrough';
          self._navigator = (typeof window !== 'undefined' && window.navigator) ? window.navigator : null;

          // Public properties.
          self.masterGain = null;
          self.noAudio = false;
          self.usingWebAudio = true;
          self.autoSuspend = true;
          self.ctx = null;

          // Set to false to disable the auto audio unlocker.
          self.autoUnlock = true;

          // Setup the various state values for global tracking.
          self._setup();

          return self;
        },

        /**
         * Get/set the global volume for all sounds.
         * @param  {Float} vol Volume from 0.0 to 1.0.
         * @return {Howler/Float}     Returns self or current volume.
         */
        volume: function(vol) {
          var self = this || Howler;
          vol = parseFloat(vol);

          // If we don't have an AudioContext created yet, run the setup.
          if (!self.ctx) {
            setupAudioContext();
          }

          if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {
            self._volume = vol;

            // Don't update any of the nodes if we are muted.
            if (self._muted) {
              return self;
            }

            // When using Web Audio, we just need to adjust the master gain.
            if (self.usingWebAudio) {
              self.masterGain.gain.setValueAtTime(vol, Howler.ctx.currentTime);
            }

            // Loop through and change volume for all HTML5 audio nodes.
            for (var i=0; i<self._howls.length; i++) {
              if (!self._howls[i]._webAudio) {
                // Get all of the sounds in this Howl group.
                var ids = self._howls[i]._getSoundIds();

                // Loop through all sounds and change the volumes.
                for (var j=0; j<ids.length; j++) {
                  var sound = self._howls[i]._soundById(ids[j]);

                  if (sound && sound._node) {
                    sound._node.volume = sound._volume * vol;
                  }
                }
              }
            }

            return self;
          }

          return self._volume;
        },

        /**
         * Handle muting and unmuting globally.
         * @param  {Boolean} muted Is muted or not.
         */
        mute: function(muted) {
          var self = this || Howler;

          // If we don't have an AudioContext created yet, run the setup.
          if (!self.ctx) {
            setupAudioContext();
          }

          self._muted = muted;

          // With Web Audio, we just need to mute the master gain.
          if (self.usingWebAudio) {
            self.masterGain.gain.setValueAtTime(muted ? 0 : self._volume, Howler.ctx.currentTime);
          }

          // Loop through and mute all HTML5 Audio nodes.
          for (var i=0; i<self._howls.length; i++) {
            if (!self._howls[i]._webAudio) {
              // Get all of the sounds in this Howl group.
              var ids = self._howls[i]._getSoundIds();

              // Loop through all sounds and mark the audio node as muted.
              for (var j=0; j<ids.length; j++) {
                var sound = self._howls[i]._soundById(ids[j]);

                if (sound && sound._node) {
                  sound._node.muted = (muted) ? true : sound._muted;
                }
              }
            }
          }

          return self;
        },

        /**
         * Handle stopping all sounds globally.
         */
        stop: function() {
          var self = this || Howler;

          // Loop through all Howls and stop them.
          for (var i=0; i<self._howls.length; i++) {
            self._howls[i].stop();
          }

          return self;
        },

        /**
         * Unload and destroy all currently loaded Howl objects.
         * @return {Howler}
         */
        unload: function() {
          var self = this || Howler;

          for (var i=self._howls.length-1; i>=0; i--) {
            self._howls[i].unload();
          }

          // Create a new AudioContext to make sure it is fully reset.
          if (self.usingWebAudio && self.ctx && typeof self.ctx.close !== 'undefined') {
            self.ctx.close();
            self.ctx = null;
            setupAudioContext();
          }

          return self;
        },

        /**
         * Check for codec support of specific extension.
         * @param  {String} ext Audio file extention.
         * @return {Boolean}
         */
        codecs: function(ext) {
          return (this || Howler)._codecs[ext.replace(/^x-/, '')];
        },

        /**
         * Setup various state values for global tracking.
         * @return {Howler}
         */
        _setup: function() {
          var self = this || Howler;

          // Keeps track of the suspend/resume state of the AudioContext.
          self.state = self.ctx ? self.ctx.state || 'suspended' : 'suspended';

          // Automatically begin the 30-second suspend process
          self._autoSuspend();

          // Check if audio is available.
          if (!self.usingWebAudio) {
            // No audio is available on this system if noAudio is set to true.
            if (typeof Audio !== 'undefined') {
              try {
                var test = new Audio();

                // Check if the canplaythrough event is available.
                if (typeof test.oncanplaythrough === 'undefined') {
                  self._canPlayEvent = 'canplay';
                }
              } catch(e) {
                self.noAudio = true;
              }
            } else {
              self.noAudio = true;
            }
          }

          // Test to make sure audio isn't disabled in Internet Explorer.
          try {
            var test = new Audio();
            if (test.muted) {
              self.noAudio = true;
            }
          } catch (e) {}

          // Check for supported codecs.
          if (!self.noAudio) {
            self._setupCodecs();
          }

          return self;
        },

        /**
         * Check for browser support for various codecs and cache the results.
         * @return {Howler}
         */
        _setupCodecs: function() {
          var self = this || Howler;
          var audioTest = null;

          // Must wrap in a try/catch because IE11 in server mode throws an error.
          try {
            audioTest = (typeof Audio !== 'undefined') ? new Audio() : null;
          } catch (err) {
            return self;
          }

          if (!audioTest || typeof audioTest.canPlayType !== 'function') {
            return self;
          }

          var mpegTest = audioTest.canPlayType('audio/mpeg;').replace(/^no$/, '');

          // Opera version <33 has mixed MP3 support, so we need to check for and block it.
          var ua = self._navigator ? self._navigator.userAgent : '';
          var checkOpera = ua.match(/OPR\/([0-6].)/g);
          var isOldOpera = (checkOpera && parseInt(checkOpera[0].split('/')[1], 10) < 33);
          var checkSafari = ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1;
          var safariVersion = ua.match(/Version\/(.*?) /);
          var isOldSafari = (checkSafari && safariVersion && parseInt(safariVersion[1], 10) < 15);

          self._codecs = {
            mp3: !!(!isOldOpera && (mpegTest || audioTest.canPlayType('audio/mp3;').replace(/^no$/, ''))),
            mpeg: !!mpegTest,
            opus: !!audioTest.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ''),
            ogg: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
            oga: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
            wav: !!(audioTest.canPlayType('audio/wav; codecs="1"') || audioTest.canPlayType('audio/wav')).replace(/^no$/, ''),
            aac: !!audioTest.canPlayType('audio/aac;').replace(/^no$/, ''),
            caf: !!audioTest.canPlayType('audio/x-caf;').replace(/^no$/, ''),
            m4a: !!(audioTest.canPlayType('audio/x-m4a;') || audioTest.canPlayType('audio/m4a;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
            m4b: !!(audioTest.canPlayType('audio/x-m4b;') || audioTest.canPlayType('audio/m4b;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
            mp4: !!(audioTest.canPlayType('audio/x-mp4;') || audioTest.canPlayType('audio/mp4;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
            weba: !!(!isOldSafari && audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')),
            webm: !!(!isOldSafari && audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')),
            dolby: !!audioTest.canPlayType('audio/mp4; codecs="ec-3"').replace(/^no$/, ''),
            flac: !!(audioTest.canPlayType('audio/x-flac;') || audioTest.canPlayType('audio/flac;')).replace(/^no$/, '')
          };

          return self;
        },

        /**
         * Some browsers/devices will only allow audio to be played after a user interaction.
         * Attempt to automatically unlock audio on the first user interaction.
         * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/
         * @return {Howler}
         */
        _unlockAudio: function() {
          var self = this || Howler;

          // Only run this if Web Audio is supported and it hasn't already been unlocked.
          if (self._audioUnlocked || !self.ctx) {
            return;
          }

          self._audioUnlocked = false;
          self.autoUnlock = false;

          // Some mobile devices/platforms have distortion issues when opening/closing tabs and/or web views.
          // Bugs in the browser (especially Mobile Safari) can cause the sampleRate to change from 44100 to 48000.
          // By calling Howler.unload(), we create a new AudioContext with the correct sampleRate.
          if (!self._mobileUnloaded && self.ctx.sampleRate !== 44100) {
            self._mobileUnloaded = true;
            self.unload();
          }

          // Scratch buffer for enabling iOS to dispose of web audio buffers correctly, as per:
          // http://stackoverflow.com/questions/24119684
          self._scratchBuffer = self.ctx.createBuffer(1, 1, 22050);

          // Call this method on touch start to create and play a buffer,
          // then check if the audio actually played to determine if
          // audio has now been unlocked on iOS, Android, etc.
          var unlock = function(e) {
            // Create a pool of unlocked HTML5 Audio objects that can
            // be used for playing sounds without user interaction. HTML5
            // Audio objects must be individually unlocked, as opposed
            // to the WebAudio API which only needs a single activation.
            // This must occur before WebAudio setup or the source.onended
            // event will not fire.
            while (self._html5AudioPool.length < self.html5PoolSize) {
              try {
                var audioNode = new Audio();

                // Mark this Audio object as unlocked to ensure it can get returned
                // to the unlocked pool when released.
                audioNode._unlocked = true;

                // Add the audio node to the pool.
                self._releaseHtml5Audio(audioNode);
              } catch (e) {
                self.noAudio = true;
                break;
              }
            }

            // Loop through any assigned audio nodes and unlock them.
            for (var i=0; i<self._howls.length; i++) {
              if (!self._howls[i]._webAudio) {
                // Get all of the sounds in this Howl group.
                var ids = self._howls[i]._getSoundIds();

                // Loop through all sounds and unlock the audio nodes.
                for (var j=0; j<ids.length; j++) {
                  var sound = self._howls[i]._soundById(ids[j]);

                  if (sound && sound._node && !sound._node._unlocked) {
                    sound._node._unlocked = true;
                    sound._node.load();
                  }
                }
              }
            }

            // Fix Android can not play in suspend state.
            self._autoResume();

            // Create an empty buffer.
            var source = self.ctx.createBufferSource();
            source.buffer = self._scratchBuffer;
            source.connect(self.ctx.destination);

            // Play the empty buffer.
            if (typeof source.start === 'undefined') {
              source.noteOn(0);
            } else {
              source.start(0);
            }

            // Calling resume() on a stack initiated by user gesture is what actually unlocks the audio on Android Chrome >= 55.
            if (typeof self.ctx.resume === 'function') {
              self.ctx.resume();
            }

            // Setup a timeout to check that we are unlocked on the next event loop.
            source.onended = function() {
              source.disconnect(0);

              // Update the unlocked state and prevent this check from happening again.
              self._audioUnlocked = true;

              // Remove the touch start listener.
              document.removeEventListener('touchstart', unlock, true);
              document.removeEventListener('touchend', unlock, true);
              document.removeEventListener('click', unlock, true);
              document.removeEventListener('keydown', unlock, true);

              // Let all sounds know that audio has been unlocked.
              for (var i=0; i<self._howls.length; i++) {
                self._howls[i]._emit('unlock');
              }
            };
          };

          // Setup a touch start listener to attempt an unlock in.
          document.addEventListener('touchstart', unlock, true);
          document.addEventListener('touchend', unlock, true);
          document.addEventListener('click', unlock, true);
          document.addEventListener('keydown', unlock, true);

          return self;
        },

        /**
         * Get an unlocked HTML5 Audio object from the pool. If none are left,
         * return a new Audio object and throw a warning.
         * @return {Audio} HTML5 Audio object.
         */
        _obtainHtml5Audio: function() {
          var self = this || Howler;

          // Return the next object from the pool if one exists.
          if (self._html5AudioPool.length) {
            return self._html5AudioPool.pop();
          }

          //.Check if the audio is locked and throw a warning.
          var testPlay = new Audio().play();
          if (testPlay && typeof Promise !== 'undefined' && (testPlay instanceof Promise || typeof testPlay.then === 'function')) {
            testPlay.catch(function() {
              console.warn('HTML5 Audio pool exhausted, returning potentially locked audio object.');
            });
          }

          return new Audio();
        },

        /**
         * Return an activated HTML5 Audio object to the pool.
         * @return {Howler}
         */
        _releaseHtml5Audio: function(audio) {
          var self = this || Howler;

          // Don't add audio to the pool if we don't know if it has been unlocked.
          if (audio._unlocked) {
            self._html5AudioPool.push(audio);
          }

          return self;
        },

        /**
         * Automatically suspend the Web Audio AudioContext after no sound has played for 30 seconds.
         * This saves processing/energy and fixes various browser-specific bugs with audio getting stuck.
         * @return {Howler}
         */
        _autoSuspend: function() {
          var self = this;

          if (!self.autoSuspend || !self.ctx || typeof self.ctx.suspend === 'undefined' || !Howler.usingWebAudio) {
            return;
          }

          // Check if any sounds are playing.
          for (var i=0; i<self._howls.length; i++) {
            if (self._howls[i]._webAudio) {
              for (var j=0; j<self._howls[i]._sounds.length; j++) {
                if (!self._howls[i]._sounds[j]._paused) {
                  return self;
                }
              }
            }
          }

          if (self._suspendTimer) {
            clearTimeout(self._suspendTimer);
          }

          // If no sound has played after 30 seconds, suspend the context.
          self._suspendTimer = setTimeout(function() {
            if (!self.autoSuspend) {
              return;
            }

            self._suspendTimer = null;
            self.state = 'suspending';

            // Handle updating the state of the audio context after suspending.
            var handleSuspension = function() {
              self.state = 'suspended';

              if (self._resumeAfterSuspend) {
                delete self._resumeAfterSuspend;
                self._autoResume();
              }
            };

            // Either the state gets suspended or it is interrupted.
            // Either way, we need to update the state to suspended.
            self.ctx.suspend().then(handleSuspension, handleSuspension);
          }, 30000);

          return self;
        },

        /**
         * Automatically resume the Web Audio AudioContext when a new sound is played.
         * @return {Howler}
         */
        _autoResume: function() {
          var self = this;

          if (!self.ctx || typeof self.ctx.resume === 'undefined' || !Howler.usingWebAudio) {
            return;
          }

          if (self.state === 'running' && self.ctx.state !== 'interrupted' && self._suspendTimer) {
            clearTimeout(self._suspendTimer);
            self._suspendTimer = null;
          } else if (self.state === 'suspended' || self.state === 'running' && self.ctx.state === 'interrupted') {
            self.ctx.resume().then(function() {
              self.state = 'running';

              // Emit to all Howls that the audio has resumed.
              for (var i=0; i<self._howls.length; i++) {
                self._howls[i]._emit('resume');
              }
            });

            if (self._suspendTimer) {
              clearTimeout(self._suspendTimer);
              self._suspendTimer = null;
            }
          } else if (self.state === 'suspending') {
            self._resumeAfterSuspend = true;
          }

          return self;
        }
      };

      // Setup the global audio controller.
      var Howler = new HowlerGlobal();

      /** Group Methods **/
      /***************************************************************************/

      /**
       * Create an audio group controller.
       * @param {Object} o Passed in properties for this group.
       */
      var Howl = function(o) {
        var self = this;

        // Throw an error if no source is provided.
        if (!o.src || o.src.length === 0) {
          console.error('An array of source files must be passed with any new Howl.');
          return;
        }

        self.init(o);
      };
      Howl.prototype = {
        /**
         * Initialize a new Howl group object.
         * @param  {Object} o Passed in properties for this group.
         * @return {Howl}
         */
        init: function(o) {
          var self = this;

          // If we don't have an AudioContext created yet, run the setup.
          if (!Howler.ctx) {
            setupAudioContext();
          }

          // Setup user-defined default properties.
          self._autoplay = o.autoplay || false;
          self._format = (typeof o.format !== 'string') ? o.format : [o.format];
          self._html5 = o.html5 || false;
          self._muted = o.mute || false;
          self._loop = o.loop || false;
          self._pool = o.pool || 5;
          self._preload = (typeof o.preload === 'boolean' || o.preload === 'metadata') ? o.preload : true;
          self._rate = o.rate || 1;
          self._sprite = o.sprite || {};
          self._src = (typeof o.src !== 'string') ? o.src : [o.src];
          self._volume = o.volume !== undefined ? o.volume : 1;
          self._xhr = {
            method: o.xhr && o.xhr.method ? o.xhr.method : 'GET',
            headers: o.xhr && o.xhr.headers ? o.xhr.headers : null,
            withCredentials: o.xhr && o.xhr.withCredentials ? o.xhr.withCredentials : false,
          };

          // Setup all other default properties.
          self._duration = 0;
          self._state = 'unloaded';
          self._sounds = [];
          self._endTimers = {};
          self._queue = [];
          self._playLock = false;

          // Setup event listeners.
          self._onend = o.onend ? [{fn: o.onend}] : [];
          self._onfade = o.onfade ? [{fn: o.onfade}] : [];
          self._onload = o.onload ? [{fn: o.onload}] : [];
          self._onloaderror = o.onloaderror ? [{fn: o.onloaderror}] : [];
          self._onplayerror = o.onplayerror ? [{fn: o.onplayerror}] : [];
          self._onpause = o.onpause ? [{fn: o.onpause}] : [];
          self._onplay = o.onplay ? [{fn: o.onplay}] : [];
          self._onstop = o.onstop ? [{fn: o.onstop}] : [];
          self._onmute = o.onmute ? [{fn: o.onmute}] : [];
          self._onvolume = o.onvolume ? [{fn: o.onvolume}] : [];
          self._onrate = o.onrate ? [{fn: o.onrate}] : [];
          self._onseek = o.onseek ? [{fn: o.onseek}] : [];
          self._onunlock = o.onunlock ? [{fn: o.onunlock}] : [];
          self._onresume = [];

          // Web Audio or HTML5 Audio?
          self._webAudio = Howler.usingWebAudio && !self._html5;

          // Automatically try to enable audio.
          if (typeof Howler.ctx !== 'undefined' && Howler.ctx && Howler.autoUnlock) {
            Howler._unlockAudio();
          }

          // Keep track of this Howl group in the global controller.
          Howler._howls.push(self);

          // If they selected autoplay, add a play event to the load queue.
          if (self._autoplay) {
            self._queue.push({
              event: 'play',
              action: function() {
                self.play();
              }
            });
          }

          // Load the source file unless otherwise specified.
          if (self._preload && self._preload !== 'none') {
            self.load();
          }

          return self;
        },

        /**
         * Load the audio file.
         * @return {Howler}
         */
        load: function() {
          var self = this;
          var url = null;

          // If no audio is available, quit immediately.
          if (Howler.noAudio) {
            self._emit('loaderror', null, 'No audio support.');
            return;
          }

          // Make sure our source is in an array.
          if (typeof self._src === 'string') {
            self._src = [self._src];
          }

          // Loop through the sources and pick the first one that is compatible.
          for (var i=0; i<self._src.length; i++) {
            var ext, str;

            if (self._format && self._format[i]) {
              // If an extension was specified, use that instead.
              ext = self._format[i];
            } else {
              // Make sure the source is a string.
              str = self._src[i];
              if (typeof str !== 'string') {
                self._emit('loaderror', null, 'Non-string found in selected audio sources - ignoring.');
                continue;
              }

              // Extract the file extension from the URL or base64 data URI.
              ext = /^data:audio\/([^;,]+);/i.exec(str);
              if (!ext) {
                ext = /\.([^.]+)$/.exec(str.split('?', 1)[0]);
              }

              if (ext) {
                ext = ext[1].toLowerCase();
              }
            }

            // Log a warning if no extension was found.
            if (!ext) {
              console.warn('No file extension was found. Consider using the "format" property or specify an extension.');
            }

            // Check if this extension is available.
            if (ext && Howler.codecs(ext)) {
              url = self._src[i];
              break;
            }
          }

          if (!url) {
            self._emit('loaderror', null, 'No codec support for selected audio sources.');
            return;
          }

          self._src = url;
          self._state = 'loading';

          // If the hosting page is HTTPS and the source isn't,
          // drop down to HTML5 Audio to avoid Mixed Content errors.
          if (window.location.protocol === 'https:' && url.slice(0, 5) === 'http:') {
            self._html5 = true;
            self._webAudio = false;
          }

          // Create a new sound object and add it to the pool.
          new Sound(self);

          // Load and decode the audio data for playback.
          if (self._webAudio) {
            loadBuffer(self);
          }

          return self;
        },

        /**
         * Play a sound or resume previous playback.
         * @param  {String/Number} sprite   Sprite name for sprite playback or sound id to continue previous.
         * @param  {Boolean} internal Internal Use: true prevents event firing.
         * @return {Number}          Sound ID.
         */
        play: function(sprite, internal) {
          var self = this;
          var id = null;

          // Determine if a sprite, sound id or nothing was passed
          if (typeof sprite === 'number') {
            id = sprite;
            sprite = null;
          } else if (typeof sprite === 'string' && self._state === 'loaded' && !self._sprite[sprite]) {
            // If the passed sprite doesn't exist, do nothing.
            return null;
          } else if (typeof sprite === 'undefined') {
            // Use the default sound sprite (plays the full audio length).
            sprite = '__default';

            // Check if there is a single paused sound that isn't ended.
            // If there is, play that sound. If not, continue as usual.
            if (!self._playLock) {
              var num = 0;
              for (var i=0; i<self._sounds.length; i++) {
                if (self._sounds[i]._paused && !self._sounds[i]._ended) {
                  num++;
                  id = self._sounds[i]._id;
                }
              }

              if (num === 1) {
                sprite = null;
              } else {
                id = null;
              }
            }
          }

          // Get the selected node, or get one from the pool.
          var sound = id ? self._soundById(id) : self._inactiveSound();

          // If the sound doesn't exist, do nothing.
          if (!sound) {
            return null;
          }

          // Select the sprite definition.
          if (id && !sprite) {
            sprite = sound._sprite || '__default';
          }

          // If the sound hasn't loaded, we must wait to get the audio's duration.
          // We also need to wait to make sure we don't run into race conditions with
          // the order of function calls.
          if (self._state !== 'loaded') {
            // Set the sprite value on this sound.
            sound._sprite = sprite;

            // Mark this sound as not ended in case another sound is played before this one loads.
            sound._ended = false;

            // Add the sound to the queue to be played on load.
            var soundId = sound._id;
            self._queue.push({
              event: 'play',
              action: function() {
                self.play(soundId);
              }
            });

            return soundId;
          }

          // Don't play the sound if an id was passed and it is already playing.
          if (id && !sound._paused) {
            // Trigger the play event, in order to keep iterating through queue.
            if (!internal) {
              self._loadQueue('play');
            }

            return sound._id;
          }

          // Make sure the AudioContext isn't suspended, and resume it if it is.
          if (self._webAudio) {
            Howler._autoResume();
          }

          // Determine how long to play for and where to start playing.
          var seek = Math.max(0, sound._seek > 0 ? sound._seek : self._sprite[sprite][0] / 1000);
          var duration = Math.max(0, ((self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000) - seek);
          var timeout = (duration * 1000) / Math.abs(sound._rate);
          var start = self._sprite[sprite][0] / 1000;
          var stop = (self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000;
          sound._sprite = sprite;

          // Mark the sound as ended instantly so that this async playback
          // doesn't get grabbed by another call to play while this one waits to start.
          sound._ended = false;

          // Update the parameters of the sound.
          var setParams = function() {
            sound._paused = false;
            sound._seek = seek;
            sound._start = start;
            sound._stop = stop;
            sound._loop = !!(sound._loop || self._sprite[sprite][2]);
          };

          // End the sound instantly if seek is at the end.
          if (seek >= stop) {
            self._ended(sound);
            return;
          }

          // Begin the actual playback.
          var node = sound._node;
          if (self._webAudio) {
            // Fire this when the sound is ready to play to begin Web Audio playback.
            var playWebAudio = function() {
              self._playLock = false;
              setParams();
              self._refreshBuffer(sound);

              // Setup the playback params.
              var vol = (sound._muted || self._muted) ? 0 : sound._volume;
              node.gain.setValueAtTime(vol, Howler.ctx.currentTime);
              sound._playStart = Howler.ctx.currentTime;

              // Play the sound using the supported method.
              if (typeof node.bufferSource.start === 'undefined') {
                sound._loop ? node.bufferSource.noteGrainOn(0, seek, 86400) : node.bufferSource.noteGrainOn(0, seek, duration);
              } else {
                sound._loop ? node.bufferSource.start(0, seek, 86400) : node.bufferSource.start(0, seek, duration);
              }

              // Start a new timer if none is present.
              if (timeout !== Infinity) {
                self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
              }

              if (!internal) {
                setTimeout(function() {
                  self._emit('play', sound._id);
                  self._loadQueue();
                }, 0);
              }
            };

            if (Howler.state === 'running' && Howler.ctx.state !== 'interrupted') {
              playWebAudio();
            } else {
              self._playLock = true;

              // Wait for the audio context to resume before playing.
              self.once('resume', playWebAudio);

              // Cancel the end timer.
              self._clearTimer(sound._id);
            }
          } else {
            // Fire this when the sound is ready to play to begin HTML5 Audio playback.
            var playHtml5 = function() {
              node.currentTime = seek;
              node.muted = sound._muted || self._muted || Howler._muted || node.muted;
              node.volume = sound._volume * Howler.volume();
              node.playbackRate = sound._rate;

              // Some browsers will throw an error if this is called without user interaction.
              try {
                var play = node.play();

                // Support older browsers that don't support promises, and thus don't have this issue.
                if (play && typeof Promise !== 'undefined' && (play instanceof Promise || typeof play.then === 'function')) {
                  // Implements a lock to prevent DOMException: The play() request was interrupted by a call to pause().
                  self._playLock = true;

                  // Set param values immediately.
                  setParams();

                  // Releases the lock and executes queued actions.
                  play
                    .then(function() {
                      self._playLock = false;
                      node._unlocked = true;
                      if (!internal) {
                        self._emit('play', sound._id);
                      } else {
                        self._loadQueue();
                      }
                    })
                    .catch(function() {
                      self._playLock = false;
                      self._emit('playerror', sound._id, 'Playback was unable to start. This is most commonly an issue ' +
                        'on mobile devices and Chrome where playback was not within a user interaction.');

                      // Reset the ended and paused values.
                      sound._ended = true;
                      sound._paused = true;
                    });
                } else if (!internal) {
                  self._playLock = false;
                  setParams();
                  self._emit('play', sound._id);
                }

                // Setting rate before playing won't work in IE, so we set it again here.
                node.playbackRate = sound._rate;

                // If the node is still paused, then we can assume there was a playback issue.
                if (node.paused) {
                  self._emit('playerror', sound._id, 'Playback was unable to start. This is most commonly an issue ' +
                    'on mobile devices and Chrome where playback was not within a user interaction.');
                  return;
                }

                // Setup the end timer on sprites or listen for the ended event.
                if (sprite !== '__default' || sound._loop) {
                  self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
                } else {
                  self._endTimers[sound._id] = function() {
                    // Fire ended on this audio node.
                    self._ended(sound);

                    // Clear this listener.
                    node.removeEventListener('ended', self._endTimers[sound._id], false);
                  };
                  node.addEventListener('ended', self._endTimers[sound._id], false);
                }
              } catch (err) {
                self._emit('playerror', sound._id, err);
              }
            };

            // If this is streaming audio, make sure the src is set and load again.
            if (node.src === 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA') {
              node.src = self._src;
              node.load();
            }

            // Play immediately if ready, or wait for the 'canplaythrough'e vent.
            var loadedNoReadyState = (window && window.ejecta) || (!node.readyState && Howler._navigator.isCocoonJS);
            if (node.readyState >= 3 || loadedNoReadyState) {
              playHtml5();
            } else {
              self._playLock = true;
              self._state = 'loading';

              var listener = function() {
                self._state = 'loaded';
                
                // Begin playback.
                playHtml5();

                // Clear this listener.
                node.removeEventListener(Howler._canPlayEvent, listener, false);
              };
              node.addEventListener(Howler._canPlayEvent, listener, false);

              // Cancel the end timer.
              self._clearTimer(sound._id);
            }
          }

          return sound._id;
        },

        /**
         * Pause playback and save current position.
         * @param  {Number} id The sound ID (empty to pause all in group).
         * @return {Howl}
         */
        pause: function(id) {
          var self = this;

          // If the sound hasn't loaded or a play() promise is pending, add it to the load queue to pause when capable.
          if (self._state !== 'loaded' || self._playLock) {
            self._queue.push({
              event: 'pause',
              action: function() {
                self.pause(id);
              }
            });

            return self;
          }

          // If no id is passed, get all ID's to be paused.
          var ids = self._getSoundIds(id);

          for (var i=0; i<ids.length; i++) {
            // Clear the end timer.
            self._clearTimer(ids[i]);

            // Get the sound.
            var sound = self._soundById(ids[i]);

            if (sound && !sound._paused) {
              // Reset the seek position.
              sound._seek = self.seek(ids[i]);
              sound._rateSeek = 0;
              sound._paused = true;

              // Stop currently running fades.
              self._stopFade(ids[i]);

              if (sound._node) {
                if (self._webAudio) {
                  // Make sure the sound has been created.
                  if (!sound._node.bufferSource) {
                    continue;
                  }

                  if (typeof sound._node.bufferSource.stop === 'undefined') {
                    sound._node.bufferSource.noteOff(0);
                  } else {
                    sound._node.bufferSource.stop(0);
                  }

                  // Clean up the buffer source.
                  self._cleanBuffer(sound._node);
                } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {
                  sound._node.pause();
                }
              }
            }

            // Fire the pause event, unless `true` is passed as the 2nd argument.
            if (!arguments[1]) {
              self._emit('pause', sound ? sound._id : null);
            }
          }

          return self;
        },

        /**
         * Stop playback and reset to start.
         * @param  {Number} id The sound ID (empty to stop all in group).
         * @param  {Boolean} internal Internal Use: true prevents event firing.
         * @return {Howl}
         */
        stop: function(id, internal) {
          var self = this;

          // If the sound hasn't loaded, add it to the load queue to stop when capable.
          if (self._state !== 'loaded' || self._playLock) {
            self._queue.push({
              event: 'stop',
              action: function() {
                self.stop(id);
              }
            });

            return self;
          }

          // If no id is passed, get all ID's to be stopped.
          var ids = self._getSoundIds(id);

          for (var i=0; i<ids.length; i++) {
            // Clear the end timer.
            self._clearTimer(ids[i]);

            // Get the sound.
            var sound = self._soundById(ids[i]);

            if (sound) {
              // Reset the seek position.
              sound._seek = sound._start || 0;
              sound._rateSeek = 0;
              sound._paused = true;
              sound._ended = true;

              // Stop currently running fades.
              self._stopFade(ids[i]);

              if (sound._node) {
                if (self._webAudio) {
                  // Make sure the sound's AudioBufferSourceNode has been created.
                  if (sound._node.bufferSource) {
                    if (typeof sound._node.bufferSource.stop === 'undefined') {
                      sound._node.bufferSource.noteOff(0);
                    } else {
                      sound._node.bufferSource.stop(0);
                    }

                    // Clean up the buffer source.
                    self._cleanBuffer(sound._node);
                  }
                } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {
                  sound._node.currentTime = sound._start || 0;
                  sound._node.pause();

                  // If this is a live stream, stop download once the audio is stopped.
                  if (sound._node.duration === Infinity) {
                    self._clearSound(sound._node);
                  }
                }
              }

              if (!internal) {
                self._emit('stop', sound._id);
              }
            }
          }

          return self;
        },

        /**
         * Mute/unmute a single sound or all sounds in this Howl group.
         * @param  {Boolean} muted Set to true to mute and false to unmute.
         * @param  {Number} id    The sound ID to update (omit to mute/unmute all).
         * @return {Howl}
         */
        mute: function(muted, id) {
          var self = this;

          // If the sound hasn't loaded, add it to the load queue to mute when capable.
          if (self._state !== 'loaded'|| self._playLock) {
            self._queue.push({
              event: 'mute',
              action: function() {
                self.mute(muted, id);
              }
            });

            return self;
          }

          // If applying mute/unmute to all sounds, update the group's value.
          if (typeof id === 'undefined') {
            if (typeof muted === 'boolean') {
              self._muted = muted;
            } else {
              return self._muted;
            }
          }

          // If no id is passed, get all ID's to be muted.
          var ids = self._getSoundIds(id);

          for (var i=0; i<ids.length; i++) {
            // Get the sound.
            var sound = self._soundById(ids[i]);

            if (sound) {
              sound._muted = muted;

              // Cancel active fade and set the volume to the end value.
              if (sound._interval) {
                self._stopFade(sound._id);
              }

              if (self._webAudio && sound._node) {
                sound._node.gain.setValueAtTime(muted ? 0 : sound._volume, Howler.ctx.currentTime);
              } else if (sound._node) {
                sound._node.muted = Howler._muted ? true : muted;
              }

              self._emit('mute', sound._id);
            }
          }

          return self;
        },

        /**
         * Get/set the volume of this sound or of the Howl group. This method can optionally take 0, 1 or 2 arguments.
         *   volume() -> Returns the group's volume value.
         *   volume(id) -> Returns the sound id's current volume.
         *   volume(vol) -> Sets the volume of all sounds in this Howl group.
         *   volume(vol, id) -> Sets the volume of passed sound id.
         * @return {Howl/Number} Returns self or current volume.
         */
        volume: function() {
          var self = this;
          var args = arguments;
          var vol, id;

          // Determine the values based on arguments.
          if (args.length === 0) {
            // Return the value of the groups' volume.
            return self._volume;
          } else if (args.length === 1 || args.length === 2 && typeof args[1] === 'undefined') {
            // First check if this is an ID, and if not, assume it is a new volume.
            var ids = self._getSoundIds();
            var index = ids.indexOf(args[0]);
            if (index >= 0) {
              id = parseInt(args[0], 10);
            } else {
              vol = parseFloat(args[0]);
            }
          } else if (args.length >= 2) {
            vol = parseFloat(args[0]);
            id = parseInt(args[1], 10);
          }

          // Update the volume or return the current volume.
          var sound;
          if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {
            // If the sound hasn't loaded, add it to the load queue to change volume when capable.
            if (self._state !== 'loaded'|| self._playLock) {
              self._queue.push({
                event: 'volume',
                action: function() {
                  self.volume.apply(self, args);
                }
              });

              return self;
            }

            // Set the group volume.
            if (typeof id === 'undefined') {
              self._volume = vol;
            }

            // Update one or all volumes.
            id = self._getSoundIds(id);
            for (var i=0; i<id.length; i++) {
              // Get the sound.
              sound = self._soundById(id[i]);

              if (sound) {
                sound._volume = vol;

                // Stop currently running fades.
                if (!args[2]) {
                  self._stopFade(id[i]);
                }

                if (self._webAudio && sound._node && !sound._muted) {
                  sound._node.gain.setValueAtTime(vol, Howler.ctx.currentTime);
                } else if (sound._node && !sound._muted) {
                  sound._node.volume = vol * Howler.volume();
                }

                self._emit('volume', sound._id);
              }
            }
          } else {
            sound = id ? self._soundById(id) : self._sounds[0];
            return sound ? sound._volume : 0;
          }

          return self;
        },

        /**
         * Fade a currently playing sound between two volumes (if no id is passed, all sounds will fade).
         * @param  {Number} from The value to fade from (0.0 to 1.0).
         * @param  {Number} to   The volume to fade to (0.0 to 1.0).
         * @param  {Number} len  Time in milliseconds to fade.
         * @param  {Number} id   The sound id (omit to fade all sounds).
         * @return {Howl}
         */
        fade: function(from, to, len, id) {
          var self = this;

          // If the sound hasn't loaded, add it to the load queue to fade when capable.
          if (self._state !== 'loaded' || self._playLock) {
            self._queue.push({
              event: 'fade',
              action: function() {
                self.fade(from, to, len, id);
              }
            });

            return self;
          }

          // Make sure the to/from/len values are numbers.
          from = Math.min(Math.max(0, parseFloat(from)), 1);
          to = Math.min(Math.max(0, parseFloat(to)), 1);
          len = parseFloat(len);

          // Set the volume to the start position.
          self.volume(from, id);

          // Fade the volume of one or all sounds.
          var ids = self._getSoundIds(id);
          for (var i=0; i<ids.length; i++) {
            // Get the sound.
            var sound = self._soundById(ids[i]);

            // Create a linear fade or fall back to timeouts with HTML5 Audio.
            if (sound) {
              // Stop the previous fade if no sprite is being used (otherwise, volume handles this).
              if (!id) {
                self._stopFade(ids[i]);
              }

              // If we are using Web Audio, let the native methods do the actual fade.
              if (self._webAudio && !sound._muted) {
                var currentTime = Howler.ctx.currentTime;
                var end = currentTime + (len / 1000);
                sound._volume = from;
                sound._node.gain.setValueAtTime(from, currentTime);
                sound._node.gain.linearRampToValueAtTime(to, end);
              }

              self._startFadeInterval(sound, from, to, len, ids[i], typeof id === 'undefined');
            }
          }

          return self;
        },

        /**
         * Starts the internal interval to fade a sound.
         * @param  {Object} sound Reference to sound to fade.
         * @param  {Number} from The value to fade from (0.0 to 1.0).
         * @param  {Number} to   The volume to fade to (0.0 to 1.0).
         * @param  {Number} len  Time in milliseconds to fade.
         * @param  {Number} id   The sound id to fade.
         * @param  {Boolean} isGroup   If true, set the volume on the group.
         */
        _startFadeInterval: function(sound, from, to, len, id, isGroup) {
          var self = this;
          var vol = from;
          var diff = to - from;
          var steps = Math.abs(diff / 0.01);
          var stepLen = Math.max(4, (steps > 0) ? len / steps : len);
          var lastTick = Date.now();

          // Store the value being faded to.
          sound._fadeTo = to;

          // Update the volume value on each interval tick.
          sound._interval = setInterval(function() {
            // Update the volume based on the time since the last tick.
            var tick = (Date.now() - lastTick) / len;
            lastTick = Date.now();
            vol += diff * tick;

            // Round to within 2 decimal points.
            vol = Math.round(vol * 100) / 100;

            // Make sure the volume is in the right bounds.
            if (diff < 0) {
              vol = Math.max(to, vol);
            } else {
              vol = Math.min(to, vol);
            }

            // Change the volume.
            if (self._webAudio) {
              sound._volume = vol;
            } else {
              self.volume(vol, sound._id, true);
            }

            // Set the group's volume.
            if (isGroup) {
              self._volume = vol;
            }

            // When the fade is complete, stop it and fire event.
            if ((to < from && vol <= to) || (to > from && vol >= to)) {
              clearInterval(sound._interval);
              sound._interval = null;
              sound._fadeTo = null;
              self.volume(to, sound._id);
              self._emit('fade', sound._id);
            }
          }, stepLen);
        },

        /**
         * Internal method that stops the currently playing fade when
         * a new fade starts, volume is changed or the sound is stopped.
         * @param  {Number} id The sound id.
         * @return {Howl}
         */
        _stopFade: function(id) {
          var self = this;
          var sound = self._soundById(id);

          if (sound && sound._interval) {
            if (self._webAudio) {
              sound._node.gain.cancelScheduledValues(Howler.ctx.currentTime);
            }

            clearInterval(sound._interval);
            sound._interval = null;
            self.volume(sound._fadeTo, id);
            sound._fadeTo = null;
            self._emit('fade', id);
          }

          return self;
        },

        /**
         * Get/set the loop parameter on a sound. This method can optionally take 0, 1 or 2 arguments.
         *   loop() -> Returns the group's loop value.
         *   loop(id) -> Returns the sound id's loop value.
         *   loop(loop) -> Sets the loop value for all sounds in this Howl group.
         *   loop(loop, id) -> Sets the loop value of passed sound id.
         * @return {Howl/Boolean} Returns self or current loop value.
         */
        loop: function() {
          var self = this;
          var args = arguments;
          var loop, id, sound;

          // Determine the values for loop and id.
          if (args.length === 0) {
            // Return the grou's loop value.
            return self._loop;
          } else if (args.length === 1) {
            if (typeof args[0] === 'boolean') {
              loop = args[0];
              self._loop = loop;
            } else {
              // Return this sound's loop value.
              sound = self._soundById(parseInt(args[0], 10));
              return sound ? sound._loop : false;
            }
          } else if (args.length === 2) {
            loop = args[0];
            id = parseInt(args[1], 10);
          }

          // If no id is passed, get all ID's to be looped.
          var ids = self._getSoundIds(id);
          for (var i=0; i<ids.length; i++) {
            sound = self._soundById(ids[i]);

            if (sound) {
              sound._loop = loop;
              if (self._webAudio && sound._node && sound._node.bufferSource) {
                sound._node.bufferSource.loop = loop;
                if (loop) {
                  sound._node.bufferSource.loopStart = sound._start || 0;
                  sound._node.bufferSource.loopEnd = sound._stop;

                  // If playing, restart playback to ensure looping updates.
                  if (self.playing(ids[i])) {
                    self.pause(ids[i], true);
                    self.play(ids[i], true);
                  }
                }
              }
            }
          }

          return self;
        },

        /**
         * Get/set the playback rate of a sound. This method can optionally take 0, 1 or 2 arguments.
         *   rate() -> Returns the first sound node's current playback rate.
         *   rate(id) -> Returns the sound id's current playback rate.
         *   rate(rate) -> Sets the playback rate of all sounds in this Howl group.
         *   rate(rate, id) -> Sets the playback rate of passed sound id.
         * @return {Howl/Number} Returns self or the current playback rate.
         */
        rate: function() {
          var self = this;
          var args = arguments;
          var rate, id;

          // Determine the values based on arguments.
          if (args.length === 0) {
            // We will simply return the current rate of the first node.
            id = self._sounds[0]._id;
          } else if (args.length === 1) {
            // First check if this is an ID, and if not, assume it is a new rate value.
            var ids = self._getSoundIds();
            var index = ids.indexOf(args[0]);
            if (index >= 0) {
              id = parseInt(args[0], 10);
            } else {
              rate = parseFloat(args[0]);
            }
          } else if (args.length === 2) {
            rate = parseFloat(args[0]);
            id = parseInt(args[1], 10);
          }

          // Update the playback rate or return the current value.
          var sound;
          if (typeof rate === 'number') {
            // If the sound hasn't loaded, add it to the load queue to change playback rate when capable.
            if (self._state !== 'loaded' || self._playLock) {
              self._queue.push({
                event: 'rate',
                action: function() {
                  self.rate.apply(self, args);
                }
              });

              return self;
            }

            // Set the group rate.
            if (typeof id === 'undefined') {
              self._rate = rate;
            }

            // Update one or all volumes.
            id = self._getSoundIds(id);
            for (var i=0; i<id.length; i++) {
              // Get the sound.
              sound = self._soundById(id[i]);

              if (sound) {
                // Keep track of our position when the rate changed and update the playback
                // start position so we can properly adjust the seek position for time elapsed.
                if (self.playing(id[i])) {
                  sound._rateSeek = self.seek(id[i]);
                  sound._playStart = self._webAudio ? Howler.ctx.currentTime : sound._playStart;
                }
                sound._rate = rate;

                // Change the playback rate.
                if (self._webAudio && sound._node && sound._node.bufferSource) {
                  sound._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
                } else if (sound._node) {
                  sound._node.playbackRate = rate;
                }

                // Reset the timers.
                var seek = self.seek(id[i]);
                var duration = ((self._sprite[sound._sprite][0] + self._sprite[sound._sprite][1]) / 1000) - seek;
                var timeout = (duration * 1000) / Math.abs(sound._rate);

                // Start a new end timer if sound is already playing.
                if (self._endTimers[id[i]] || !sound._paused) {
                  self._clearTimer(id[i]);
                  self._endTimers[id[i]] = setTimeout(self._ended.bind(self, sound), timeout);
                }

                self._emit('rate', sound._id);
              }
            }
          } else {
            sound = self._soundById(id);
            return sound ? sound._rate : self._rate;
          }

          return self;
        },

        /**
         * Get/set the seek position of a sound. This method can optionally take 0, 1 or 2 arguments.
         *   seek() -> Returns the first sound node's current seek position.
         *   seek(id) -> Returns the sound id's current seek position.
         *   seek(seek) -> Sets the seek position of the first sound node.
         *   seek(seek, id) -> Sets the seek position of passed sound id.
         * @return {Howl/Number} Returns self or the current seek position.
         */
        seek: function() {
          var self = this;
          var args = arguments;
          var seek, id;

          // Determine the values based on arguments.
          if (args.length === 0) {
            // We will simply return the current position of the first node.
            if (self._sounds.length) {
              id = self._sounds[0]._id;
            }
          } else if (args.length === 1) {
            // First check if this is an ID, and if not, assume it is a new seek position.
            var ids = self._getSoundIds();
            var index = ids.indexOf(args[0]);
            if (index >= 0) {
              id = parseInt(args[0], 10);
            } else if (self._sounds.length) {
              id = self._sounds[0]._id;
              seek = parseFloat(args[0]);
            }
          } else if (args.length === 2) {
            seek = parseFloat(args[0]);
            id = parseInt(args[1], 10);
          }

          // If there is no ID, bail out.
          if (typeof id === 'undefined') {
            return 0;
          }

          // If the sound hasn't loaded, add it to the load queue to seek when capable.
          if (typeof seek === 'number' && (self._state !== 'loaded' || self._playLock)) {
            self._queue.push({
              event: 'seek',
              action: function() {
                self.seek.apply(self, args);
              }
            });

            return self;
          }

          // Get the sound.
          var sound = self._soundById(id);

          if (sound) {
            if (typeof seek === 'number' && seek >= 0) {
              // Pause the sound and update position for restarting playback.
              var playing = self.playing(id);
              if (playing) {
                self.pause(id, true);
              }

              // Move the position of the track and cancel timer.
              sound._seek = seek;
              sound._ended = false;
              self._clearTimer(id);

              // Update the seek position for HTML5 Audio.
              if (!self._webAudio && sound._node && !isNaN(sound._node.duration)) {
                sound._node.currentTime = seek;
              }

              // Seek and emit when ready.
              var seekAndEmit = function() {
                // Restart the playback if the sound was playing.
                if (playing) {
                  self.play(id, true);
                }

                self._emit('seek', id);
              };

              // Wait for the play lock to be unset before emitting (HTML5 Audio).
              if (playing && !self._webAudio) {
                var emitSeek = function() {
                  if (!self._playLock) {
                    seekAndEmit();
                  } else {
                    setTimeout(emitSeek, 0);
                  }
                };
                setTimeout(emitSeek, 0);
              } else {
                seekAndEmit();
              }
            } else {
              if (self._webAudio) {
                var realTime = self.playing(id) ? Howler.ctx.currentTime - sound._playStart : 0;
                var rateSeek = sound._rateSeek ? sound._rateSeek - sound._seek : 0;
                return sound._seek + (rateSeek + realTime * Math.abs(sound._rate));
              } else {
                return sound._node.currentTime;
              }
            }
          }

          return self;
        },

        /**
         * Check if a specific sound is currently playing or not (if id is provided), or check if at least one of the sounds in the group is playing or not.
         * @param  {Number}  id The sound id to check. If none is passed, the whole sound group is checked.
         * @return {Boolean} True if playing and false if not.
         */
        playing: function(id) {
          var self = this;

          // Check the passed sound ID (if any).
          if (typeof id === 'number') {
            var sound = self._soundById(id);
            return sound ? !sound._paused : false;
          }

          // Otherwise, loop through all sounds and check if any are playing.
          for (var i=0; i<self._sounds.length; i++) {
            if (!self._sounds[i]._paused) {
              return true;
            }
          }

          return false;
        },

        /**
         * Get the duration of this sound. Passing a sound id will return the sprite duration.
         * @param  {Number} id The sound id to check. If none is passed, return full source duration.
         * @return {Number} Audio duration in seconds.
         */
        duration: function(id) {
          var self = this;
          var duration = self._duration;

          // If we pass an ID, get the sound and return the sprite length.
          var sound = self._soundById(id);
          if (sound) {
            duration = self._sprite[sound._sprite][1] / 1000;
          }

          return duration;
        },

        /**
         * Returns the current loaded state of this Howl.
         * @return {String} 'unloaded', 'loading', 'loaded'
         */
        state: function() {
          return this._state;
        },

        /**
         * Unload and destroy the current Howl object.
         * This will immediately stop all sound instances attached to this group.
         */
        unload: function() {
          var self = this;

          // Stop playing any active sounds.
          var sounds = self._sounds;
          for (var i=0; i<sounds.length; i++) {
            // Stop the sound if it is currently playing.
            if (!sounds[i]._paused) {
              self.stop(sounds[i]._id);
            }

            // Remove the source or disconnect.
            if (!self._webAudio) {
              // Set the source to 0-second silence to stop any downloading (except in IE).
              self._clearSound(sounds[i]._node);

              // Remove any event listeners.
              sounds[i]._node.removeEventListener('error', sounds[i]._errorFn, false);
              sounds[i]._node.removeEventListener(Howler._canPlayEvent, sounds[i]._loadFn, false);
              sounds[i]._node.removeEventListener('ended', sounds[i]._endFn, false);

              // Release the Audio object back to the pool.
              Howler._releaseHtml5Audio(sounds[i]._node);
            }

            // Empty out all of the nodes.
            delete sounds[i]._node;

            // Make sure all timers are cleared out.
            self._clearTimer(sounds[i]._id);
          }

          // Remove the references in the global Howler object.
          var index = Howler._howls.indexOf(self);
          if (index >= 0) {
            Howler._howls.splice(index, 1);
          }

          // Delete this sound from the cache (if no other Howl is using it).
          var remCache = true;
          for (i=0; i<Howler._howls.length; i++) {
            if (Howler._howls[i]._src === self._src || self._src.indexOf(Howler._howls[i]._src) >= 0) {
              remCache = false;
              break;
            }
          }

          if (cache && remCache) {
            delete cache[self._src];
          }

          // Clear global errors.
          Howler.noAudio = false;

          // Clear out `self`.
          self._state = 'unloaded';
          self._sounds = [];
          self = null;

          return null;
        },

        /**
         * Listen to a custom event.
         * @param  {String}   event Event name.
         * @param  {Function} fn    Listener to call.
         * @param  {Number}   id    (optional) Only listen to events for this sound.
         * @param  {Number}   once  (INTERNAL) Marks event to fire only once.
         * @return {Howl}
         */
        on: function(event, fn, id, once) {
          var self = this;
          var events = self['_on' + event];

          if (typeof fn === 'function') {
            events.push(once ? {id: id, fn: fn, once: once} : {id: id, fn: fn});
          }

          return self;
        },

        /**
         * Remove a custom event. Call without parameters to remove all events.
         * @param  {String}   event Event name.
         * @param  {Function} fn    Listener to remove. Leave empty to remove all.
         * @param  {Number}   id    (optional) Only remove events for this sound.
         * @return {Howl}
         */
        off: function(event, fn, id) {
          var self = this;
          var events = self['_on' + event];
          var i = 0;

          // Allow passing just an event and ID.
          if (typeof fn === 'number') {
            id = fn;
            fn = null;
          }

          if (fn || id) {
            // Loop through event store and remove the passed function.
            for (i=0; i<events.length; i++) {
              var isId = (id === events[i].id);
              if (fn === events[i].fn && isId || !fn && isId) {
                events.splice(i, 1);
                break;
              }
            }
          } else if (event) {
            // Clear out all events of this type.
            self['_on' + event] = [];
          } else {
            // Clear out all events of every type.
            var keys = Object.keys(self);
            for (i=0; i<keys.length; i++) {
              if ((keys[i].indexOf('_on') === 0) && Array.isArray(self[keys[i]])) {
                self[keys[i]] = [];
              }
            }
          }

          return self;
        },

        /**
         * Listen to a custom event and remove it once fired.
         * @param  {String}   event Event name.
         * @param  {Function} fn    Listener to call.
         * @param  {Number}   id    (optional) Only listen to events for this sound.
         * @return {Howl}
         */
        once: function(event, fn, id) {
          var self = this;

          // Setup the event listener.
          self.on(event, fn, id, 1);

          return self;
        },

        /**
         * Emit all events of a specific type and pass the sound id.
         * @param  {String} event Event name.
         * @param  {Number} id    Sound ID.
         * @param  {Number} msg   Message to go with event.
         * @return {Howl}
         */
        _emit: function(event, id, msg) {
          var self = this;
          var events = self['_on' + event];

          // Loop through event store and fire all functions.
          for (var i=events.length-1; i>=0; i--) {
            // Only fire the listener if the correct ID is used.
            if (!events[i].id || events[i].id === id || event === 'load') {
              setTimeout(function(fn) {
                fn.call(this, id, msg);
              }.bind(self, events[i].fn), 0);

              // If this event was setup with `once`, remove it.
              if (events[i].once) {
                self.off(event, events[i].fn, events[i].id);
              }
            }
          }

          // Pass the event type into load queue so that it can continue stepping.
          self._loadQueue(event);

          return self;
        },

        /**
         * Queue of actions initiated before the sound has loaded.
         * These will be called in sequence, with the next only firing
         * after the previous has finished executing (even if async like play).
         * @return {Howl}
         */
        _loadQueue: function(event) {
          var self = this;

          if (self._queue.length > 0) {
            var task = self._queue[0];

            // Remove this task if a matching event was passed.
            if (task.event === event) {
              self._queue.shift();
              self._loadQueue();
            }

            // Run the task if no event type is passed.
            if (!event) {
              task.action();
            }
          }

          return self;
        },

        /**
         * Fired when playback ends at the end of the duration.
         * @param  {Sound} sound The sound object to work with.
         * @return {Howl}
         */
        _ended: function(sound) {
          var self = this;
          var sprite = sound._sprite;

          // If we are using IE and there was network latency we may be clipping
          // audio before it completes playing. Lets check the node to make sure it
          // believes it has completed, before ending the playback.
          if (!self._webAudio && sound._node && !sound._node.paused && !sound._node.ended && sound._node.currentTime < sound._stop) {
            setTimeout(self._ended.bind(self, sound), 100);
            return self;
          }

          // Should this sound loop?
          var loop = !!(sound._loop || self._sprite[sprite][2]);

          // Fire the ended event.
          self._emit('end', sound._id);

          // Restart the playback for HTML5 Audio loop.
          if (!self._webAudio && loop) {
            self.stop(sound._id, true).play(sound._id);
          }

          // Restart this timer if on a Web Audio loop.
          if (self._webAudio && loop) {
            self._emit('play', sound._id);
            sound._seek = sound._start || 0;
            sound._rateSeek = 0;
            sound._playStart = Howler.ctx.currentTime;

            var timeout = ((sound._stop - sound._start) * 1000) / Math.abs(sound._rate);
            self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
          }

          // Mark the node as paused.
          if (self._webAudio && !loop) {
            sound._paused = true;
            sound._ended = true;
            sound._seek = sound._start || 0;
            sound._rateSeek = 0;
            self._clearTimer(sound._id);

            // Clean up the buffer source.
            self._cleanBuffer(sound._node);

            // Attempt to auto-suspend AudioContext if no sounds are still playing.
            Howler._autoSuspend();
          }

          // When using a sprite, end the track.
          if (!self._webAudio && !loop) {
            self.stop(sound._id, true);
          }

          return self;
        },

        /**
         * Clear the end timer for a sound playback.
         * @param  {Number} id The sound ID.
         * @return {Howl}
         */
        _clearTimer: function(id) {
          var self = this;

          if (self._endTimers[id]) {
            // Clear the timeout or remove the ended listener.
            if (typeof self._endTimers[id] !== 'function') {
              clearTimeout(self._endTimers[id]);
            } else {
              var sound = self._soundById(id);
              if (sound && sound._node) {
                sound._node.removeEventListener('ended', self._endTimers[id], false);
              }
            }

            delete self._endTimers[id];
          }

          return self;
        },

        /**
         * Return the sound identified by this ID, or return null.
         * @param  {Number} id Sound ID
         * @return {Object}    Sound object or null.
         */
        _soundById: function(id) {
          var self = this;

          // Loop through all sounds and find the one with this ID.
          for (var i=0; i<self._sounds.length; i++) {
            if (id === self._sounds[i]._id) {
              return self._sounds[i];
            }
          }

          return null;
        },

        /**
         * Return an inactive sound from the pool or create a new one.
         * @return {Sound} Sound playback object.
         */
        _inactiveSound: function() {
          var self = this;

          self._drain();

          // Find the first inactive node to recycle.
          for (var i=0; i<self._sounds.length; i++) {
            if (self._sounds[i]._ended) {
              return self._sounds[i].reset();
            }
          }

          // If no inactive node was found, create a new one.
          return new Sound(self);
        },

        /**
         * Drain excess inactive sounds from the pool.
         */
        _drain: function() {
          var self = this;
          var limit = self._pool;
          var cnt = 0;
          var i = 0;

          // If there are less sounds than the max pool size, we are done.
          if (self._sounds.length < limit) {
            return;
          }

          // Count the number of inactive sounds.
          for (i=0; i<self._sounds.length; i++) {
            if (self._sounds[i]._ended) {
              cnt++;
            }
          }

          // Remove excess inactive sounds, going in reverse order.
          for (i=self._sounds.length - 1; i>=0; i--) {
            if (cnt <= limit) {
              return;
            }

            if (self._sounds[i]._ended) {
              // Disconnect the audio source when using Web Audio.
              if (self._webAudio && self._sounds[i]._node) {
                self._sounds[i]._node.disconnect(0);
              }

              // Remove sounds until we have the pool size.
              self._sounds.splice(i, 1);
              cnt--;
            }
          }
        },

        /**
         * Get all ID's from the sounds pool.
         * @param  {Number} id Only return one ID if one is passed.
         * @return {Array}    Array of IDs.
         */
        _getSoundIds: function(id) {
          var self = this;

          if (typeof id === 'undefined') {
            var ids = [];
            for (var i=0; i<self._sounds.length; i++) {
              ids.push(self._sounds[i]._id);
            }

            return ids;
          } else {
            return [id];
          }
        },

        /**
         * Load the sound back into the buffer source.
         * @param  {Sound} sound The sound object to work with.
         * @return {Howl}
         */
        _refreshBuffer: function(sound) {
          var self = this;

          // Setup the buffer source for playback.
          sound._node.bufferSource = Howler.ctx.createBufferSource();
          sound._node.bufferSource.buffer = cache[self._src];

          // Connect to the correct node.
          if (sound._panner) {
            sound._node.bufferSource.connect(sound._panner);
          } else {
            sound._node.bufferSource.connect(sound._node);
          }

          // Setup looping and playback rate.
          sound._node.bufferSource.loop = sound._loop;
          if (sound._loop) {
            sound._node.bufferSource.loopStart = sound._start || 0;
            sound._node.bufferSource.loopEnd = sound._stop || 0;
          }
          sound._node.bufferSource.playbackRate.setValueAtTime(sound._rate, Howler.ctx.currentTime);

          return self;
        },

        /**
         * Prevent memory leaks by cleaning up the buffer source after playback.
         * @param  {Object} node Sound's audio node containing the buffer source.
         * @return {Howl}
         */
        _cleanBuffer: function(node) {
          var self = this;
          var isIOS = Howler._navigator && Howler._navigator.vendor.indexOf('Apple') >= 0;

          if (Howler._scratchBuffer && node.bufferSource) {
            node.bufferSource.onended = null;
            node.bufferSource.disconnect(0);
            if (isIOS) {
              try { node.bufferSource.buffer = Howler._scratchBuffer; } catch(e) {}
            }
          }
          node.bufferSource = null;

          return self;
        },

        /**
         * Set the source to a 0-second silence to stop any downloading (except in IE).
         * @param  {Object} node Audio node to clear.
         */
        _clearSound: function(node) {
          var checkIE = /MSIE |Trident\//.test(Howler._navigator && Howler._navigator.userAgent);
          if (!checkIE) {
            node.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
          }
        }
      };

      /** Single Sound Methods **/
      /***************************************************************************/

      /**
       * Setup the sound object, which each node attached to a Howl group is contained in.
       * @param {Object} howl The Howl parent group.
       */
      var Sound = function(howl) {
        this._parent = howl;
        this.init();
      };
      Sound.prototype = {
        /**
         * Initialize a new Sound object.
         * @return {Sound}
         */
        init: function() {
          var self = this;
          var parent = self._parent;

          // Setup the default parameters.
          self._muted = parent._muted;
          self._loop = parent._loop;
          self._volume = parent._volume;
          self._rate = parent._rate;
          self._seek = 0;
          self._paused = true;
          self._ended = true;
          self._sprite = '__default';

          // Generate a unique ID for this sound.
          self._id = ++Howler._counter;

          // Add itself to the parent's pool.
          parent._sounds.push(self);

          // Create the new node.
          self.create();

          return self;
        },

        /**
         * Create and setup a new sound object, whether HTML5 Audio or Web Audio.
         * @return {Sound}
         */
        create: function() {
          var self = this;
          var parent = self._parent;
          var volume = (Howler._muted || self._muted || self._parent._muted) ? 0 : self._volume;

          if (parent._webAudio) {
            // Create the gain node for controlling volume (the source will connect to this).
            self._node = (typeof Howler.ctx.createGain === 'undefined') ? Howler.ctx.createGainNode() : Howler.ctx.createGain();
            self._node.gain.setValueAtTime(volume, Howler.ctx.currentTime);
            self._node.paused = true;
            self._node.connect(Howler.masterGain);
          } else if (!Howler.noAudio) {
            // Get an unlocked Audio object from the pool.
            self._node = Howler._obtainHtml5Audio();

            // Listen for errors (http://dev.w3.org/html5/spec-author-view/spec.html#mediaerror).
            self._errorFn = self._errorListener.bind(self);
            self._node.addEventListener('error', self._errorFn, false);

            // Listen for 'canplaythrough' event to let us know the sound is ready.
            self._loadFn = self._loadListener.bind(self);
            self._node.addEventListener(Howler._canPlayEvent, self._loadFn, false);

            // Listen for the 'ended' event on the sound to account for edge-case where
            // a finite sound has a duration of Infinity.
            self._endFn = self._endListener.bind(self);
            self._node.addEventListener('ended', self._endFn, false);

            // Setup the new audio node.
            self._node.src = parent._src;
            self._node.preload = parent._preload === true ? 'auto' : parent._preload;
            self._node.volume = volume * Howler.volume();

            // Begin loading the source.
            self._node.load();
          }

          return self;
        },

        /**
         * Reset the parameters of this sound to the original state (for recycle).
         * @return {Sound}
         */
        reset: function() {
          var self = this;
          var parent = self._parent;

          // Reset all of the parameters of this sound.
          self._muted = parent._muted;
          self._loop = parent._loop;
          self._volume = parent._volume;
          self._rate = parent._rate;
          self._seek = 0;
          self._rateSeek = 0;
          self._paused = true;
          self._ended = true;
          self._sprite = '__default';

          // Generate a new ID so that it isn't confused with the previous sound.
          self._id = ++Howler._counter;

          return self;
        },

        /**
         * HTML5 Audio error listener callback.
         */
        _errorListener: function() {
          var self = this;

          // Fire an error event and pass back the code.
          self._parent._emit('loaderror', self._id, self._node.error ? self._node.error.code : 0);

          // Clear the event listener.
          self._node.removeEventListener('error', self._errorFn, false);
        },

        /**
         * HTML5 Audio canplaythrough listener callback.
         */
        _loadListener: function() {
          var self = this;
          var parent = self._parent;

          // Round up the duration to account for the lower precision in HTML5 Audio.
          parent._duration = Math.ceil(self._node.duration * 10) / 10;

          // Setup a sprite if none is defined.
          if (Object.keys(parent._sprite).length === 0) {
            parent._sprite = {__default: [0, parent._duration * 1000]};
          }

          if (parent._state !== 'loaded') {
            parent._state = 'loaded';
            parent._emit('load');
            parent._loadQueue();
          }

          // Clear the event listener.
          self._node.removeEventListener(Howler._canPlayEvent, self._loadFn, false);
        },

        /**
         * HTML5 Audio ended listener callback.
         */
        _endListener: function() {
          var self = this;
          var parent = self._parent;

          // Only handle the `ended`` event if the duration is Infinity.
          if (parent._duration === Infinity) {
            // Update the parent duration to match the real audio duration.
            // Round up the duration to account for the lower precision in HTML5 Audio.
            parent._duration = Math.ceil(self._node.duration * 10) / 10;

            // Update the sprite that corresponds to the real duration.
            if (parent._sprite.__default[1] === Infinity) {
              parent._sprite.__default[1] = parent._duration * 1000;
            }

            // Run the regular ended method.
            parent._ended(self);
          }

          // Clear the event listener since the duration is now correct.
          self._node.removeEventListener('ended', self._endFn, false);
        }
      };

      /** Helper Methods **/
      /***************************************************************************/

      var cache = {};

      /**
       * Buffer a sound from URL, Data URI or cache and decode to audio source (Web Audio API).
       * @param  {Howl} self
       */
      var loadBuffer = function(self) {
        var url = self._src;

        // Check if the buffer has already been cached and use it instead.
        if (cache[url]) {
          // Set the duration from the cache.
          self._duration = cache[url].duration;

          // Load the sound into this Howl.
          loadSound(self);

          return;
        }

        if (/^data:[^;]+;base64,/.test(url)) {
          // Decode the base64 data URI without XHR, since some browsers don't support it.
          var data = atob(url.split(',')[1]);
          var dataView = new Uint8Array(data.length);
          for (var i=0; i<data.length; ++i) {
            dataView[i] = data.charCodeAt(i);
          }

          decodeAudioData(dataView.buffer, self);
        } else {
          // Load the buffer from the URL.
          var xhr = new XMLHttpRequest();
          xhr.open(self._xhr.method, url, true);
          xhr.withCredentials = self._xhr.withCredentials;
          xhr.responseType = 'arraybuffer';

          // Apply any custom headers to the request.
          if (self._xhr.headers) {
            Object.keys(self._xhr.headers).forEach(function(key) {
              xhr.setRequestHeader(key, self._xhr.headers[key]);
            });
          }

          xhr.onload = function() {
            // Make sure we get a successful response back.
            var code = (xhr.status + '')[0];
            if (code !== '0' && code !== '2' && code !== '3') {
              self._emit('loaderror', null, 'Failed loading audio file with status: ' + xhr.status + '.');
              return;
            }

            decodeAudioData(xhr.response, self);
          };
          xhr.onerror = function() {
            // If there is an error, switch to HTML5 Audio.
            if (self._webAudio) {
              self._html5 = true;
              self._webAudio = false;
              self._sounds = [];
              delete cache[url];
              self.load();
            }
          };
          safeXhrSend(xhr);
        }
      };

      /**
       * Send the XHR request wrapped in a try/catch.
       * @param  {Object} xhr XHR to send.
       */
      var safeXhrSend = function(xhr) {
        try {
          xhr.send();
        } catch (e) {
          xhr.onerror();
        }
      };

      /**
       * Decode audio data from an array buffer.
       * @param  {ArrayBuffer} arraybuffer The audio data.
       * @param  {Howl}        self
       */
      var decodeAudioData = function(arraybuffer, self) {
        // Fire a load error if something broke.
        var error = function() {
          self._emit('loaderror', null, 'Decoding audio data failed.');
        };

        // Load the sound on success.
        var success = function(buffer) {
          if (buffer && self._sounds.length > 0) {
            cache[self._src] = buffer;
            loadSound(self, buffer);
          } else {
            error();
          }
        };

        // Decode the buffer into an audio source.
        if (typeof Promise !== 'undefined' && Howler.ctx.decodeAudioData.length === 1) {
          Howler.ctx.decodeAudioData(arraybuffer).then(success).catch(error);
        } else {
          Howler.ctx.decodeAudioData(arraybuffer, success, error);
        }
      };

      /**
       * Sound is now loaded, so finish setting everything up and fire the loaded event.
       * @param  {Howl} self
       * @param  {Object} buffer The decoded buffer sound source.
       */
      var loadSound = function(self, buffer) {
        // Set the duration.
        if (buffer && !self._duration) {
          self._duration = buffer.duration;
        }

        // Setup a sprite if none is defined.
        if (Object.keys(self._sprite).length === 0) {
          self._sprite = {__default: [0, self._duration * 1000]};
        }

        // Fire the loaded event.
        if (self._state !== 'loaded') {
          self._state = 'loaded';
          self._emit('load');
          self._loadQueue();
        }
      };

      /**
       * Setup the audio context when available, or switch to HTML5 Audio mode.
       */
      var setupAudioContext = function() {
        // If we have already detected that Web Audio isn't supported, don't run this step again.
        if (!Howler.usingWebAudio) {
          return;
        }

        // Check if we are using Web Audio and setup the AudioContext if we are.
        try {
          if (typeof AudioContext !== 'undefined') {
            Howler.ctx = new AudioContext();
          } else if (typeof webkitAudioContext !== 'undefined') {
            Howler.ctx = new webkitAudioContext();
          } else {
            Howler.usingWebAudio = false;
          }
        } catch(e) {
          Howler.usingWebAudio = false;
        }

        // If the audio context creation still failed, set using web audio to false.
        if (!Howler.ctx) {
          Howler.usingWebAudio = false;
        }

        // Check if a webview is being used on iOS8 or earlier (rather than the browser).
        // If it is, disable Web Audio as it causes crashing.
        var iOS = (/iP(hone|od|ad)/.test(Howler._navigator && Howler._navigator.platform));
        var appVersion = Howler._navigator && Howler._navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/);
        var version = appVersion ? parseInt(appVersion[1], 10) : null;
        if (iOS && version && version < 9) {
          var safari = /safari/.test(Howler._navigator && Howler._navigator.userAgent.toLowerCase());
          if (Howler._navigator && !safari) {
            Howler.usingWebAudio = false;
          }
        }

        // Create and expose the master GainNode when using Web Audio (useful for plugins or advanced usage).
        if (Howler.usingWebAudio) {
          Howler.masterGain = (typeof Howler.ctx.createGain === 'undefined') ? Howler.ctx.createGainNode() : Howler.ctx.createGain();
          Howler.masterGain.gain.setValueAtTime(Howler._muted ? 0 : Howler._volume, Howler.ctx.currentTime);
          Howler.masterGain.connect(Howler.ctx.destination);
        }

        // Re-run the setup on Howler.
        Howler._setup();
      };

      // Add support for CommonJS libraries such as browserify.
      {
        exports.Howler = Howler;
        exports.Howl = Howl;
      }

      // Add to global in Node.js (for testing, etc).
      if (typeof commonjsGlobal !== 'undefined') {
        commonjsGlobal.HowlerGlobal = HowlerGlobal;
        commonjsGlobal.Howler = Howler;
        commonjsGlobal.Howl = Howl;
        commonjsGlobal.Sound = Sound;
      } else if (typeof window !== 'undefined') {  // Define globally in case AMD is not available or unused.
        window.HowlerGlobal = HowlerGlobal;
        window.Howler = Howler;
        window.Howl = Howl;
        window.Sound = Sound;
      }
    })();


    /*!
     *  Spatial Plugin - Adds support for stereo and 3D audio where Web Audio is supported.
     *  
     *  howler.js v2.2.3
     *  howlerjs.com
     *
     *  (c) 2013-2020, James Simpson of GoldFire Studios
     *  goldfirestudios.com
     *
     *  MIT License
     */

    (function() {

      // Setup default properties.
      HowlerGlobal.prototype._pos = [0, 0, 0];
      HowlerGlobal.prototype._orientation = [0, 0, -1, 0, 1, 0];

      /** Global Methods **/
      /***************************************************************************/

      /**
       * Helper method to update the stereo panning position of all current Howls.
       * Future Howls will not use this value unless explicitly set.
       * @param  {Number} pan A value of -1.0 is all the way left and 1.0 is all the way right.
       * @return {Howler/Number}     Self or current stereo panning value.
       */
      HowlerGlobal.prototype.stereo = function(pan) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self.ctx || !self.ctx.listener) {
          return self;
        }

        // Loop through all Howls and update their stereo panning.
        for (var i=self._howls.length-1; i>=0; i--) {
          self._howls[i].stereo(pan);
        }

        return self;
      };

      /**
       * Get/set the position of the listener in 3D cartesian space. Sounds using
       * 3D position will be relative to the listener's position.
       * @param  {Number} x The x-position of the listener.
       * @param  {Number} y The y-position of the listener.
       * @param  {Number} z The z-position of the listener.
       * @return {Howler/Array}   Self or current listener position.
       */
      HowlerGlobal.prototype.pos = function(x, y, z) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self.ctx || !self.ctx.listener) {
          return self;
        }

        // Set the defaults for optional 'y' & 'z'.
        y = (typeof y !== 'number') ? self._pos[1] : y;
        z = (typeof z !== 'number') ? self._pos[2] : z;

        if (typeof x === 'number') {
          self._pos = [x, y, z];

          if (typeof self.ctx.listener.positionX !== 'undefined') {
            self.ctx.listener.positionX.setTargetAtTime(self._pos[0], Howler.ctx.currentTime, 0.1);
            self.ctx.listener.positionY.setTargetAtTime(self._pos[1], Howler.ctx.currentTime, 0.1);
            self.ctx.listener.positionZ.setTargetAtTime(self._pos[2], Howler.ctx.currentTime, 0.1);
          } else {
            self.ctx.listener.setPosition(self._pos[0], self._pos[1], self._pos[2]);
          }
        } else {
          return self._pos;
        }

        return self;
      };

      /**
       * Get/set the direction the listener is pointing in the 3D cartesian space.
       * A front and up vector must be provided. The front is the direction the
       * face of the listener is pointing, and up is the direction the top of the
       * listener is pointing. Thus, these values are expected to be at right angles
       * from each other.
       * @param  {Number} x   The x-orientation of the listener.
       * @param  {Number} y   The y-orientation of the listener.
       * @param  {Number} z   The z-orientation of the listener.
       * @param  {Number} xUp The x-orientation of the top of the listener.
       * @param  {Number} yUp The y-orientation of the top of the listener.
       * @param  {Number} zUp The z-orientation of the top of the listener.
       * @return {Howler/Array}     Returns self or the current orientation vectors.
       */
      HowlerGlobal.prototype.orientation = function(x, y, z, xUp, yUp, zUp) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self.ctx || !self.ctx.listener) {
          return self;
        }

        // Set the defaults for optional 'y' & 'z'.
        var or = self._orientation;
        y = (typeof y !== 'number') ? or[1] : y;
        z = (typeof z !== 'number') ? or[2] : z;
        xUp = (typeof xUp !== 'number') ? or[3] : xUp;
        yUp = (typeof yUp !== 'number') ? or[4] : yUp;
        zUp = (typeof zUp !== 'number') ? or[5] : zUp;

        if (typeof x === 'number') {
          self._orientation = [x, y, z, xUp, yUp, zUp];

          if (typeof self.ctx.listener.forwardX !== 'undefined') {
            self.ctx.listener.forwardX.setTargetAtTime(x, Howler.ctx.currentTime, 0.1);
            self.ctx.listener.forwardY.setTargetAtTime(y, Howler.ctx.currentTime, 0.1);
            self.ctx.listener.forwardZ.setTargetAtTime(z, Howler.ctx.currentTime, 0.1);
            self.ctx.listener.upX.setTargetAtTime(xUp, Howler.ctx.currentTime, 0.1);
            self.ctx.listener.upY.setTargetAtTime(yUp, Howler.ctx.currentTime, 0.1);
            self.ctx.listener.upZ.setTargetAtTime(zUp, Howler.ctx.currentTime, 0.1);
          } else {
            self.ctx.listener.setOrientation(x, y, z, xUp, yUp, zUp);
          }
        } else {
          return or;
        }

        return self;
      };

      /** Group Methods **/
      /***************************************************************************/

      /**
       * Add new properties to the core init.
       * @param  {Function} _super Core init method.
       * @return {Howl}
       */
      Howl.prototype.init = (function(_super) {
        return function(o) {
          var self = this;

          // Setup user-defined default properties.
          self._orientation = o.orientation || [1, 0, 0];
          self._stereo = o.stereo || null;
          self._pos = o.pos || null;
          self._pannerAttr = {
            coneInnerAngle: typeof o.coneInnerAngle !== 'undefined' ? o.coneInnerAngle : 360,
            coneOuterAngle: typeof o.coneOuterAngle !== 'undefined' ? o.coneOuterAngle : 360,
            coneOuterGain: typeof o.coneOuterGain !== 'undefined' ? o.coneOuterGain : 0,
            distanceModel: typeof o.distanceModel !== 'undefined' ? o.distanceModel : 'inverse',
            maxDistance: typeof o.maxDistance !== 'undefined' ? o.maxDistance : 10000,
            panningModel: typeof o.panningModel !== 'undefined' ? o.panningModel : 'HRTF',
            refDistance: typeof o.refDistance !== 'undefined' ? o.refDistance : 1,
            rolloffFactor: typeof o.rolloffFactor !== 'undefined' ? o.rolloffFactor : 1
          };

          // Setup event listeners.
          self._onstereo = o.onstereo ? [{fn: o.onstereo}] : [];
          self._onpos = o.onpos ? [{fn: o.onpos}] : [];
          self._onorientation = o.onorientation ? [{fn: o.onorientation}] : [];

          // Complete initilization with howler.js core's init function.
          return _super.call(this, o);
        };
      })(Howl.prototype.init);

      /**
       * Get/set the stereo panning of the audio source for this sound or all in the group.
       * @param  {Number} pan  A value of -1.0 is all the way left and 1.0 is all the way right.
       * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
       * @return {Howl/Number}    Returns self or the current stereo panning value.
       */
      Howl.prototype.stereo = function(pan, id) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self._webAudio) {
          return self;
        }

        // If the sound hasn't loaded, add it to the load queue to change stereo pan when capable.
        if (self._state !== 'loaded') {
          self._queue.push({
            event: 'stereo',
            action: function() {
              self.stereo(pan, id);
            }
          });

          return self;
        }

        // Check for PannerStereoNode support and fallback to PannerNode if it doesn't exist.
        var pannerType = (typeof Howler.ctx.createStereoPanner === 'undefined') ? 'spatial' : 'stereo';

        // Setup the group's stereo panning if no ID is passed.
        if (typeof id === 'undefined') {
          // Return the group's stereo panning if no parameters are passed.
          if (typeof pan === 'number') {
            self._stereo = pan;
            self._pos = [pan, 0, 0];
          } else {
            return self._stereo;
          }
        }

        // Change the streo panning of one or all sounds in group.
        var ids = self._getSoundIds(id);
        for (var i=0; i<ids.length; i++) {
          // Get the sound.
          var sound = self._soundById(ids[i]);

          if (sound) {
            if (typeof pan === 'number') {
              sound._stereo = pan;
              sound._pos = [pan, 0, 0];

              if (sound._node) {
                // If we are falling back, make sure the panningModel is equalpower.
                sound._pannerAttr.panningModel = 'equalpower';

                // Check if there is a panner setup and create a new one if not.
                if (!sound._panner || !sound._panner.pan) {
                  setupPanner(sound, pannerType);
                }

                if (pannerType === 'spatial') {
                  if (typeof sound._panner.positionX !== 'undefined') {
                    sound._panner.positionX.setValueAtTime(pan, Howler.ctx.currentTime);
                    sound._panner.positionY.setValueAtTime(0, Howler.ctx.currentTime);
                    sound._panner.positionZ.setValueAtTime(0, Howler.ctx.currentTime);
                  } else {
                    sound._panner.setPosition(pan, 0, 0);
                  }
                } else {
                  sound._panner.pan.setValueAtTime(pan, Howler.ctx.currentTime);
                }
              }

              self._emit('stereo', sound._id);
            } else {
              return sound._stereo;
            }
          }
        }

        return self;
      };

      /**
       * Get/set the 3D spatial position of the audio source for this sound or group relative to the global listener.
       * @param  {Number} x  The x-position of the audio source.
       * @param  {Number} y  The y-position of the audio source.
       * @param  {Number} z  The z-position of the audio source.
       * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
       * @return {Howl/Array}    Returns self or the current 3D spatial position: [x, y, z].
       */
      Howl.prototype.pos = function(x, y, z, id) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self._webAudio) {
          return self;
        }

        // If the sound hasn't loaded, add it to the load queue to change position when capable.
        if (self._state !== 'loaded') {
          self._queue.push({
            event: 'pos',
            action: function() {
              self.pos(x, y, z, id);
            }
          });

          return self;
        }

        // Set the defaults for optional 'y' & 'z'.
        y = (typeof y !== 'number') ? 0 : y;
        z = (typeof z !== 'number') ? -0.5 : z;

        // Setup the group's spatial position if no ID is passed.
        if (typeof id === 'undefined') {
          // Return the group's spatial position if no parameters are passed.
          if (typeof x === 'number') {
            self._pos = [x, y, z];
          } else {
            return self._pos;
          }
        }

        // Change the spatial position of one or all sounds in group.
        var ids = self._getSoundIds(id);
        for (var i=0; i<ids.length; i++) {
          // Get the sound.
          var sound = self._soundById(ids[i]);

          if (sound) {
            if (typeof x === 'number') {
              sound._pos = [x, y, z];

              if (sound._node) {
                // Check if there is a panner setup and create a new one if not.
                if (!sound._panner || sound._panner.pan) {
                  setupPanner(sound, 'spatial');
                }

                if (typeof sound._panner.positionX !== 'undefined') {
                  sound._panner.positionX.setValueAtTime(x, Howler.ctx.currentTime);
                  sound._panner.positionY.setValueAtTime(y, Howler.ctx.currentTime);
                  sound._panner.positionZ.setValueAtTime(z, Howler.ctx.currentTime);
                } else {
                  sound._panner.setPosition(x, y, z);
                }
              }

              self._emit('pos', sound._id);
            } else {
              return sound._pos;
            }
          }
        }

        return self;
      };

      /**
       * Get/set the direction the audio source is pointing in the 3D cartesian coordinate
       * space. Depending on how direction the sound is, based on the `cone` attributes,
       * a sound pointing away from the listener can be quiet or silent.
       * @param  {Number} x  The x-orientation of the source.
       * @param  {Number} y  The y-orientation of the source.
       * @param  {Number} z  The z-orientation of the source.
       * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
       * @return {Howl/Array}    Returns self or the current 3D spatial orientation: [x, y, z].
       */
      Howl.prototype.orientation = function(x, y, z, id) {
        var self = this;

        // Stop right here if not using Web Audio.
        if (!self._webAudio) {
          return self;
        }

        // If the sound hasn't loaded, add it to the load queue to change orientation when capable.
        if (self._state !== 'loaded') {
          self._queue.push({
            event: 'orientation',
            action: function() {
              self.orientation(x, y, z, id);
            }
          });

          return self;
        }

        // Set the defaults for optional 'y' & 'z'.
        y = (typeof y !== 'number') ? self._orientation[1] : y;
        z = (typeof z !== 'number') ? self._orientation[2] : z;

        // Setup the group's spatial orientation if no ID is passed.
        if (typeof id === 'undefined') {
          // Return the group's spatial orientation if no parameters are passed.
          if (typeof x === 'number') {
            self._orientation = [x, y, z];
          } else {
            return self._orientation;
          }
        }

        // Change the spatial orientation of one or all sounds in group.
        var ids = self._getSoundIds(id);
        for (var i=0; i<ids.length; i++) {
          // Get the sound.
          var sound = self._soundById(ids[i]);

          if (sound) {
            if (typeof x === 'number') {
              sound._orientation = [x, y, z];

              if (sound._node) {
                // Check if there is a panner setup and create a new one if not.
                if (!sound._panner) {
                  // Make sure we have a position to setup the node with.
                  if (!sound._pos) {
                    sound._pos = self._pos || [0, 0, -0.5];
                  }

                  setupPanner(sound, 'spatial');
                }

                if (typeof sound._panner.orientationX !== 'undefined') {
                  sound._panner.orientationX.setValueAtTime(x, Howler.ctx.currentTime);
                  sound._panner.orientationY.setValueAtTime(y, Howler.ctx.currentTime);
                  sound._panner.orientationZ.setValueAtTime(z, Howler.ctx.currentTime);
                } else {
                  sound._panner.setOrientation(x, y, z);
                }
              }

              self._emit('orientation', sound._id);
            } else {
              return sound._orientation;
            }
          }
        }

        return self;
      };

      /**
       * Get/set the panner node's attributes for a sound or group of sounds.
       * This method can optionall take 0, 1 or 2 arguments.
       *   pannerAttr() -> Returns the group's values.
       *   pannerAttr(id) -> Returns the sound id's values.
       *   pannerAttr(o) -> Set's the values of all sounds in this Howl group.
       *   pannerAttr(o, id) -> Set's the values of passed sound id.
       *
       *   Attributes:
       *     coneInnerAngle - (360 by default) A parameter for directional audio sources, this is an angle, in degrees,
       *                      inside of which there will be no volume reduction.
       *     coneOuterAngle - (360 by default) A parameter for directional audio sources, this is an angle, in degrees,
       *                      outside of which the volume will be reduced to a constant value of `coneOuterGain`.
       *     coneOuterGain - (0 by default) A parameter for directional audio sources, this is the gain outside of the
       *                     `coneOuterAngle`. It is a linear value in the range `[0, 1]`.
       *     distanceModel - ('inverse' by default) Determines algorithm used to reduce volume as audio moves away from
       *                     listener. Can be `linear`, `inverse` or `exponential.
       *     maxDistance - (10000 by default) The maximum distance between source and listener, after which the volume
       *                   will not be reduced any further.
       *     refDistance - (1 by default) A reference distance for reducing volume as source moves further from the listener.
       *                   This is simply a variable of the distance model and has a different effect depending on which model
       *                   is used and the scale of your coordinates. Generally, volume will be equal to 1 at this distance.
       *     rolloffFactor - (1 by default) How quickly the volume reduces as source moves from listener. This is simply a
       *                     variable of the distance model and can be in the range of `[0, 1]` with `linear` and `[0, ∞]`
       *                     with `inverse` and `exponential`.
       *     panningModel - ('HRTF' by default) Determines which spatialization algorithm is used to position audio.
       *                     Can be `HRTF` or `equalpower`.
       *
       * @return {Howl/Object} Returns self or current panner attributes.
       */
      Howl.prototype.pannerAttr = function() {
        var self = this;
        var args = arguments;
        var o, id, sound;

        // Stop right here if not using Web Audio.
        if (!self._webAudio) {
          return self;
        }

        // Determine the values based on arguments.
        if (args.length === 0) {
          // Return the group's panner attribute values.
          return self._pannerAttr;
        } else if (args.length === 1) {
          if (typeof args[0] === 'object') {
            o = args[0];

            // Set the grou's panner attribute values.
            if (typeof id === 'undefined') {
              if (!o.pannerAttr) {
                o.pannerAttr = {
                  coneInnerAngle: o.coneInnerAngle,
                  coneOuterAngle: o.coneOuterAngle,
                  coneOuterGain: o.coneOuterGain,
                  distanceModel: o.distanceModel,
                  maxDistance: o.maxDistance,
                  refDistance: o.refDistance,
                  rolloffFactor: o.rolloffFactor,
                  panningModel: o.panningModel
                };
              }

              self._pannerAttr = {
                coneInnerAngle: typeof o.pannerAttr.coneInnerAngle !== 'undefined' ? o.pannerAttr.coneInnerAngle : self._coneInnerAngle,
                coneOuterAngle: typeof o.pannerAttr.coneOuterAngle !== 'undefined' ? o.pannerAttr.coneOuterAngle : self._coneOuterAngle,
                coneOuterGain: typeof o.pannerAttr.coneOuterGain !== 'undefined' ? o.pannerAttr.coneOuterGain : self._coneOuterGain,
                distanceModel: typeof o.pannerAttr.distanceModel !== 'undefined' ? o.pannerAttr.distanceModel : self._distanceModel,
                maxDistance: typeof o.pannerAttr.maxDistance !== 'undefined' ? o.pannerAttr.maxDistance : self._maxDistance,
                refDistance: typeof o.pannerAttr.refDistance !== 'undefined' ? o.pannerAttr.refDistance : self._refDistance,
                rolloffFactor: typeof o.pannerAttr.rolloffFactor !== 'undefined' ? o.pannerAttr.rolloffFactor : self._rolloffFactor,
                panningModel: typeof o.pannerAttr.panningModel !== 'undefined' ? o.pannerAttr.panningModel : self._panningModel
              };
            }
          } else {
            // Return this sound's panner attribute values.
            sound = self._soundById(parseInt(args[0], 10));
            return sound ? sound._pannerAttr : self._pannerAttr;
          }
        } else if (args.length === 2) {
          o = args[0];
          id = parseInt(args[1], 10);
        }

        // Update the values of the specified sounds.
        var ids = self._getSoundIds(id);
        for (var i=0; i<ids.length; i++) {
          sound = self._soundById(ids[i]);

          if (sound) {
            // Merge the new values into the sound.
            var pa = sound._pannerAttr;
            pa = {
              coneInnerAngle: typeof o.coneInnerAngle !== 'undefined' ? o.coneInnerAngle : pa.coneInnerAngle,
              coneOuterAngle: typeof o.coneOuterAngle !== 'undefined' ? o.coneOuterAngle : pa.coneOuterAngle,
              coneOuterGain: typeof o.coneOuterGain !== 'undefined' ? o.coneOuterGain : pa.coneOuterGain,
              distanceModel: typeof o.distanceModel !== 'undefined' ? o.distanceModel : pa.distanceModel,
              maxDistance: typeof o.maxDistance !== 'undefined' ? o.maxDistance : pa.maxDistance,
              refDistance: typeof o.refDistance !== 'undefined' ? o.refDistance : pa.refDistance,
              rolloffFactor: typeof o.rolloffFactor !== 'undefined' ? o.rolloffFactor : pa.rolloffFactor,
              panningModel: typeof o.panningModel !== 'undefined' ? o.panningModel : pa.panningModel
            };

            // Update the panner values or create a new panner if none exists.
            var panner = sound._panner;
            if (panner) {
              panner.coneInnerAngle = pa.coneInnerAngle;
              panner.coneOuterAngle = pa.coneOuterAngle;
              panner.coneOuterGain = pa.coneOuterGain;
              panner.distanceModel = pa.distanceModel;
              panner.maxDistance = pa.maxDistance;
              panner.refDistance = pa.refDistance;
              panner.rolloffFactor = pa.rolloffFactor;
              panner.panningModel = pa.panningModel;
            } else {
              // Make sure we have a position to setup the node with.
              if (!sound._pos) {
                sound._pos = self._pos || [0, 0, -0.5];
              }

              // Create a new panner node.
              setupPanner(sound, 'spatial');
            }
          }
        }

        return self;
      };

      /** Single Sound Methods **/
      /***************************************************************************/

      /**
       * Add new properties to the core Sound init.
       * @param  {Function} _super Core Sound init method.
       * @return {Sound}
       */
      Sound.prototype.init = (function(_super) {
        return function() {
          var self = this;
          var parent = self._parent;

          // Setup user-defined default properties.
          self._orientation = parent._orientation;
          self._stereo = parent._stereo;
          self._pos = parent._pos;
          self._pannerAttr = parent._pannerAttr;

          // Complete initilization with howler.js core Sound's init function.
          _super.call(this);

          // If a stereo or position was specified, set it up.
          if (self._stereo) {
            parent.stereo(self._stereo);
          } else if (self._pos) {
            parent.pos(self._pos[0], self._pos[1], self._pos[2], self._id);
          }
        };
      })(Sound.prototype.init);

      /**
       * Override the Sound.reset method to clean up properties from the spatial plugin.
       * @param  {Function} _super Sound reset method.
       * @return {Sound}
       */
      Sound.prototype.reset = (function(_super) {
        return function() {
          var self = this;
          var parent = self._parent;

          // Reset all spatial plugin properties on this sound.
          self._orientation = parent._orientation;
          self._stereo = parent._stereo;
          self._pos = parent._pos;
          self._pannerAttr = parent._pannerAttr;

          // If a stereo or position was specified, set it up.
          if (self._stereo) {
            parent.stereo(self._stereo);
          } else if (self._pos) {
            parent.pos(self._pos[0], self._pos[1], self._pos[2], self._id);
          } else if (self._panner) {
            // Disconnect the panner.
            self._panner.disconnect(0);
            self._panner = undefined;
            parent._refreshBuffer(self);
          }

          // Complete resetting of the sound.
          return _super.call(this);
        };
      })(Sound.prototype.reset);

      /** Helper Methods **/
      /***************************************************************************/

      /**
       * Create a new panner node and save it on the sound.
       * @param  {Sound} sound Specific sound to setup panning on.
       * @param {String} type Type of panner to create: 'stereo' or 'spatial'.
       */
      var setupPanner = function(sound, type) {
        type = type || 'spatial';

        // Create the new panner node.
        if (type === 'spatial') {
          sound._panner = Howler.ctx.createPanner();
          sound._panner.coneInnerAngle = sound._pannerAttr.coneInnerAngle;
          sound._panner.coneOuterAngle = sound._pannerAttr.coneOuterAngle;
          sound._panner.coneOuterGain = sound._pannerAttr.coneOuterGain;
          sound._panner.distanceModel = sound._pannerAttr.distanceModel;
          sound._panner.maxDistance = sound._pannerAttr.maxDistance;
          sound._panner.refDistance = sound._pannerAttr.refDistance;
          sound._panner.rolloffFactor = sound._pannerAttr.rolloffFactor;
          sound._panner.panningModel = sound._pannerAttr.panningModel;

          if (typeof sound._panner.positionX !== 'undefined') {
            sound._panner.positionX.setValueAtTime(sound._pos[0], Howler.ctx.currentTime);
            sound._panner.positionY.setValueAtTime(sound._pos[1], Howler.ctx.currentTime);
            sound._panner.positionZ.setValueAtTime(sound._pos[2], Howler.ctx.currentTime);
          } else {
            sound._panner.setPosition(sound._pos[0], sound._pos[1], sound._pos[2]);
          }

          if (typeof sound._panner.orientationX !== 'undefined') {
            sound._panner.orientationX.setValueAtTime(sound._orientation[0], Howler.ctx.currentTime);
            sound._panner.orientationY.setValueAtTime(sound._orientation[1], Howler.ctx.currentTime);
            sound._panner.orientationZ.setValueAtTime(sound._orientation[2], Howler.ctx.currentTime);
          } else {
            sound._panner.setOrientation(sound._orientation[0], sound._orientation[1], sound._orientation[2]);
          }
        } else {
          sound._panner = Howler.ctx.createStereoPanner();
          sound._panner.pan.setValueAtTime(sound._stereo, Howler.ctx.currentTime);
        }

        sound._panner.connect(sound._node);

        // Update the connections.
        if (!sound._paused) {
          sound._parent.pause(sound._id, true).play(sound._id, true);
        }
      };
    })();
    }(howler));

    class SoundCache {
        constructor() {
            this.volume = 1;
            this.howls = new Map();
        }
        async register(sounds) {
            for (const key in sounds) {
                const howl = new howler.Howl({
                    src: sounds[key],
                });
                this.howls.set(key, howl);
            }
        }
        play(alias, volume) {
            const vol = volume !== null && volume !== void 0 ? volume : this.volume;
            if (vol <= 0) {
                return;
            }
            const howl = this.howls.get(alias);
            if (howl !== undefined) {
                howl.volume(vol);
                howl.play();
            }
        }
    }

    class SpriteSheet {
        constructor(image, width, height) {
            this.boundsCache = new Map();
            this.width = Math.floor(width);
            this.height = Math.floor(height);
            this.image = image;
        }
        getSpriteBounds(index) {
            let bounds = this.boundsCache.get(index);
            if (bounds === undefined) {
                bounds = { x: 0, y: 0, width: this.width, height: this.height };
                const spriteWidth = Math.floor(this.image.width / this.width);
                bounds.x = Math.floor((index % spriteWidth) * this.width);
                bounds.y = Math.floor(index / spriteWidth) * this.height;
                this.boundsCache.set(index, bounds);
                return bounds;
            }
            else {
                return bounds;
            }
        }
    }

    function parseLines(text, size, maxWidth) {
        const lines = [];
        if (maxWidth === 0) {
            lines.push(text);
            return lines;
        }
        let lineIndex = 0;
        const words = text.split(" ");
        for (const word of words) {
            if (lines.length === 0) {
                lines.push(word);
            }
            else {
                const width = ((word.length + 1) * size);
                const len = lines[lineIndex].length * size;
                if (len + width <= maxWidth) {
                    lines[lineIndex] += " " + word;
                }
                else {
                    lines.push(word);
                    lineIndex++;
                }
            }
        }
        return lines;
    }
    class SpriteText extends Actor {
        constructor(text, size, font) {
            super();
            this.maxWidth = 0;
            this.lineSpacing = 4;
            this.lines = [];
            if (font === undefined && SpriteText.DefaultFont === undefined) {
                throw new Error("A font must be specified or SpriteText.Default font must be set");
            }
            this.text = text;
            this.size = Math.floor(size !== null && size !== void 0 ? size : 8);
            this.font = font !== null && font !== void 0 ? font : SpriteText.DefaultFont;
        }
        get width() {
            let maxWidth = 0;
            for (const line of this.lines) {
                const width = line.length * this.size;
                if (width > maxWidth) {
                    maxWidth = width;
                }
            }
            return maxWidth;
        }
        get lineHeight() {
            return this.size + this.lineSpacing;
        }
        set text(text) {
            if (text !== undefined) {
                this.lines = parseLines(text, this.size, this.maxWidth);
            }
            else {
                this.lines.length = 0;
            }
        }
        renderSelf(ctx) {
            const { glyphs, sheet } = this.font;
            let x = 0;
            let y = 0;
            for (const line of this.lines) {
                for (const char of line) {
                    const index = glyphs.indexOf(char.toUpperCase());
                    if (index !== -1) {
                        const sprite = sheet.getSpriteBounds(index);
                        ctx.drawImage(sheet.image, sprite.x, sprite.y, sprite.width, sprite.height, Math.round(x), Math.round(y), this.size, this.size);
                    }
                    x += this.size;
                }
                x = 0;
                y += this.size + this.lineSpacing;
            }
        }
    }

    class Surface {
        constructor(width, height, pixelated = true, alpha = false) {
            this.canvas = document.createElement("canvas");
            this.canvas.className = "jack-surface";
            this.resize(width, height);
            this.context = this.canvas.getContext("2d", {
                alpha,
            });
            this.pixelated = pixelated;
        }
        get width() {
            return this.canvas.width;
        }
        get height() {
            return this.canvas.height;
        }
        set pixelated(value) {
            this.context.imageSmoothingEnabled = !value;
            this.canvas.style.setProperty("image-rendering", value ? "crisp-edges" : "auto");
        }
        resize(width, height) {
            this.canvas.width = Math.ceil(width);
            this.canvas.height = Math.ceil(height);
        }
    }

    class Game {
        constructor(width, height, options) {
            this.scenes = new Map();
            this.tweens = new TweenGroup();
            this.data = new DataCache();
            this.images = new ImageCache();
            this.sounds = new SoundCache();
            this.keyboard = new Keyboard(document.body);
            this.updateTime = -1;
            this.running = false;
            this.onUpdateBegin = () => { return; };
            this.onUpdateEnd = () => { return; };
            this.overlay = new Box(width, height, "#000");
            this.overlay.position.set(width / 2, height / 2);
            this.overlay.visible = false;
            this.stage = new Surface(width, height, options === null || options === void 0 ? void 0 : options.stagePixel, options === null || options === void 0 ? void 0 : options.stageAlpha);
            const style = this.stage.canvas.style;
            style.position = "absolute";
            style.left = "0";
            style.top = "0";
            document.body.appendChild(this.stage.canvas);
            this.fitStageToWindow();
            window.addEventListener("resize", this.fitStageToWindow.bind(this), false);
            this.animFrameHandler = this.update.bind(this);
        }
        async loadSpriteFont(url, makeDefault = false) {
            const config = await this.data.load(url);
            const image = await this.images.load(config.sheet);
            const font = {
                glyphs: config.glyphs,
                sheet: new SpriteSheet(image, config.width, config.height),
            };
            if (makeDefault) {
                SpriteText.DefaultFont = font;
            }
            return font;
        }
        start() {
            this.running = true;
            this.updateTime = performance.now();
            window.requestAnimationFrame(this.animFrameHandler);
        }
        stop() {
            this.running = false;
        }
        addScene(name, SceneClass) {
            const scene = new SceneClass(this.stage.width, this.stage.height, this.data, this.images, this.sounds, this.tweens, this.keyboard);
            this.scenes.set(name, scene);
            return scene;
        }
        activateScene(name) {
            const scene = this.scenes.get(name);
            if (scene !== undefined) {
                if (this.activeScene !== undefined) {
                    this.activeScene.deactivate();
                }
                scene.activate();
                this.activeScene = scene;
            }
            else {
                throw new Error(`Invalid scene name: ${name}`);
            }
        }
        fadeIn(duration, fillStyle) {
            if (fillStyle !== undefined) {
                this.overlay.fillStyle = fillStyle;
            }
            this.overlay.visible = true;
            if (duration !== undefined && duration > 0) {
                this.overlay.opacity = 0;
                return this.tweens.create(this.overlay)
                    .to({
                    opacity: 1,
                }, duration, Ease.QuadInOut)
                    .promise();
            }
            else {
                this.overlay.opacity = 1;
                return Promise.resolve();
            }
        }
        fadeOut(duration, fillStyle) {
            if (fillStyle !== undefined) {
                this.overlay.fillStyle = fillStyle;
            }
            this.overlay.visible = true;
            if (duration !== undefined && duration > 0) {
                this.overlay.opacity = 1;
                return this.tweens.create(this.overlay)
                    .to({
                    opacity: 0,
                }, duration, Ease.QuadInOut)
                    .call(() => this.overlay.visible = false)
                    .promise();
            }
            else {
                this.overlay.visible = false;
                return Promise.resolve();
            }
        }
        update(time) {
            const dt = time - this.updateTime;
            this.updateTime = time;
            this.onUpdateBegin();
            if (this.activeScene !== undefined) {
                this.activeScene.update(dt);
            }
            this.keyboard.endFrame();
            this.tweens.update(dt);
            this.render();
            this.onUpdateEnd();
            if (this.running) {
                window.requestAnimationFrame(this.animFrameHandler);
            }
        }
        render() {
            const ctx = this.stage.context;
            if (this.activeScene !== undefined) {
                ctx.resetTransform();
                this.activeScene.render(ctx);
            }
            if (this.overlay.visible) {
                ctx.resetTransform();
                this.overlay.render(ctx);
            }
        }
        fitStageToWindow() {
            const canvas = this.stage.canvas;
            const width = window.innerWidth;
            const height = window.innerHeight;
            const scale = Math.min(width / canvas.width, height / canvas.height);
            const left = width / 2 - (canvas.width / 2 * scale);
            const top = height / 2 - (canvas.height / 2 * scale);
            canvas.style.width = `${canvas.width * scale}px`;
            canvas.style.height = `${canvas.height * scale}px`;
            canvas.style.left = `${left}px`;
            canvas.style.top = `${top}px`;
        }
    }

    class Scene extends Actor {
        constructor(width, height, data, images, sounds, tweens, keyboard) {
            super();
            this.actionQueue = new ActionQueue();
            this.width = width;
            this.height = height;
            this.data = data;
            this.images = images;
            this.sounds = sounds;
            this.tweens = tweens;
            this.keyboard = keyboard;
            this.init();
        }
        activate() {
            return;
        }
        update(_dt) {
            return;
        }
        deactivate() {
            return;
        }
        init() {
            return;
        }
    }

    class Sprite extends Actor {
        constructor(sheet, index = 0) {
            super();
            this.index = 0;
            this.sheet = sheet;
            this.index = index;
        }
        renderSelf(ctx) {
            const bounds = this.sheet.getSpriteBounds(this.index);
            ctx.drawImage(this.sheet.image, bounds.x, bounds.y, bounds.width, bounds.height, Math.round(-bounds.width / 2), Math.round(-bounds.height / 2), bounds.width, bounds.height);
        }
    }

    const scratch = document.createElement("canvas");
    scratch.getContext("2d");

    class TileMap extends Box {
        constructor(width, height, sheet, grid) {
            super(width, height, undefined, true);
            this.offset = { x: 0, y: 0 };
            this.renderOrigin = { x: 0, y: 0 };
            this.renderTerminus = { x: 0, y: 0 };
            this.sheet = sheet;
            this.grid = grid;
            this.calculateRenderBoundsX();
            this.calculateRenderBoundsY();
        }
        get offsetX() {
            return this.offset.x;
        }
        set offsetX(value) {
            this.offset.x = clamp(value, 0, this.maxOffsetX);
            this.calculateRenderBoundsX();
        }
        get offsetY() {
            return this.offset.y;
        }
        set offsetY(value) {
            this.offset.y = clamp(value, 0, this.maxOffsetY);
            this.calculateRenderBoundsY();
        }
        get maxOffsetX() {
            var _a, _b;
            return Math.max(((_b = (_a = this.grid) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 0) * this.sheet.width - this.width, 0);
        }
        get maxOffsetY() {
            var _a, _b;
            return Math.max(((_b = (_a = this.grid) === null || _a === void 0 ? void 0 : _a.height) !== null && _b !== void 0 ? _b : 0) * this.sheet.height - this.height, 0);
        }
        get drawOffsetX() {
            return (-this.width / 2) - (this.offset.x % this.sheet.width);
        }
        get drawOffsetY() {
            return (-this.height / 2) - (this.offset.y % this.sheet.height);
        }
        renderSelf(ctx) {
            if (this.grid === undefined) {
                return;
            }
            super.renderSelf(ctx);
            const dx = this.drawOffsetX;
            const dy = this.drawOffsetY;
            const tw = this.sheet.width;
            const th = this.sheet.height;
            for (let y = this.renderOrigin.y; y <= this.renderTerminus.y; y++) {
                for (let x = this.renderOrigin.x; x <= this.renderTerminus.x; x++) {
                    if (!this.grid.valid(x, y)) {
                        continue;
                    }
                    const index = this.grid.get(x, y);
                    const bounds = this.sheet.getSpriteBounds(index);
                    ctx.drawImage(this.sheet.image, bounds.x, bounds.y, tw, th, Math.round(dx + (x - this.renderOrigin.x) * tw), Math.round(dy + (y - this.renderOrigin.y) * th), tw, th);
                }
            }
        }
        calculateRenderBoundsX() {
            this.renderOrigin.x = Math.floor(this.offset.x / this.sheet.width);
            this.renderTerminus.x = Math.floor((this.offset.x + this.width) / this.sheet.width);
        }
        calculateRenderBoundsY() {
            this.renderOrigin.y = Math.floor(this.offset.y / this.sheet.height);
            this.renderTerminus.y = Math.floor((this.offset.y + this.height) / this.sheet.height);
        }
    }

    class LoadingScene extends Scene {
        update() {
            return;
        }
        init() {
            this.bg = new Box(this.width, this.height, "#140C1C");
            this.bg.position.set(this.width / 2, this.height / 2);
            this.addChild(this.bg);
            this.label = new SpriteText("Loading...");
            this.label.position.set(2, this.height - 10);
            this.addChild(this.label);
        }
    }

    class LostScene extends Scene {
        constructor() {
            super(...arguments);
            this.onRestart = () => {
                return;
            };
        }
        update() {
            if (this.keyboard.getKeyState(32)) {
                this.onRestart();
            }
        }
        set(floors, best) {
            this.score.text = String(floors);
            this.score.position.x = this.width / 2 - this.score.width / 2;
            this.best.visible = best;
        }
        init() {
            const bg = new Box(this.width, this.height, "#442434");
            bg.position.set(this.width / 2, this.height / 2);
            this.addChild(bg);
            const title = new SpriteText("You died!", 16);
            title.position.set(this.width / 2 - title.width / 2, 8);
            this.addChild(title);
            const floors = new SpriteText("Lowest Floor", 8);
            floors.position.set(this.width / 2 - floors.width / 2, 40);
            this.addChild(floors);
            const score = (this.score = new SpriteText("N", 24));
            score.position.set(this.width / 2 - score.width / 2, 56);
            this.addChild(score);
            const best = (this.best = new SpriteText("New High Score!", 8));
            best.position.set(this.width / 2 - best.width / 2, 88);
            this.addChild(best);
            const restart = new SpriteText("Press SPACE to restart", 8);
            restart.position.set(this.width / 2 - restart.width / 2, 120);
            this.addChild(restart);
        }
    }

    const OptionX = 100;
    const OptionY = 64;
    const OptionSize = 8;
    const OptionSpacing = 8;
    const Options = [
        {
            enabled: true,
            text: "New Game",
            value: 0,
        },
    ];
    class TitleScene extends Scene {
        constructor() {
            super(...arguments);
            this.cursorIndex = 0;
            this.onOptionSelect = (_option) => {
                return;
            };
        }
        update() {
            if (this.actionQueue.busy) {
                return;
            }
            if (this.keyboard.getKeyState(38) && this.cursorIndex > 0) {
                this.actionQueue.process(0, [--this.cursorIndex]);
            }
            else if (this.keyboard.getKeyState(40) &&
                this.cursorIndex < Options.length - 1) {
                this.actionQueue.process(0, [++this.cursorIndex]);
            }
            if (this.keyboard.getKeyState(32) || this.keyboard.getKeyState(13)) {
                const opt = Options[this.cursorIndex];
                if (opt.enabled) {
                    this.sounds.play("menu_select");
                    this.onOptionSelect(opt.value);
                }
                else {
                    this.actionQueue.process(1, []);
                }
            }
        }
        setHighScore(score) {
            this.high.text = `Best: ${score}`;
            this.high.position.set(2, this.height - 36);
            this.high.visible = true;
        }
        init() {
            const icons = new SpriteSheet(this.images.get("images/sprites-small.png"), 8, 8);
            const bg = new Box(this.width, this.height, "#346524");
            bg.position.set(this.width / 2, this.height / 2);
            this.addChild(bg);
            const title = new SpriteText("Sewermancer", 16);
            title.position.set(this.width / 2 - title.width / 2, 16);
            this.addChild(title);
            for (let i = 0; i < Options.length; ++i) {
                const option = Options[i];
                const opt = new SpriteText(option.text, OptionSize);
                const optY = Math.floor(OptionY + (opt.size + OptionSpacing) * i);
                opt.position.set(OptionX, optY);
                opt.opacity = option.enabled ? 1 : 0.25;
                this.addChild(opt);
            }
            this.cursor = new Sprite(icons, 1);
            this.cursor.position.copy(this.getCursorPosition(0));
            this.addChild(this.cursor);
            const high = (this.high = new SpriteText(undefined, 8));
            high.visible = false;
            this.addChild(high);
            this.actionQueue.handle(0, this.animateCursorMove.bind(this));
            this.actionQueue.handle(1, this.animateCursorNegate.bind(this));
        }
        getCursorPosition(index) {
            return {
                x: OptionX - OptionSize * 2 + 4,
                y: OptionY + (OptionSize + OptionSpacing) * index + 4,
            };
        }
        async animateCursorMove(index) {
            this.sounds.play("menu_move");
            const pos = this.getCursorPosition(index);
            await this.tweens
                .create(this.cursor.position)
                .to({
                x: pos.x,
                y: pos.y,
            }, 80)
                .promise();
        }
        async animateCursorNegate() {
            this.sounds.play("damage1");
            const x = this.cursor.position.x;
            await this.tweens
                .create(this.cursor.position)
                .to({
                x: x + 4,
            }, 25)
                .to({
                x: x - 4,
            }, 50)
                .to({
                x,
            }, 25)
                .promise();
        }
    }

    function wait(duration) {
        return new Promise((resolve) => setTimeout(resolve, duration));
    }

    const Spacing = 4;
    class IconValue extends Actor {
        constructor(sheet, sprite, value) {
            super();
            this.icon = new Sprite(sheet, sprite);
            this.icon.position.set(sheet.width / 2, sheet.height / 2);
            this.addChild(this.icon);
            this.value = new SpriteText(value);
            this.value.position.x = sheet.width / 2 + Spacing;
            this.addChild(this.value);
        }
        get width() {
            return this.icon.sheet.width + Spacing + this.value.width;
        }
        set(value) {
            this.value.text = value;
        }
    }

    const UIBarHeight = 8;
    function mapX(x) {
        return x * 16 + 8;
    }
    function mapY(y) {
        return y * 16 + 8;
    }
    class WorldScene extends Scene {
        constructor() {
            super(...arguments);
            this.unitSprites = new Map();
            this.acceptInput = true;
            this.onWon = () => {
                return;
            };
            this.onLost = () => {
                return;
            };
        }
        reset() {
            const world = this.world;
            this.tweens.cancel();
            this.actionQueue.reset();
            this.overlay.visible = false;
            this.healthValue.set(String(world.player.health));
            this.poisonValue.set("0");
            this.keysValue.set(String(this.world.inventory.get("key")));
            this.magicValue.set(String(this.world.inventory.get("magic")));
            this.floorValue.set("0");
            this.floorValue.visible = world.floor > 0;
            this.stepsValue.set("0");
            this.stepsValue.visible = this.floorValue.visible;
            this.goldValue.set("0");
            if (this.world.environment !== "") {
                this.mapView.sheet = this.tilesets[this.world.environment];
            }
            this.autoMap.resize(world.map.width, world.map.height);
            this.autoMap.update();
            this.unitSprites.forEach((sprite) => sprite.dispose());
            this.unitSprites.clear();
            world.units.forEach((unit) => this.onUnitAdd(unit));
            this.snapCamera(mapX(this.world.player.position.x), mapY(this.world.player.position.y));
        }
        setWorld(world) {
            this.world = world;
            world.onAction = (type, ...params) => {
                this.actionQueue.process(type, params, true);
            };
            const autoGridRules = this.data.get("data/automap.json");
            this.autoMap = new AutoGrid(world.map, autoGridRules);
            this.mapView.grid = this.autoMap;
            this.mapView.position.set(this.mapView.width / 2, this.mapView.height / 2 + UIBarHeight);
            this.reset();
        }
        async suppressInput(duration) {
            this.acceptInput = false;
            await wait(duration);
            this.acceptInput = true;
        }
        update() {
            if (this.acceptInput) {
                if (this.keyboard.getKeyState(37, Infinity) ||
                    this.keyboard.getKeyState(65, Infinity)) {
                    this.suppressInput(150);
                    this.world.movePlayer(3);
                }
                else if (this.keyboard.getKeyState(38, Infinity) ||
                    this.keyboard.getKeyState(87, Infinity)) {
                    this.suppressInput(150);
                    this.world.movePlayer(0);
                }
                else if (this.keyboard.getKeyState(39, Infinity) ||
                    this.keyboard.getKeyState(68, Infinity)) {
                    this.suppressInput(150);
                    this.world.movePlayer(1);
                }
                else if (this.keyboard.getKeyState(40, Infinity) ||
                    this.keyboard.getKeyState(83, Infinity)) {
                    this.suppressInput(150);
                    this.world.movePlayer(2);
                }
                else if (this.keyboard.getKeyState(32)) {
                    this.suppressInput(150);
                    this.world.activatePlayerSkill();
                }
            }
            this.world.update();
        }
        intro() {
            this.actionQueue.process(-1, []);
        }
        init() {
            this.actionQueue.handle(-1, this.animateIntro.bind(this));
            this.actionQueue.handle(13, this.animateWon.bind(this));
            this.actionQueue.handle(14, this.animateLost.bind(this));
            this.actionQueue.handle(0, this.animateStepAwait.bind(this));
            this.actionQueue.handle(12, this.animateMapChange.bind(this));
            this.actionQueue.handle(1, this.animateUnitMove.bind(this));
            this.actionQueue.handle(2, this.animateUnitNegate.bind(this));
            this.actionQueue.handle(3, this.animateUnitSpawn.bind(this));
            this.actionQueue.handle(4, this.animateUnitHealthChange.bind(this));
            this.actionQueue.handle(6, this.animateUnitKnockback.bind(this));
            this.actionQueue.handle(8, this.animateUnitRemove.bind(this));
            this.actionQueue.handle(7, this.animateUnitPickup.bind(this));
            this.actionQueue.handle(9, this.animateUnitOpen.bind(this));
            this.actionQueue.handle(10, this.animateUnitDie.bind(this));
            this.actionQueue.handle(5, this.animateUnitAttack.bind(this));
            this.actionQueue.handle(15, this.animatePlayerInventoryChange.bind(this));
            this.actionQueue.handle(16, this.animatePlayerStarve.bind(this));
            this.actionQueue.handle(17, this.animatePlayerHumanityRestore.bind(this));
            this.actionQueue.handle(18, this.animateCombust.bind(this));
            this.tilesets = {
                library: new SpriteSheet(this.images.get("images/library.png"), 16, 16),
                sewer: new SpriteSheet(this.images.get("images/sewer.png"), 16, 16),
            };
            this.sprites = new SpriteSheet(this.images.get("images/sprites.png"), 16, 16);
            this.icons = new SpriteSheet(this.images.get("images/sprites-small.png"), 8, 8);
            this.worldView = new Actor();
            this.addChild(this.worldView);
            this.mapView = new TileMap(this.width, this.height - UIBarHeight, this.tilesets.library);
            this.worldView.addChild(this.mapView);
            this.unitLayer = new Actor();
            this.unitLayer.position.y = UIBarHeight;
            this.worldView.addChild(this.unitLayer);
            const topBar = new Box(this.width, UIBarHeight, "#140C1C");
            topBar.position.set(this.width / 2, UIBarHeight / 2);
            this.addChild(topBar);
            this.healthValue = new IconValue(this.icons, 0, "0");
            this.healthValue.position.set(0, 0);
            this.addChild(this.healthValue);
            this.poisonValue = new IconValue(this.icons, 6, "0");
            this.poisonValue.position.set(32, 0);
            this.addChild(this.poisonValue);
            this.magicValue = new IconValue(this.icons, 7, "0");
            this.magicValue.position.set(64, 0);
            this.addChild(this.magicValue);
            this.keysValue = new IconValue(this.icons, 3, "0");
            this.keysValue.position.set(96, 0);
            this.addChild(this.keysValue);
            this.goldValue = new IconValue(this.icons, 4, "0");
            this.goldValue.position.set(128, 0);
            this.addChild(this.goldValue);
            this.floorValue = new IconValue(this.icons, 5, "0");
            this.floorValue.position.set(176, 0);
            this.addChild(this.floorValue);
            this.stepsValue = new IconValue(this.icons, 8, "0");
            this.stepsValue.position.set(208, 0);
            this.addChild(this.stepsValue);
            this.messageBG = new Box(this.width, UIBarHeight, "#D04648");
            this.messageBG.visible = false;
            this.addChild(this.messageBG);
            this.message = new SpriteText(undefined);
            this.message.visible = false;
            this.addChild(this.message);
            this.overlay = new Box(this.width, this.height, "#140C1C");
            this.overlay.position.set(this.width / 2, this.height / 2);
            this.overlay.visible = false;
            this.addChild(this.overlay);
        }
        getUnitSprite(id) {
            const sprite = this.unitSprites.get(id);
            if (sprite !== undefined) {
                return sprite;
            }
            else {
                throw new Error(`No sprite for unit: ${id}`);
            }
        }
        removeUnitSprite(id) {
            const sprite = this.unitSprites.get(id);
            if (sprite !== undefined) {
                sprite.dispose();
                this.unitSprites.delete(id);
            }
        }
        snapCamera(x, y) {
            this.mapView.offsetX = x - this.mapView.width / 2;
            this.mapView.offsetY = y - this.mapView.height / 2;
            this.unitLayer.position.set(-this.mapView.offsetX, -this.mapView.offsetY + UIBarHeight);
        }
        panCamera(x, y, duration) {
            const px = this.mapView.offsetX;
            const py = this.mapView.offsetY;
            this.mapView.offsetX = x - this.mapView.width / 2;
            this.mapView.offsetY = y - this.mapView.height / 2;
            const tx = this.mapView.offsetX;
            const ty = this.mapView.offsetY;
            this.mapView.offsetX = px;
            this.mapView.offsetY = py;
            this.tweens.create(this.mapView).to({
                offsetX: tx,
                offsetY: ty,
            }, duration, Ease.QuadInOut);
            this.tweens.create(this.unitLayer.position).to({
                x: -tx,
                y: -ty + UIBarHeight,
            }, duration, Ease.QuadInOut);
        }
        async animateUnitSpawn(unit) {
            this.onUnitAdd(unit);
            const sprite = this.getUnitSprite(unit.id);
            sprite.scale.set(0, 0);
            await this.tweens
                .create(sprite.scale)
                .to({
                x: 1.2,
                y: 1.2,
            }, 150)
                .to({
                x: 1,
                y: 1,
            }, 100)
                .call(() => {
                if (unit.type === "player" || unit.type === "playerAlive") {
                    this.animateUnitHealthChange(unit.id, 0, unit.health);
                    this.animatePlayerInventoryChange("food", 0, this.world.inventory.get("food"));
                }
            })
                .promise();
        }
        async animateUnitMove(unit, target) {
            const duration = 150;
            if (unit.info.role === "player") {
                this.panCamera(mapX(target.x), mapY(target.y), duration);
                this.sounds.play(this.world.steps % 2 === 0 ? "footsteps1b" : "footsteps1a");
            }
            const sprite = this.getUnitSprite(unit.id);
            const spriteX = Math.floor(sprite.position.x / 16);
            const offsetX = target.x - spriteX;
            const tween = new Tween(sprite.position);
            if (offsetX === 0) {
                const targetX = mapX(target.x);
                const targetY = mapY(target.y) - 4;
                tween.to({
                    x: targetX,
                    y: targetY,
                }, duration, Ease.QuadInOut);
            }
            else {
                const halfX = lerp$1(sprite.position.x, mapX(target.x), 0.5);
                const halfY = mapY(target.y) - 8;
                const targetX = mapX(target.x);
                const targetY = mapY(target.y) - 4;
                tween
                    .to({
                    x: halfX,
                    y: halfY,
                }, duration / 2, Ease.QuadIn)
                    .to({
                    x: targetX,
                    y: targetY,
                }, duration / 2, Ease.QuadOut);
            }
            this.tweens.add(tween);
            await tween.promise();
        }
        async animateUnitNegate(unit, target) {
            const distance = 4;
            const offset = {
                x: unit.position.x - target.x,
                y: unit.position.y - target.y,
            };
            const sprite = this.getUnitSprite(unit.id);
            await this.tweens
                .create(sprite.position)
                .to({
                x: sprite.position.x - offset.x * distance,
                y: sprite.position.y - offset.y * distance,
            }, 50)
                .to({
                x: sprite.position.x,
                y: sprite.position.y,
            }, 50)
                .wait(150)
                .promise();
        }
        async animateUnitAttack(id, position, target) {
            const distance = 8;
            const offset = {
                x: position.x - target.x,
                y: position.y - target.y,
            };
            this.sounds.play("punch1");
            const sprite = this.getUnitSprite(id);
            const tw = this.tweens.create(sprite.position).to({
                x: sprite.position.x - offset.x * distance,
                y: sprite.position.y - offset.y * distance,
            }, 60, Ease.QuadOut);
            this.tweens.create(sprite.position).wait(60).to({
                x: sprite.position.x,
                y: sprite.position.y,
            }, 80, Ease.QuadIn);
            return tw.promise();
        }
        async animateUnitPickup(id) {
            this.sounds.play("pickup1");
            const sprite = this.getUnitSprite(id);
            await this.tweens
                .create(sprite.position)
                .to({
                y: sprite.position.y - 16,
            }, 100)
                .wait(200)
                .call(() => this.removeUnitSprite(id))
                .promise();
        }
        async animateUnitRemove(id) {
            this.removeUnitSprite(id);
        }
        async animateUnitOpen(id) {
            const sprite = this.getUnitSprite(id);
            this.sounds.play("open1");
            await this.tweens
                .create(sprite.position)
                .to({
                x: sprite.position.x - 2,
            }, 75)
                .to({
                x: sprite.position.x + 2,
            }, 75)
                .to({
                x: sprite.position.x,
            }, 75)
                .call(() => this.removeUnitSprite(id))
                .promise();
        }
        async animateUnitHealthChange(id, amount, health, source) {
            if (amount !== 0) {
                if (amount < 0) {
                    this.sounds.play("damage2");
                }
                const sprite = this.getUnitSprite(id);
                this.tweens
                    .create(sprite.scale)
                    .to({
                    x: 1.3,
                    y: 1.3,
                }, 75)
                    .to({
                    x: 1,
                    y: 1,
                }, 75);
                if (id === this.world.player.id && amount < 0) {
                    const color = source === "poison" ? "#6DAA2C" : "#D04648";
                    this.showOverlay(75, color);
                    this.hideOverlay(75, 75);
                    this.shake(this.worldView, 150, 4, 1);
                    if (source === "poison") {
                        this.showMessage("You are poisoned!");
                    }
                }
            }
            if (id === this.world.player.id) {
                this.healthValue.set(String(health));
            }
        }
        async animateUnitDie(id) {
            const sprite = this.getUnitSprite(id);
            const tw = this.tweens.create(sprite);
            tw.wait(175);
            tw.to({
                opacity: 0,
            }, 150);
            tw.call(() => this.removeUnitSprite(id));
            return tw.promise();
        }
        async animateUnitKnockback(id, target) {
            const sprite = this.getUnitSprite(id);
            await this.tweens
                .create(sprite.position)
                .to({
                x: mapX(target.x),
                y: mapY(target.y),
            }, 100, Ease.QuadOut)
                .promise();
        }
        async animateMapChange(dir) {
            const overlayDuration = 200;
            this.sounds.play("stairs1");
            await this.showOverlay(overlayDuration, "#140C1C");
            await wait(overlayDuration);
            this.resetMessage();
            this.unitSprites.forEach((sprite) => sprite.dispose());
            this.unitSprites.clear();
            const floor = this.world.floor + (dir === "down" ? 1 : -1);
            this.world.loadMap(floor);
            this.mapView.sheet = this.tilesets[this.world.environment];
            this.floorValue.set(String(floor));
            this.floorValue.visible = floor > 0;
            this.stepsValue.set(String(this.world.steps));
            this.stepsValue.visible = this.floorValue.visible;
            this.autoMap.resize(this.world.map.width, this.world.map.height);
            this.autoMap.update();
            this.world.units.forEach((unit) => this.onUnitAdd(unit));
            this.snapCamera(mapX(this.world.player.position.x), mapY(this.world.player.position.y));
            await this.hideOverlay(overlayDuration);
            switch (this.world.affix) {
                case "combust":
                    this.showMessage("Warm air crackles around you...");
                    break;
                case "vengeful":
                    this.showMessage("A chill runs down your spine...");
                    break;
            }
        }
        async animateWon() {
            await this.tweens
                .create(this)
                .wait(250)
                .call(() => this.onWon())
                .promise();
        }
        async animateLost() {
            this.sounds.play("negative1");
            await this.showOverlay(1500, "#D04648");
            await this.tweens
                .create(this)
                .wait(500)
                .call(() => this.onLost())
                .promise();
        }
        async animateStepAwait() {
            this.world.step();
            this.stepsValue.set(String(this.world.steps));
        }
        async animatePlayerInventoryChange(type, _amount, count) {
            switch (type) {
                case "poison":
                    this.poisonValue.set(String(count));
                    break;
                case "magic":
                    this.magicValue.set(String(count));
                    break;
                case "key":
                    this.keysValue.set(String(count));
                    break;
                case "gold":
                    this.goldValue.set(String(count));
                    break;
            }
        }
        async animatePlayerStarve() {
            if (this.world.player.type === "player") {
                this.showMessage("You starved to death!");
            }
            else {
                this.showMessage("You are starving, find food!");
            }
        }
        async animatePlayerHumanityRestore() {
            this.showMessage("Humanity restored!", "powerup10");
        }
        async animateCombust(positions) {
            for (const pos of positions) {
                this.spawnEffect(pos.x, pos.y, 17);
            }
            this.shake(this.worldView, 150, 4, 1);
        }
        spawnEffect(x, y, sprite) {
            const effect = new Sprite(this.sprites, sprite);
            effect.position.x = mapX(x);
            effect.position.y = mapY(y);
            this.unitLayer.addChild(effect);
            this.tweens
                .create(effect)
                .to({
                opacity: 0,
                rotation: Math.PI,
            }, 150)
                .call(() => effect.dispose());
            this.tweens.create(effect.scale).to({
                x: 2,
                y: 2,
            }, 150);
        }
        async animateIntro() {
            const duration = 800;
            const sprite = this.getUnitSprite(this.world.player.id);
            sprite.opacity = 0;
            sprite.position.y += 8;
            sprite.scale.y = 0;
            await this.tweens
                .create(sprite)
                .wait(500)
                .call(() => {
                this.showMessage("RISE!");
                this.shake(this.worldView, 1000, 10, 1);
            })
                .wait(650)
                .call(() => this.sounds.play("portal6"))
                .wait(350)
                .promise();
            this.tweens.create(sprite).to({
                opacity: 1,
            }, duration, Ease.QuadInOut);
            this.tweens.create(sprite.position).to({
                y: sprite.position.y - 8,
            }, duration, Ease.QuadInOut);
            this.tweens.create(sprite.scale).to({
                y: 1,
            }, duration, Ease.QuadInOut);
            await this.shake(sprite, duration, 5, 1).promise();
        }
        onUnitAdd(unit) {
            var _a, _b;
            if (this.unitSprites.has(unit.id)) {
                console.warn(`Unit sprite ${unit.id} exists`);
                return;
            }
            const sprite = new Sprite(this.sprites, unit.info.sprite);
            if (unit.forSale) {
                const cost = new IconValue(this.icons, 4, String((_b = (_a = unit.info.data) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0));
                cost.position.set(-cost.width / 2, -16);
                sprite.addChild(cost);
            }
            const offset = unit.info.flat ? 0 : 4;
            sprite.position.set(mapX(unit.position.x), mapY(unit.position.y) - offset);
            sprite.drawOrder = unit.info.drawOrder;
            this.unitSprites.set(unit.id, sprite);
            this.unitLayer.addChild(sprite);
        }
        showMessage(text, sound) {
            let y = this.height - 16;
            const playerSprite = this.unitSprites.get(this.world.player.id);
            if (playerSprite !== undefined &&
                playerSprite.position.y + this.unitLayer.position.y > this.height * 0.75) {
                y = 32;
            }
            this.messageBG.position.set(this.width / 2, y);
            this.messageBG.opacity = 0;
            this.messageBG.visible = true;
            this.tweens
                .create(this.messageBG)
                .to({
                opacity: 1,
            }, 250)
                .wait(2500)
                .to({
                opacity: 0,
            }, 250)
                .call(() => (this.messageBG.visible = false));
            this.message.text = text;
            this.message.position.set(this.width / 2 - this.message.width / 2, y - this.message.size / 2);
            this.message.opacity = 0;
            this.message.visible = true;
            this.tweens
                .create(this.message)
                .to({
                opacity: 1,
            }, 250)
                .wait(2500)
                .to({
                opacity: 0,
            }, 250)
                .call(() => (this.message.visible = false));
            this.sounds.play(sound !== null && sound !== void 0 ? sound : "interaction13");
        }
        resetMessage() {
            this.tweens.cancel(this.messageBG);
            this.tweens.cancel(this.message);
            this.messageBG.visible = false;
            this.message.visible = false;
        }
        async showOverlay(duration, fillStyle) {
            this.overlay.fillStyle = fillStyle;
            this.overlay.opacity = 0;
            this.overlay.visible = true;
            await this.tweens
                .create(this.overlay)
                .to({
                opacity: 1,
            }, duration, Ease.QuadIn)
                .promise();
        }
        async hideOverlay(duration, delay = 0) {
            await this.tweens
                .create(this.overlay)
                .wait(delay)
                .to({
                opacity: 0,
            }, duration, Ease.QuadOut)
                .call(() => (this.overlay.visible = false))
                .promise();
        }
        shake(actor, duration, iterations, amount) {
            const tw = this.tweens.create(actor.position);
            const d = (duration * 2) / iterations / 4;
            const x = actor.position.x;
            tw.to({
                x: x - amount,
            }, d, Ease.QuadOut)
                .to({
                x: x + amount,
            }, d * 2, Ease.QuadInOut)
                .to({
                x,
            }, d, Ease.QuadIn)
                .loop(iterations - 1);
            this.tweens.add(tw);
            return tw;
        }
    }

    class Bag {
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

    class BagSet {
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

    class Inventory {
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

    class Unit {
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

    function flipDirection$1(direction) {
        switch (direction) {
            case 1: return 4;
            case 2: return 8;
            case 4: return 1;
            case 8: return 2;
        }
    }

    const RoomShapeSymbols = ["O", "U", "I", "L", "T", "X"];
    class Room {
        constructor(id, x, y, parentId = 0) {
            this.role = 0;
            this.rotation = 0;
            this.shape = 0;
            this.exits = 0;
            this.properties = new Map();
            this.exitMask = 0;
            this.id = id;
            this.x = x;
            this.y = y;
            this.parentId = parentId;
        }
        get shapeSymbol() {
            return RoomShapeSymbols[this.shape];
        }
        getProperty(name) {
            return this.properties.get(name);
        }
        setProperty(name, value) {
            this.properties.set(name, value);
        }
        addExit(direction) {
            this.exitMask |= direction;
            this.exits++;
        }
        hasExit(...directions) {
            for (const direction of directions) {
                if ((this.exitMask & direction) === 0) {
                    return false;
                }
            }
            return true;
        }
        getDirectionToRoom(room) {
            const dx = room.x - this.x;
            const dy = room.y - this.y;
            if (dy < 0) {
                return 1;
            }
            if (dx > 0) {
                return 2;
            }
            if (dy > 0) {
                return 4;
            }
            if (dx < 0) {
                return 8;
            }
            throw new Error(`Failed to get direction between rooms at ${this.x}, ${this.y} and ${room.x}, ${room.y}`);
        }
        connectToRoom(room) {
            const dir = this.getDirectionToRoom(room);
            this.addExit(dir);
            room.addExit(flipDirection$1(dir));
        }
        updateShape(rng) {
            switch (this.exits) {
                case 4:
                    this.shape = 5;
                    this.rotation = rng.integer(0, 3);
                    break;
                case 3:
                    this.shape = 4;
                    if (!this.hasExit(1)) {
                        this.rotation = 0;
                    }
                    else if (!this.hasExit(2)) {
                        this.rotation = 1;
                    }
                    else if (!this.hasExit(4)) {
                        this.rotation = 2;
                    }
                    else {
                        this.rotation = 3;
                    }
                    break;
                case 2:
                    if (this.hasExit(1, 4)) {
                        this.shape = 2;
                        this.rotation = rng.chance(0.5) ? 2 : 0;
                    }
                    else if (this.hasExit(2, 8)) {
                        this.shape = 2;
                        this.rotation = rng.chance(0.5) ? 1 : 3;
                    }
                    else if (this.hasExit(1, 2)) {
                        this.shape = 3;
                        this.rotation = 0;
                    }
                    else if (this.hasExit(2, 4)) {
                        this.shape = 3;
                        this.rotation = 1;
                    }
                    else if (this.hasExit(4, 8)) {
                        this.shape = 3;
                        this.rotation = 2;
                    }
                    else {
                        this.shape = 3;
                        this.rotation = 3;
                    }
                    break;
                case 1:
                    this.shape = 1;
                    if (this.hasExit(1)) {
                        this.rotation = 0;
                    }
                    else if (this.hasExit(2)) {
                        this.rotation = 1;
                    }
                    else if (this.hasExit(4)) {
                        this.rotation = 2;
                    }
                    else {
                        this.rotation = 3;
                    }
                    break;
                default:
                    this.shape = 0;
                    this.rotation = 0;
                    break;
            }
        }
    }

    class Floor {
        constructor() {
            this.grid = new Grid();
            this.rooms = new Map();
            this.nextRoomId = 1;
        }
        get emptyCells() {
            let count = 0;
            for (const id of this.grid.cells) {
                if (id === 0) {
                    count++;
                }
            }
            return count;
        }
        reset() {
            this.grid.resize(0, 0);
            this.rooms.clear();
            this.nextRoomId = 1;
        }
        createRoom(x, y, parentId = 0) {
            const room = new Room(this.nextRoomId++, x, y, parentId);
            this.grid.set(x, y, room.id);
            this.rooms.set(room.id, room);
            return room;
        }
        forEachRoom(handler) {
            this.grid.forEach((id) => {
                if (id === 0) {
                    return;
                }
                const room = this.rooms.get(id);
                if (room !== undefined) {
                    handler(room);
                }
            });
        }
        forEachAdjacentRoom(x, y, handler) {
            this.grid.forEachAdjacent(x, y, (id) => {
                if (id === 0) {
                    return;
                }
                const room = this.rooms.get(id);
                if (room !== undefined) {
                    handler(room);
                }
            });
        }
        getRooms(filter) {
            const rooms = [];
            for (const id of this.grid.cells) {
                if (id === 0) {
                    continue;
                }
                const room = this.rooms.get(id);
                if (room !== undefined && (filter === undefined || filter(room))) {
                    rooms.push(room);
                }
            }
            return rooms;
        }
        getFirstRoom(filter) {
            for (const id of this.grid.cells) {
                if (id === 0) {
                    continue;
                }
                const room = this.rooms.get(id);
                if (room !== undefined && filter(room)) {
                    return room;
                }
            }
        }
        getAdjacentRooms(x, y, filter) {
            const rooms = [];
            this.forEachAdjacentRoom(x, y, (room) => {
                if (filter === undefined || filter(room)) {
                    rooms.push(room);
                }
            });
            return rooms;
        }
        getEmptyCells() {
            const cells = [];
            this.grid.forEach((id, x, y) => {
                if (id === 0) {
                    cells.push({ x, y });
                }
            });
            return cells;
        }
        getEmptyAdjacentCells(x, y, filter) {
            const cells = [];
            this.grid.forEachAdjacent(x, y, (id, x1, y1) => {
                if (id === 0 && (filter === undefined || filter(x1, y1))) {
                    cells.push({ x: x1, y: y1 });
                }
            });
            return cells;
        }
    }

    class Generator {
        constructor() {
            this.random = new Random();
            this.floor = new Floor();
        }
        generate() {
            this.random.reset();
            this.floor.reset();
            this.gen();
            return this.floor;
        }
    }

    class StandardGenerator extends Generator {
        constructor(width, height) {
            super();
            this.width = width;
            this.height = height;
        }
        gen() {
            this.floor.grid.resize(this.width, this.height);
            this.createCriticalPath();
            while (this.floor.emptyCells > 0) {
                const pool = this.floor.getRooms((room) => {
                    return room.role !== 3 &&
                        this.floor.getEmptyAdjacentCells(room.x, room.y).length > 0;
                });
                const r = this.random.choice(pool);
                this.createArea(r.x, r.y);
            }
            this.floor.rooms.forEach((room) => room.updateShape(this.random));
        }
        createCriticalPath() {
            const floor = this.floor;
            const sx = this.random.integer(0, floor.grid.width - 1);
            const sy = floor.grid.height - 1;
            let room = floor.createRoom(sx, sy);
            room.role = 1;
            let done = false;
            while (!done) {
                const r = this.createRandomAdjacentRoom(room, (_x, y) => y <= room.y);
                if (r !== undefined) {
                    room = r;
                    room.setProperty("critical", true);
                    if (room.y === 0) {
                        room.role = 3;
                        done = true;
                    }
                }
                else {
                    throw new Error(`Could not create adjacent room on critical path: ${room.x}, ${room.y}`);
                }
            }
        }
        createRandomAdjacentRoom(room, filter) {
            const empty = this.floor.getEmptyAdjacentCells(room.x, room.y, filter);
            if (empty.length < 1) {
                return;
            }
            const cell = this.random.choice(empty);
            const next = this.floor.createRoom(cell.x, cell.y, room.id);
            room.connectToRoom(next);
            return next;
        }
        createArea(x, y) {
            const id = this.floor.grid.get(x, y);
            let room = this.floor.rooms.get(id);
            while (room !== undefined) {
                room = this.createRandomAdjacentRoom(room);
            }
        }
    }

    const RoomRoles = ["generic", "start", "boss", "end"];
    class Level {
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

    function applyDirection(point, direction) {
        switch (direction) {
            case 0:
                point.y--;
                return;
            case 1:
                point.x++;
                return;
            case 2:
                point.y++;
                return;
            case 3:
                point.x--;
                return;
        }
    }
    function flipDirection(direction) {
        return (direction + 2) % 4;
    }
    function getDirection(x, y) {
        if (x < 0) {
            return 3;
        }
        else if (x > 0) {
            return 1;
        }
        else if (y < 0) {
            return 0;
        }
        else {
            return 2;
        }
    }
    function getUnitDirection(unit, target) {
        return getDirection(target.position.x - unit.position.x, target.position.y - unit.position.y);
    }
    function getUnitDistance(unit, target) {
        return manhattanDistance(unit.position.x, unit.position.y, target.position.x, target.position.y);
    }
    class World {
        constructor(data) {
            this.units = new Map();
            this.inventory = new Inventory();
            this.steps = 0;
            this.nextUnitId = 1;
            this.rng = new Random();
            this.map = new Grid(0, 0);
            this.mapCache = new Map();
            this.timeElapsed = 0;
            this.timeLast = Date.now();
            this.awaitingMapChange = false;
            this.floorIndex = -1;
            this.getTimeElapsed = () => this.timeElapsed;
            this.onAction = (_type, ..._params) => {
                return;
            };
            this.config = data.get("data/world.json");
            this.prefabs = data.get("data/prefabs.json");
            const bagsData = data.get("data/bags.json");
            this.bags = new BagSet(this.rng, bagsData);
            this.level = new Level(data, this.bags);
            this.player = this.createUnit("player");
        }
        get floor() {
            return this.floorIndex;
        }
        get over() {
            return this.player.health < 1;
        }
        get environment() {
            return this.level.environment;
        }
        restart() {
            this.steps = 0;
            this.floorIndex = -1;
            this.timeElapsed = 0;
            this.timeLast = Date.now();
            this.player = this.createUnit("player");
            this.player.health = this.player.info.health;
            this.inventory.empty();
            for (const type in this.config.inventory) {
                this.inventory.add(type, this.config.inventory[type]);
            }
            this.units.clear();
            this.mapCache.clear();
            this.nextUnitId = 1;
            this.loadMap(0);
        }
        getUnitInfo(type) {
            const info = this.prefabs[type];
            if (info !== undefined) {
                return info;
            }
            else {
                throw new Error(`Invalid unit type: ${type}`);
            }
        }
        loadMap(floor) {
            this.unloadMap();
            this.generateMap(floor);
            this.addUnit(this.player);
            this.player.position.set(this.level.start.x, this.level.start.y);
            this.floorIndex = floor;
            this.awaitingMapChange = false;
        }
        addUnit(unit) {
            unit.id = this.nextUnitId++;
            this.units.set(unit.id, unit);
        }
        removeUnit(unit) {
            this.units.delete(unit.id);
        }
        spawnUnitCorpse(unit) {
            if (unit.info.corpse) {
                const corpse = this.createUnit(unit.info.corpse);
                corpse.position.set(unit.position.x, unit.position.y);
                this.addUnit(corpse);
                this.onAction(3, corpse);
            }
        }
        createUnit(type) {
            return new Unit(type, this.getUnitInfo(type));
        }
        activatePlayerSkill() {
            if (this.over) {
                return;
            }
            if (this.removePlayerInventory("magic", 1)) {
                const px = this.player.position.x;
                const py = this.player.position.y;
                const radius = 2;
                const sx = this.player.position.x - radius;
                const sy = this.player.position.y - radius;
                const size = radius * 2 + 1;
                const positions = [];
                this.map.forEachInArea(sx, sy, size, size, (value, x, y) => {
                    if (value !== 0 || (x === px && y === py)) {
                        return;
                    }
                    if (distance(px, py, x, y) <= radius) {
                        positions.push({ x, y });
                        const units = this.getUnitsAt(x, y);
                        for (const unit of units) {
                            if (unit.info.role === "player" ||
                                unit.info.role === "warp") {
                                return;
                            }
                            this.damageUnit(unit, 1);
                        }
                    }
                    this.onAction(18, positions);
                });
            }
            else {
                this.onAction(2, this.player, {
                    x: this.player.position.x,
                    y: this.player.position.y - 1,
                });
            }
            this.steps++;
            this.onAction(0);
        }
        movePlayer(direction) {
            if (this.over) {
                return;
            }
            this.steps += 1;
            this.moveUnit(this.player, direction);
            if (this.checkGameOver() || this.awaitingMapChange) {
                return;
            }
            const pos = this.player.position;
            if (pos.x < 0 ||
                pos.y < 0 ||
                pos.x >= this.map.width ||
                pos.y >= this.map.height) {
                this.onAction(11, direction);
            }
            else {
                this.onAction(0);
            }
        }
        step() {
            this.units.forEach((unit) => {
                if (this.over) {
                    return;
                }
                this.updateUnit(unit);
            });
            if (this.steps % 20 === 0) {
                const poisonDamage = Math.floor(this.inventory.get("poison") / 25);
                if (poisonDamage > 0) {
                    this.damageUnit(this.player, poisonDamage, "poison");
                }
            }
            this.checkGameOver();
        }
        update() {
            const timeDelta = Date.now() - this.timeLast;
            this.timeElapsed += timeDelta;
            this.timeLast = Date.now();
        }
        getUnitByType(type) {
            for (const [, unit] of this.units) {
                if (unit.type === type) {
                    return unit;
                }
            }
        }
        getUnitAt(x, y) {
            for (const [, unit] of this.units) {
                if (unit.position.x === x && unit.position.y === y) {
                    return unit;
                }
            }
        }
        getUnitsAt(x, y) {
            const units = [];
            for (const [, unit] of this.units) {
                if (unit.position.x === x && unit.position.y === y) {
                    units.push(unit);
                }
            }
            return units;
        }
        checkGameOver() {
            if (this.player.health < 1) {
                this.onAction(14);
                return true;
            }
            if (this.inventory.has("crown")) {
                this.onAction(13);
                return true;
            }
            return false;
        }
        generateMap(floor) {
            if (floor === 0) {
                this.level.load("library");
            }
            else if (floor % 3 === 0) {
                this.level.load("shop");
            }
            else {
                this.level.generate(2, 3, "sewer");
            }
            this.map.resize(this.level.map.width, this.level.map.height);
            this.map.copy(this.level.map);
            for (const entity of this.level.entities) {
                const unit = this.spawnUnit(entity.type, entity.x, entity.y, true);
                if (entity.forSale) {
                    unit.forSale = true;
                }
            }
        }
        unloadMap() {
            this.steps = 0;
            this.units.clear();
        }
        moveUnit(unit, direction) {
            const target = new Vector2(unit.position.x, unit.position.y);
            applyDirection(target, direction);
            if (this.isBlocked(unit, direction, false)) {
                this.onAction(2, unit, target);
                return;
            }
            const others = this.getUnitsAt(target.x, target.y);
            if (!others.some((u) => u.info.solid)) {
                unit.position.set(target.x, target.y);
                this.onAction(1, unit, target);
            }
            this.triggerUnitInteractions(unit, others);
        }
        triggerUnitInteractions(unit, others) {
            for (const other of others) {
                if (unit.id === other.id) {
                    continue;
                }
                if (!this.units.has(unit.id) || !this.units.has(other.id)) {
                    continue;
                }
                if ((unit.info.role === "player" && other !== undefined) ||
                    (unit.info.role === "monster" &&
                        ((other === null || other === void 0 ? void 0 : other.info.role) === "player" ||
                            (other === null || other === void 0 ? void 0 : other.info.role) === "trap"))) {
                    this.interactUnits(unit, other);
                }
            }
        }
        damageUnit(unit, amount, source) {
            var _a;
            unit.health -= amount;
            this.onAction(4, unit.id, -amount, unit.health, source);
            if (unit.health < 1) {
                this.removeUnit(unit);
                this.onAction(10, unit.id, unit.type);
                if (unit.type === "playerAlive") {
                    this.player = this.spawnUnit("player", unit.position.x, unit.position.y);
                }
                if (((_a = unit.info.data) === null || _a === void 0 ? void 0 : _a.loot) !== undefined) {
                    const drop = this.bags.get(unit.info.data.loot);
                    if (drop !== "") {
                        this.spawnUnit(drop, unit.position.x, unit.position.y);
                    }
                }
                if (this.affix === "combust" && unit.info.role === "monster") {
                    const flame = this.spawnUnit("flame", unit.position.x, unit.position.y);
                    flame.ttl = 10;
                }
                if (this.affix === "vengeful" && unit.info.role === "monster") {
                    const ghost = this.spawnUnit("ghost", unit.position.x, unit.position.y);
                    ghost.ttl = 3;
                }
            }
        }
        spawnUnit(type, x, y, quiet = false) {
            const unit = this.createUnit(type);
            unit.asleep = true;
            unit.position.set(x, y);
            this.addUnit(unit);
            if (!quiet) {
                this.onAction(3, unit);
            }
            return unit;
        }
        interactUnits(unit, target) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const info = target.info;
            if (target.forSale &&
                (info.role === "pickup" ||
                    info.role === "restore_health" ||
                    info.role === "cure_poison")) {
                const cost = (_b = (_a = info.data) === null || _a === void 0 ? void 0 : _a.cost) !== null && _b !== void 0 ? _b : 0;
                if (!this.canPlayerUseItem(target) ||
                    !this.removePlayerInventory("gold", cost)) {
                    this.onAction(2, target, {
                        x: target.position.x,
                        y: target.position.y - 1,
                    });
                    return;
                }
            }
            switch (info.role) {
                case "monster":
                case "player":
                case "doodad":
                    this.onAction(5, unit.id, unit.position, target.position);
                    if ((unit.info.role === "player" &&
                        this.inventory.has("powerGloves")) ||
                        unit.type === "giant_skeleton" ||
                        unit.type === "zombie") {
                        const kx = target.position.x + (target.position.x - unit.position.x);
                        const ky = target.position.y + (target.position.y - unit.position.y);
                        if (!this.isBlockedXY(kx, ky)) {
                            target.position.set(kx, ky);
                            this.onAction(6, target.id, {
                                x: kx,
                                y: ky,
                            });
                            const others = this.getUnitsAt(kx, ky);
                            this.triggerUnitInteractions(target, others);
                        }
                    }
                    this.damageUnit(target, 1);
                    break;
                case "trap":
                    this.damageUnit(unit, 1);
                    break;
                case "pickup":
                    if (!this.canPlayerUseItem(target)) {
                        this.onAction(2, target, {
                            x: target.position.x,
                            y: target.position.y - 1,
                        });
                        break;
                    }
                    this.removeUnit(target);
                    this.onAction(7, target.id);
                    this.addPlayerInventory(info.data.pickup.type, info.data.pickup.amount);
                    break;
                case "restore_health":
                    this.removeUnit(target);
                    this.onAction(7, target.id);
                    const amount = (_d = (_c = info.data) === null || _c === void 0 ? void 0 : _c.heal) !== null && _d !== void 0 ? _d : 0;
                    if (amount > 0) {
                        unit.health += amount;
                        this.onAction(4, unit.id, amount, unit.health);
                    }
                    break;
                case "cure_poison": {
                    this.removeUnit(target);
                    this.onAction(7, target.id);
                    const amount = (_f = (_e = info.data) === null || _e === void 0 ? void 0 : _e.cure) !== null && _f !== void 0 ? _f : 0;
                    if (amount > 0) {
                        this.removePlayerInventory("poison", amount, true);
                    }
                    break;
                }
                case "door":
                    if (this.removePlayerInventory(info.data, 1)) {
                        this.removeUnit(target);
                        this.onAction(9, target.id);
                    }
                    else {
                        this.onAction(2, unit, target.position);
                    }
                    break;
                case "warp":
                    this.awaitingMapChange = true;
                    this.onAction(12, (_h = (_g = target.info.data) === null || _g === void 0 ? void 0 : _g.warp) !== null && _h !== void 0 ? _h : "down");
                    break;
            }
        }
        isBlockedXY(x, y, forceEmpty = false) {
            const tile = this.map.get(x, y);
            if (this.config.walkable.indexOf(tile) === -1) {
                return true;
            }
            const unit = this.getUnitAt(x, y);
            if (unit !== undefined && (unit.info.solid || forceEmpty)) {
                return true;
            }
            return false;
        }
        isBlocked(unit, direction, includeSolid = true) {
            const target = new Vector2(unit.position.x, unit.position.y);
            applyDirection(target, direction);
            let tile = -1;
            if (this.map.valid(target.x, target.y)) {
                tile = this.map.get(target.x, target.y);
            }
            if (tile === -1 && unit !== this.player) {
                return true;
            }
            if (tile !== -1 && this.config.walkable.indexOf(tile) === -1) {
                return true;
            }
            if (includeSolid) {
                const other = this.getUnitAt(target.x, target.y);
                if (other !== undefined && other.info.solid) {
                    return true;
                }
            }
            return false;
        }
        updateUnit(unit) {
            if (unit.asleep) {
                unit.asleep = false;
                return;
            }
            if (unit.ttl > -1) {
                if (unit.ttl === 0) {
                    this.removeUnit(unit);
                    this.onAction(8, unit.id);
                    return;
                }
                else {
                    unit.ttl--;
                }
            }
            switch (unit.info.behavior) {
                case "replicate":
                    this.behaviorReplicate(unit);
                    break;
                case "random":
                    this.behaviorRandom(unit);
                    break;
                case "move_horz":
                    if (getUnitDistance(unit, this.player) === 1) {
                        this.moveUnit(unit, getUnitDirection(unit, this.player));
                        break;
                    }
                    if (unit.data.dir === undefined) {
                        unit.data.dir = this.rng.chance(0.5)
                            ? 3
                            : 1;
                    }
                    if (this.isBlocked(unit, unit.data.dir)) {
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    this.moveUnit(unit, unit.data.dir);
                    break;
                case "move_vert":
                    if (getUnitDistance(unit, this.player) === 1) {
                        this.moveUnit(unit, getUnitDirection(unit, this.player));
                        break;
                    }
                    if (unit.data.dir === undefined) {
                        unit.data.dir = this.rng.chance(0.5) ? 0 : 2;
                    }
                    if (this.isBlocked(unit, unit.data.dir)) {
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    this.moveUnit(unit, unit.data.dir);
                    break;
                case "hunt":
                    this.behaviorHunt(unit);
                    break;
                case "retreat":
                    this.behaviorRetreat(unit);
                    break;
                case "trap_horz": {
                    if (unit.data.dir === undefined) {
                        unit.data.dir = this.rng.chance(0.5)
                            ? 3
                            : 1;
                    }
                    const pointCopy = {
                        x: unit.position.x,
                        y: unit.position.y,
                    };
                    applyDirection(pointCopy, unit.data.dir);
                    const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
                    if (targetUnit === undefined) {
                        if (this.isBlocked(unit, unit.data.dir)) {
                            unit.data.dir = flipDirection(unit.data.dir);
                        }
                        this.moveUnit(unit, unit.data.dir);
                    }
                    else {
                        this.interactUnits(unit, targetUnit);
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    break;
                }
                case "trap_vert": {
                    if (unit.data.dir === undefined) {
                        unit.data.dir = this.rng.chance(0.5) ? 0 : 2;
                    }
                    const pointCopy = {
                        x: unit.position.x,
                        y: unit.position.y,
                    };
                    applyDirection(pointCopy, unit.data.dir);
                    const targetUnit = this.getUnitAt(pointCopy.x, pointCopy.y);
                    if (targetUnit === undefined) {
                        if (this.isBlocked(unit, unit.data.dir)) {
                            unit.data.dir = flipDirection(unit.data.dir);
                        }
                        this.moveUnit(unit, unit.data.dir);
                    }
                    else {
                        this.interactUnits(unit, targetUnit);
                        unit.data.dir = flipDirection(unit.data.dir);
                    }
                    break;
                }
                case "fire_spout": {
                    if (unit.data.step === undefined) {
                        unit.data.step = 0;
                    }
                    unit.data.step += 1;
                    if (unit.data.step > 3) {
                        unit.data.step = 1;
                    }
                    switch (unit.data.step) {
                        case 1:
                            console.log("wait");
                            break;
                        case 2:
                            console.log("warn");
                            break;
                        case 3:
                            console.log("spout");
                            break;
                    }
                    break;
                }
                case "straight_then_turn": {
                    const dirs = [
                        0,
                        1,
                        2,
                        3,
                    ];
                    if (unit.data.dir === undefined) {
                        unit.data.dirStep = 0;
                        unit.data.dir = dirs[unit.data.dirStep];
                    }
                    if (this.isBlocked(unit, unit.data.dir)) {
                        unit.data.dirStep += 1;
                        if (unit.data.dirStep >= dirs.length) {
                            unit.data.dirStep = 0;
                        }
                        unit.data.dir = dirs[unit.data.dirStep];
                    }
                    this.moveUnit(unit, unit.data.dir);
                    break;
                }
            }
        }
        behaviorReplicate(unit) {
            const others = this.getUnitsAt(unit.position.x, unit.position.y);
            for (const other of others) {
                if (other !== undefined && other.info.role === "player") {
                    this.addPlayerInventory("poison", 1);
                }
            }
            if (this.steps % 20 !== 0) {
                return;
            }
            let neighbors = 0;
            for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
                for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                    if (x === unit.position.x && y === unit.position.y) {
                        continue;
                    }
                    const other = this.getUnitAt(x, y);
                    if (other !== undefined && other.type === unit.type) {
                        neighbors++;
                    }
                }
            }
            if (neighbors === 8) {
                for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
                    for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                        const other = this.getUnitAt(x, y);
                        if (other !== undefined && other.type === unit.type) {
                            this.removeUnit(other);
                            this.onAction(10, other.id, other.type);
                        }
                    }
                }
                this.spawnUnit("slime_green", unit.position.x, unit.position.y);
            }
            else if ((neighbors < 1 || neighbors > 4) && Math.random() > 0.5) {
                this.removeUnit(unit);
                this.onAction(10, unit.id, unit.type);
            }
            else if (neighbors > 1 && neighbors < 4 && Math.random() > 0.5) {
                const points = [];
                for (let y = unit.position.y - 1; y <= unit.position.y + 1; y++) {
                    for (let x = unit.position.x - 1; x <= unit.position.x + 1; x++) {
                        if (!this.isBlockedXY(x, y, true)) {
                            points.push({ x, y });
                        }
                    }
                }
                if (points.length > 0) {
                    const point = this.rng.choice(points);
                    this.spawnUnit(unit.type, point.x, point.y);
                }
            }
        }
        behaviorRandom(unit) {
            const valid = [];
            for (let d = 0; d <= 3; ++d) {
                const target = new Vector2(unit.position.x, unit.position.y);
                applyDirection(target, d);
                const other = this.getUnitAt(target.x, target.y);
                if (other !== undefined && other.info.role === "player") {
                    valid.length = 0;
                    valid.push(d);
                    break;
                }
                else if (!this.isBlocked(unit, d)) {
                    valid.push(d);
                }
            }
            if (valid.length > 0) {
                const index = this.rng.integer(0, valid.length - 1);
                this.moveUnit(unit, valid[index]);
            }
        }
        behaviorHunt(unit) {
            const direction = getUnitDirection(unit, this.player);
            if (this.isBlocked(unit, direction)) {
                this.behaviorRandom(unit);
            }
            else {
                this.moveUnit(unit, direction);
            }
        }
        behaviorRetreat(unit) {
            const direction = flipDirection(getUnitDirection(unit, this.player));
            if (this.isBlocked(unit, direction)) {
                this.behaviorRandom(unit);
            }
            else {
                this.moveUnit(unit, direction);
            }
        }
        addPlayerInventory(type, amount) {
            this.inventory.add(type, amount);
            this.onAction(15, type, amount, this.inventory.get(type));
        }
        removePlayerInventory(type, amount, force = false) {
            const success = this.inventory.remove(type, amount, force);
            if (success) {
                this.onAction(15, type, amount, this.inventory.get(type));
            }
            return success;
        }
        canPlayerUseItem(_item) {
            return true;
        }
    }

    function getSave() {
        const data = localStorage.getItem("save");
        if (data !== null) {
            return JSON.parse(data);
        }
        else {
            return {
                highScore: 0,
            };
        }
    }
    function setSave(save) {
        localStorage.setItem("save", JSON.stringify(save));
    }

    const BootConfig = {
        Width: 256,
        Height: 160,
        ConfigFile: "data/config.json",
    };
    const save = getSave();
    async function main() {
        function restart() {
            world.restart();
            worldScene.reset();
            game.activateScene("world");
        }
        const game = new Game(BootConfig.Width, BootConfig.Height);
        const config = (await game.data.load(BootConfig.ConfigFile));
        const fontImage = await game.images.load(config.font.image);
        SpriteText.DefaultFont = {
            glyphs: config.font.glyphs,
            sheet: new SpriteSheet(fontImage, config.font.width, config.font.height),
        };
        game.addScene("loading", LoadingScene);
        game.activateScene("loading");
        game.start();
        game.sounds.volume = config.soundVolume;
        game.sounds.register(config.preload.sounds);
        await Promise.all([
            game.images.loadBatch(config.preload.images),
            game.data.loadBatch(config.preload.data),
        ]);
        game.keyboard.onFirstInteract = () => {
            game.sounds.play("menu_select", 0.000001);
        };
        const world = new World(game.data);
        const titleScene = game.addScene("title", TitleScene);
        if (save.highScore > 0) {
            titleScene.setHighScore(save.highScore);
        }
        titleScene.onOptionSelect = (option) => {
            if (option === 0) {
                restart();
            }
            else if (option === 1) {
                console.warn("TBD: Continue game");
            }
        };
        const lostScene = game.addScene("lost", LostScene);
        lostScene.onRestart = () => restart();
        const worldScene = game.addScene("world", WorldScene);
        worldScene.onWon = () => game.activateScene("won");
        worldScene.onLost = () => {
            let best = false;
            if (world.floor > save.highScore) {
                save.highScore = world.floor;
                setSave(save);
                best = true;
            }
            lostScene.set(world.floor, best);
            game.activateScene("lost");
        };
        worldScene.setWorld(world);
        game.activateScene(config.entryScene);
    }
    main().catch((e) => {
        console.error(`Boot error: ${e.message}`);
    });

})();
