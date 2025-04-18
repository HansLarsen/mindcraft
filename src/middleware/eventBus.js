// Shared singleton event bus
let instance = null;

class EventBus {
    constructor() {
        if (instance) {
            return instance;
        }

        this.listeners = {};
        instance = this;
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event, ...args) {
        if (!this.listeners[event]) return;
        const callbacks = this.listeners[event];
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
}

export const eventBus = new EventBus();