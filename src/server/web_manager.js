import { eventBus } from "./event_bus.js";

export class WebManager {
    constructor(io) {
        this.registeredAgents = new Set();
        this.registeredAgentsPort = {};
        this.agentManagers = {};
        this.io = io;
        this.sockets = []

        this.io.on('connection', (socket) => {
            this.handleConnection(socket)
        })

        eventBus.on("agents-update", (agents) => {
            this.agentsUpdate(agents);
        });

        eventBus.on('log-update', (logs) => {
            this.logsUpdate(logs);
        })

        eventBus.on('log-update-partial', (update) => {
            this.logsUpdatePartial(update);
        })
    }

    handleConnection(socket) {
        socket.on('restart-agent', (agentName) => {
            eventBus.emit('restart-agent', agentName);
        });

        socket.on('start-agent', (agentName) => {
            eventBus.emit('start-agent', agentName);
        });

        socket.on('stop-agent', (agentName) => {
            eventBus.emit('stop-agent', agentName);
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            eventBus.emit('stop-all-agents');
        });

        socket.on('shutdown', () => {
            eventBus.emit('shutdown');
        });

        socket.on('send-message', (agentName, message) => {
            console.log(`Web sending message to agent ${agentName}: ${message}`);
            eventBus.emit('send-message', agentName, message)
        });

        socket.on('update-agents', (callback) => {
            eventBus.emit('webclient-connected')
            callback()
        });

        socket.on('update-log', () => {
            eventBus.emit('update-log')
        })

        eventBus.emit('webclient-connected')
        this.sockets.push(socket)
    }

    agentsUpdate(agents) {
        this.sockets.forEach((socket) => {
            if (socket) {
                if (socket.connected) {
                    socket.emit('agents-update', agents);
                }
            } else {
                let index = this.sockets.find(socket);
                this.sockets.pop(index);
            }
        })
    }

    logsUpdate(logs) {
        this.sockets.forEach((socket) => {
            if (socket) {
                if (socket.connected) {
                    socket.emit('log-update', logs);
                }
            } else {
                let index = this.sockets.find(socket);
                this.sockets.pop(index);
            }
        })
    }

    logsUpdatePartial(logs) {
        this.sockets.forEach((socket) => {
            if (socket) {
                if (socket.connected) {
                    socket.emit('update-log-partial', logs);
                }
            } else {
                let index = this.sockets.find(socket);
                this.sockets.pop(index);
            }
        })
    }
}