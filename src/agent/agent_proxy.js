import { eventBus } from '../middleware/eventBus.js'

export class AgentServerProxy {
    constructor() {
        this.connected = false;
    }

    connect(agent) {
        this.agent = agent;
        this.connected = true;

        eventBus.on('agents-update', (agents) => {
            this.convoManager.updateAgents(agents);
        });

        eventBus.on(this.agent.name + ':chat-message', (agentName, json) => {
            this.convoManager.receiveFromBot(agentName, json);
        });

        eventBus.on(this.agent.name + ':restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            this.agent.cleanKill();
        });

        eventBus.on(this.agent.name + ':send-message', (agentName, message) => {
            try {
                this.agent.respondFunc("NO USERNAME", message);
            } catch (error) {
                console.error('Error: ', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        });

        console.log(`${this.agent.name}: Connected to MindServer`);
    }

    login() {
        eventBus.emit('login-agent', this.agent.name);
    }

    shutdown() {
        eventBus.emit('shutdown');
    }

    sendBotChatToServer(agentName, json) {
        eventBus.emit(agentName + ':chat-message', agentName, json);
    }
}
