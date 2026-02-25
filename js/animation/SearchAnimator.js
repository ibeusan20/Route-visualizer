export class SearchAnimator {
    constructor() {
        this.events = [];
        this.index = 0;
        this.running = false;
        this.paused = false;
        this.timerId = null;
        this.meta = null;

        this.speedProvider = null;
        this.onEvent = null;
        this.onComplete = null;
    }

    start({ events, meta, speedProvider, onEvent, onComplete }) {
        this.stop();

        this.events = Array.isArray(events) ? events : [];
        this.index = 0;
        this.running = true;
        this.paused = false;
        this.meta = meta || null;

        this.speedProvider = speedProvider;
        this.onEvent = onEvent;
        this.onComplete = onComplete;

        this.#tick();
    }

    stop() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        this.running = false;
        this.paused = false;
        this.events = [];
        this.index = 0;
        this.meta = null;
    }

    togglePause() {
        if (!this.running) return { running: false, paused: false };

        this.paused = !this.paused;

        if (this.paused) {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }
        } else {
            this.#tick();
        }

        return { running: this.running, paused: this.paused };
    }

    getProgress() {
        return {
            index: this.index,
            total: this.events.length,
            running: this.running,
            paused: this.paused,
            meta: this.meta
        };
    }

    #tick() {
        if (!this.running || this.paused) return;

        if (this.index >= this.events.length) {
            this.running = false;
            this.paused = false;
            this.timerId = null;

            if (typeof this.onComplete === 'function') {
                this.onComplete(this.meta);
            }
            return;
        }

        const event = this.events[this.index++];
        if (typeof this.onEvent === 'function') {
            this.onEvent(event, this.index, this.events.length, this.meta);
        }

        const delayMs = Math.max(1, Number(this.speedProvider?.()) || 8);
        this.timerId = setTimeout(() => this.#tick(), delayMs);
    }
}