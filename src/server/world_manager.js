export class WorldManager {
    constructor(io) {
        this.io = io;
        this.worldState = {};
    }

    handleConnection(socket) {
        socket.on('world-update', (update) => this.handleWorldUpdate(update));
    }

    handleWorldUpdate(update) {
        // Process world updates
        this.worldState = { ...this.worldState, ...update };
        this.io.emit('world-state-update', this.worldState);
    }
}