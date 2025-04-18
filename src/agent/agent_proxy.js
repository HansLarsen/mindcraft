import { io } from 'socket.io-client';
import convoManager from './conversation.js';
import settings from '../../settings.js';
import { getTimestamp } from '../utils/time.js';

class AgentServerProxy {
    constructor() {
        if (AgentServerProxy.instance) {
            return AgentServerProxy.instance;
        }

        this.socket = null;
        this.connected = false;
        AgentServerProxy.instance = this;
    }

    connect(agent) {
        if (this.connected) return;

        this.agent = agent;

        this.socket = io(`http://${settings.mindserver_host}:${settings.mindserver_port}/agentsocket`);
        this.connected = true;

        this.socket.on('connect', () => {
            console.log(this.agent.name + ' Connected to MindServer');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from MindServer');
            this.connected = false;
        });

        this.socket.on('chat-message', (agentName, json) => {
            convoManager.receiveFromBot(agentName, json);
        });

        this.socket.on('agents-update', (agents) => {
            convoManager.updateAgents(agents);
        });

        this.socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            this.agent.cleanKill();
        });

        this.socket.on('send-message', (agentName, message) => {
            try {
                this.agent.respondFunc("NO USERNAME", message);
            } catch (error) {
                console.error('Error: ', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        });
    }

    login() {
        this.socket.emit('login-agent', this.agent.name);
    }

    shutdown() {
        this.socket.emit('shutdown');
    }

    getSocket() {
        return this.socket;
    }

    sendBotChatToServer(agentName, json) {
        this.socket.emit('chat-message', agentName, json);
    }

    sendChunkData(chunkData) {
        this.socket.emit('chunk-data', chunkData)
    }

    sendLog(message) {
        if (this.socket) {
            let message_str = String(message);
            if (message_str.length > 150) {
                message_str = message_str.substring(0, 150);
            }
            this.socket.emit('log', { name: this.agent.name, timestamp: getTimestamp(), message: message_str })
        }
    }
}

// Create and export a singleton instance
export const serverProxy = new AgentServerProxy();

(function () {
    const originalLog = console.log;

    console.log = function (message) {
        try {
            serverProxy.sendLog(message);
        } catch (err) {
            if (err.code === 'EPIPE') {
                console.error('Pipe broken, stopping log writes');
            } else {
                throw err; // Propagate other errors
            }
        }
        originalLog.apply(console, arguments);
    };
})();