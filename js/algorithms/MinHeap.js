export class MinHeap {
    constructor() {
        this.items = [];
    }

    size() {
        return this.items.length;
    }

    push(item) {
        this.items.push(item);
        this.#bubbleUp(this.items.length - 1);
    }

    pop() {
        if (this.items.length === 0) return null;

        const top = this.items[0];
        const last = this.items.pop();

        if (this.items.length > 0) {
            this.items[0] = last;
            this.#bubbleDown(0);
        }

        return top;
    }

    peek() {
        if (this.items.length === 0) return null;
        return this.items[0];
    }

    #bubbleUp(index) {
        while (index > 0) {
            const parentIndex = (index - 1) >> 1;
            if (this.#compare(this.items[index], this.items[parentIndex]) >= 0) break;

            [this.items[index], this.items[parentIndex]] = [this.items[parentIndex], this.items[index]];
            index = parentIndex;
        }
    }

    #bubbleDown(index) {
        const size = this.items.length;

        while (true) {
            let smallest = index;
            const left = index * 2 + 1;
            const right = index * 2 + 2;

            if (left < size && this.#compare(this.items[left], this.items[smallest]) < 0) {
                smallest = left;
            }
            if (right < size && this.#compare(this.items[right], this.items[smallest]) < 0) {
                smallest = right;
            }

            if (smallest === index) break;

            [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
            index = smallest;
        }
    }

    #compare(a, b) {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.serial - b.serial;
    }
}