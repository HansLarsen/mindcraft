import { eventBus } from "./event_bus.js";

export class AgentManager {
    constructor(io) {
        this.registeredAgents = new Set();
        this.registeredAgentsPort = {};
        this.inGameAgents = {};
        this.agentManagers = {};
        this.io = io;

        this.io.on('connection', (socket) => {
            this.handleConnection(socket)
        })

        eventBus.on('register-agents', (agentNames) => {
            console.log(`Registering agents: ${agentNames.name}`);
            agentNames.forEach(agent => this.registeredAgents.add(agent.name));
            agentNames.forEach(agent => this.registeredAgentsPort[agent.name] = agent.index);
            eventBus.emit('register-agents-success');
            this.agentsUpdate();
        });

        eventBus.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            this.inGameAgents[agentName].emit('restart-agent');
        });

        eventBus.on('stop-agent', (agentName) => {
            let manager = this.agentManagers[agentName];
            if (manager) {
                manager.emit('stop-agent', agentName);
            }
            else {
                console.warn(`Stopping unregisterd agent ${agentName}`);
            }
        });

        eventBus.on('start-agent', (agentName) => {
            let manager = this.agentManagers[agentName];
            if (manager) {
                manager.emit('start-agent', agentName);
            }
            else {
                console.warn(`Starting unregisterd agent ${agentName}`);
            }
        });

        eventBus.on('stop-all-agents', () => {
            console.log('Killing all agents');
            this.stopAllAgents();
        });

        eventBus.on('shutdown', () => {
            console.log('Shutting down');
            for (let manager of Object.values(this.agentManagers)) {
                manager.emit('shutdown');
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });

        eventBus.on('send-message', (agentName, message) => {
            if (!this.inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} not logged in, cannot send message via MindServer.`);
                return
            }
            try {
                console.log(`Sending message to socket agent ${agentName}: ${message}`);
                this.inGameAgents[agentName].emit('send-message', agentName, message)
            } catch (error) {
                console.error('Error: ', error);
            }
        });

        eventBus.on('webclient-connected', () => {
            this.agentsUpdate();
        });
    }

    handleConnection(socket) {
        let curAgentName = null;

        socket.on('login-agent', (agentName) => {
            this.agentManagers[agentName] = socket;

            if (curAgentName && curAgentName !== agentName) {
                console.warn(`Agent ${agentName} already logged in as ${curAgentName}`);
                return;
            }
            if (this.registeredAgents.has(agentName)) {
                curAgentName = agentName;
                this.inGameAgents[agentName] = socket;
                this.agentsUpdate();
            } else {
                console.warn(`Agent ${agentName} not registered`);
            }
        });

        socket.on('logout-agent', (agentName) => {
            if (this.inGameAgents[agentName]) {
                delete this.inGameAgents[agentName];
                this.agentsUpdate();
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
            if (this.inGameAgents[curAgentName]) {
                delete this.inGameAgents[curAgentName];
                this.agentsUpdate();
            }
        });

        socket.on('chat-message', (agentName, json) => {
            if (!this.inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} tried to send a message but is not logged in`);
                return;
            }
            console.log(`${curAgentName} sending message to ${agentName}: ${json.message}`);
            this.inGameAgents[agentName].emit('chat-message', curAgentName, json);
        });

        socket.on('send-message', (agentName, message) => {
            if (!this.inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} not logged in, cannot send message via MindServer.`);
                return
            }
            try {
                console.log(`Sending message to agent ${agentName}: ${message}`);
                this.inGameAgents[agentName].emit('send-message', agentName, message)
            } catch (error) {
                console.error('Error: ', error);
            }
        });

        socket.on('log', (message) => {
            eventBus.emit('log', { name: message.name, log: message.message, timestamp: message.timestamp })
        });

        socket.on('chunk-data', (update) => {
            eventBus.emit('chunk-data', update);
        });

        this.agentsUpdate();
    }

    agentsUpdate() {
        let agents = [];
        this.registeredAgents.forEach(name => {
            agents.push({ name, in_game: !!this.inGameAgents[name], port: 3050 + this.registeredAgentsPort[name] });
        });
        eventBus.emit('agents-update', agents);
    }

    stopAllAgents() {
        for (const agentName in this.inGameAgents) {
            let manager = this.agentManagers[agentName];
            if (manager) {
                manager.emit('stop-agent', agentName);
            }
        }
    }
}