import { eventBus } from '../middleware/eventBus.js';

export class AgentManager {
    constructor(io) {
        this.registeredAgents = new Set();
        this.registeredAgentsPort = {};
        this.inGameAgents = {};
        this.io = io;

        let curAgentName = null;

        eventBus.on('register-agents', (agentNames) => {
            console.log(`Registering agents: ${agentNames.name}`);
            agentNames.forEach(agent => this.registeredAgents.add(agent.name));
            agentNames.forEach(agent => this.registeredAgentsPort[agent.name] = agent.index);
            eventBus.emit('register-agents-success');
            this.agentsUpdate();
        });

        eventBus.on('login-agent', (agentName) => {
            if (curAgentName && curAgentName !== agentName) {
                console.warn(`Agent ${agentName} already logged in as ${curAgentName}`);
                return;
            }
            if (this.registeredAgents.has(agentName)) {
                curAgentName = agentName;
                this.inGameAgents[agentName] = true;
                this.agentsUpdate();
            } else {
                console.warn(`Agent ${agentName} not registered`);
            }
        });

        eventBus.on('logout-agent', (agentName) => {
            if (this.inGameAgents[agentName]) {
                delete this.inGameAgents[agentName];
                this.agentsUpdate();
            }
        });

        eventBus.on('disconnect', () => {
            console.log('Client disconnected');
            if (this.inGameAgents[curAgentName]) {
                delete this.inGameAgents[curAgentName];
                this.agentsUpdate();
            }
        });
    }

    handleConnection(socket) {
        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            eventBus.emit(agentName + ':restart-agent');
        });

        socket.on('stop-agent', (agentName) => {
            if (registeredAgents.has(agentName)) {
                eventBus.emit(agentName + ':stop-agent', agentName);
            }
            else {
                console.warn(`Stopping unregisterd agent ${agentName}`);
            }
        });

        socket.on('start-agent', (agentName) => {
            if (this.registeredAgents.has(agentName)) {
                eventBus.emit('start-agent', agentName);
            }
            else {
                console.warn(`Starting unregisterd agent ${agentName}`);
            }
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            stopAllAgents();
        });

        socket.on('shutdown', () => {
            console.log('Shutting down');
            for (let manager of Object.values(this.agentManagers)) {
                manager.emit('shutdown');
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });

        socket.on('send-message', (agentName, message) => {
            if (!this.inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} not logged in, cannot send message via MindServer.`);
                return
            }
            try {
                console.log(`Sending message to agent ${agentName}: ${message}`);
                eventBus.emit(agentName + ':send-message', agentName, message)
            } catch (error) {
                console.error('Error: ', error);
            }
        });
        this.agentsUpdate(socket);
    }

    agentsUpdate(socket) {
        if (!socket) {
            socket = this.io;
        }
        let agents = [];
        this.registeredAgents.forEach(name => {
            agents.push({ name, in_game: !!this.inGameAgents[name], port: 3000 + this.registeredAgentsPort[name] });
        });
        socket.emit('agents-update', agents);
    }

    stopAllAgents() {
        for (const agentName in this.inGameAgents) {
            if (this.registeredAgents.has(agentName)) {
                manager.emit('stop-agent', agentName);
            }
        }
    }
}