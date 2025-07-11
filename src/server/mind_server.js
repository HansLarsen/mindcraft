import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import { WebManager } from './web_manager.js';
import { AgentManager } from './agent_manager.js';
import { WorldManager } from './world_manager.js';
import { LogManager } from './logger.js';
import { eventBus } from './event_bus.js';
import { getTimestamp } from '../utils/time.js';

// Module-level variables
let webIO;
let agentIO;
let webServer;
let agentServer;

export function createMindServer(webPort = 8080) {
    const logManager = new LogManager();
    // Create separate HTTP servers
    const webApp = express();
    webServer = http.createServer(webApp);

    // Create separate Socket.IO instances
    webIO = new Server(webServer);
    agentIO = webIO.of('/agentsocket');

    // Initialize managers with appropriate IO instances
    const webmanager = new WebManager(webIO);
    const agentManager = new AgentManager(agentIO);
    const worldManager = new WorldManager(webIO);

    // Configure web server
    configureWebServer(webApp);

    worldManager.setupTileRoutes(webApp);

    // Start servers
    webServer.listen(webPort, 'localhost', () => {
        console.log(`Web server running on port ${webPort}`);
    });

    return { webServer, agentServer };
}

function configureWebServer(app) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Web server configuration
    app.use(expressLayouts);
    app.set('layout', 'layout');
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    app.use(express.static(path.join(__dirname, 'public')));

    // Web routes
    app.get('/', (req, res) => res.render('dashboard', { title: 'Control Panel', currentPage: 'dashboard' }));
    app.get('/agents', (req, res) => res.render('agents', { title: 'Agents', currentPage: 'agents' }));
    app.get('/logs', (req, res) => res.render('logs', { title: 'Logs', currentPage: 'logs' }));
    app.get('/settings', (req, res) => res.render('settings', { title: 'Settings', currentPage: 'settings' }));
    app.get('/world', (req, res) => res.render('world', { title: 'World', currentPage: 'world' }));
    app.get('/map', (req, res) => res.render('map', { title: 'Map', currentPage: 'map' }));
    app.get('/agents/:name/view', handleAgentView);

    // Web socket connections
    webIO.on('connection', (socket) => {
        console.log('Web client connected');
        // Add web-specific socket handlers here
    });
}

function handleAgentView(req, res) {
    res.render('agent-viewer', {
        title: `${req.params.name} Viewer`,
        agentName: req.params.name,
        agentPort: 3050
    });
}

// Export getters for specific servers
export const getWebIO = () => webIO;
export const getAgentIO = () => agentIO;
export const getWebServer = () => webServer;
export const getAgentServer = () => agentServer;

(function () {
    const originalLog = console.log;

    console.log = function (message) {
        try {
            eventBus.emit('log', { name: "server", timestamp: getTimestamp(), log: JSON.stringify(arguments) })
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