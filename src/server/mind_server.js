import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import { AgentManager } from './agent_manager.js';
import { WorldManager } from './world_manager.js';

// Module-level variables
let io;
let server;

// Initialize the server
export function createMindServer(port = 8080) {
    const app = express();
    server = http.createServer(app);
    io = new Server(server);

    const agentManager = new AgentManager(io);
    const worldManager = new WorldManager(io);

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
            title: 'Mindcraft Agents',
            currentPage: 'agents'
        });
    });
    
    app.get('/logs', (req, res) => {
        res.render('logs', {
            title: 'Mindcraft Logs',
            currentPage: 'logs'
        });
    });
    
    app.get('/settings', (req, res) => {
        res.render('settings', {
            title: 'Mindcraft Settings',
            currentPage: 'settings'
        });
    });

    app.get('/world', (req, res) => {
        res.render('world', {
            title: 'Mindcraft world',
            currentPage: 'world'
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
        agentManager.handleConnection(socket);
        worldManager.handleConnection(socket);
    });

    server.listen(port, 'localhost', () => {
        console.log(`MindServer running on port ${port}`);
    });

    return server;
}



// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const getConnectedAgents = () => connectedAgents; 
