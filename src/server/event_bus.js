class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(...args); // Spread all arguments
                } catch (err) {
                    console.error(`Error in ${event} handler:`, err);
                }
            });
        }
    }

    // Optional: Type-safe variant
    typedEmit(event, ...args) {
        if (typeof event !== 'string') {
            throw new Error('Event must be a string');
        }
        this.emit(event, ...args);
    }
}

export const eventBus = new EventBus();