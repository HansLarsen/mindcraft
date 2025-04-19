import { eventBus } from '../server/event_bus.js';

// Singleton mindserver proxy for the main process
class MainProxy {
    constructor() {
        if (MainProxy.instance) {
            return MainProxy.instance;
        }

        this.agent_processes = {};
        MainProxy.instance = this;
    }

    connect() {
        eventBus.on('stop-agent', (agentName) => {
            if (this.agent_processes[agentName]) {
                this.agent_processes[agentName].stop();
            }
        });

        eventBus.on('start-agent', (agentName) => {
            if (this.agent_processes[agentName]) {
                this.agent_processes[agentName].continue();
            }
        });

        eventBus.on('register-agents-success', () => {
            console.log('Agents registered');
        });

        eventBus.on('shutdown', () => {
            console.log('Shutting down');
            for (let agentName in this.agent_processes) {
                this.agent_processes[agentName].stop();
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });
    }

    addAgent(agent) {
        this.agent_processes.push(agent);
    }

    logoutAgent(agentName) {
        eventBus.emit('logout-agent', agentName);
    }

    registerAgent(name, process) {
        eventBus.emit('register-agents', [{ name: name, index: process.count_id }]);
        this.agent_processes[name] = process;
    }
}

export const mainProxy = new MainProxy();