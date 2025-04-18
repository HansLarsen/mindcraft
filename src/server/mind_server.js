import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';

// Module-level variables
let io;
let server;
const registeredAgents = new Set();
const registeredAgentsPort = {};
const inGameAgents = {};
const agentManagers = {}; // socket for main process that registers/controls agents

// Initialize the server
export function createMindServer(port = 8080) {
    const app = express();
    server = http.createServer(app);
    io = new Server(server);

    // Get directory name
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    
    app.use(expressLayouts);
    app.set('layout', 'layout'); // Specify your default layout
    // Configure view engine
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');

    // Serve static files
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/', (req, res) => {
        res.render('dashboard', {
            title: 'Mindcraft Control Panel',
            currentPage: 'dashboard'
        });
    });
    
    app.get('/agents', (req, res) => {
        res.render('agents', {
            title: 'Mindcraft Control Panel',
            currentPage: 'agents'
        });
    });
    
    app.get('/logs', (req, res) => {
        res.render('logs', {
            title: 'Mindcraft Control Panel',
            currentPage: 'logs'
        });
    });
    
    app.get('/settings', (req, res) => {
        res.render('settings', {
            title: 'Mindcraft Control Panel',
            currentPage: 'settings'
        });
    });

    app.get('/agents/:name/view', (req, res) => {
        res.render('agent-viewer', {
            title: `${req.params.name} Viewer`,
            currentPage: 'agents',
            agentName: req.params.name,
            agentPort: 3000 // Implement this function
        });
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('Client connected');

        agentsUpdate(socket);

        socket.on('register-agents', (agentNames) => {
            console.log(`Registering agents: ${agentNames.name}`);
            agentNames.forEach(agent => registeredAgents.add(agent.name));
            agentNames.forEach(agent => registeredAgentsPort[agent.name] = agent.index);
            for (let agent of agentNames) {
                agentManagers[agent.name] = socket;
            }
            socket.emit('register-agents-success');
            agentsUpdate();
        });

        socket.on('login-agent', (agentName) => {
            if (curAgentName && curAgentName !== agentName) {
                console.warn(`Agent ${agentName} already logged in as ${curAgentName}`);
                return;
            }
            if (registeredAgents.has(agentName)) {
                curAgentName = agentName;
                inGameAgents[agentName] = socket;
                agentsUpdate();
            } else {
                console.warn(`Agent ${agentName} not registered`);
            }
        });

        socket.on('logout-agent', (agentName) => {
            if (inGameAgents[agentName]) {
                delete inGameAgents[agentName];
                agentsUpdate();
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
            if (inGameAgents[curAgentName]) {
                delete inGameAgents[curAgentName];
                agentsUpdate();
            }
        });

        socket.on('chat-message', (agentName, json) => {
            if (!inGameAgents[agentName]) {
                console.warn(`Agent ${agentName} tried to send a message but is not logged in`);
                return;
            }
            console.log(`${curAgentName} sending message to ${agentName}: ${json.message}`);
            inGameAgents[agentName].emit('chat-message', curAgentName, json);
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            inGameAgents[agentName].emit('restart-agent');
        });

        socket.on('stop-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('stop-agent', agentName);
            }
            else {
                console.warn(`Stopping unregisterd agent ${agentName}`);
            }
        });

        socket.on('start-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('start-agent', agentName);
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
            for (let manager of Object.values(agentManagers)) {
                manager.emit('shutdown');
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });

		socket.on('send-message', (agentName, message) => {
			if (!inGameAgents[agentName]) {
				console.warn(`Agent ${agentName} not logged in, cannot send message via MindServer.`);
				return
			}
			try {
				console.log(`Sending message to agent ${agentName}: ${message}`);
				inGameAgents[agentName].emit('send-message', agentName, message)
			} catch (error) {
				console.error('Error: ', error);
			}
		});
    });

    server.listen(port, 'localhost', () => {
        console.log(`MindServer running on port ${port}`);
    });

    return server;
}

function agentsUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    registeredAgents.forEach(name => {
        agents.push({name, in_game: !!inGameAgents[name], port: 3000 + registeredAgentsPort[name]});
    });
    socket.emit('agents-update', agents);
}

function stopAllAgents() {
    for (const agentName in inGameAgents) {
        let manager = agentManagers[agentName];
        if (manager) {
            manager.emit('stop-agent', agentName);
        }
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const getConnectedAgents = () => connectedAgents; 
