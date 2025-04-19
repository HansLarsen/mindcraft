import { eventBus } from "./event_bus.js";

export class LogManager {
    constructor() {
        this.agents = {}

        eventBus.on('log', (logObject) => {
            if (!this.agents[logObject.name]) {
                this.agents[logObject.name] = []
            }
            this.agents[logObject.name].push({ timestamp: logObject.timestamp, message: logObject.log });
            eventBus.emit('log-update-partial', { name: logObject.name, timestamp: logObject.timestamp, message: logObject.log })
        })

        eventBus.on('update-log', () => {
            eventBus.emit('log-update', this.getLogs());
        })
    }

    getLogs() {
        return this.agents;
    }
}