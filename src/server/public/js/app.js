const socket = io();
const agentsDiv = document.getElementById('agents');
const registeredAgentsPort = {};

socket.on('agents-update', (agents) => {
    agents.forEach(agent => {
        registeredAgentsPort[agent.name] = agent.port;
    });
    agentsDiv.innerHTML = agents.length ? 
        agents.map(agent => `
            <div class="agent-card">
                <div class="agent-header">
                    <span>
                        <span class="status-icon ${agent.in_game ? 'online' : 'offline'}">●</span>
                        ${agent.name}
                    </span>
                    <div class="agent-controls">
                        ${agent.in_game ? `
                            <button class="stop-btn" onclick="stopAgent('${agent.name}')">Stop</button>
                            <button class="restart-btn" onclick="restartAgent('${agent.name}')">Restart</button>
                            <div class="message-controls">
                                <input type="text" id="messageInput-${agent.name}" placeholder="Enter command...">
                                <button class="send-btn" onclick="sendMessage('${agent.name}', document.getElementById('messageInput-${agent.name}').value)">Send</button>
                            </div>
                        ` : `
                            <button class="start-btn" onclick="startAgent('${agent.name}')">Start</button>
                        `}
                    </div>
                </div>
                
                <!-- Always visible viewer with toolbar -->
                <div class="viewer-container">
                    <div class="viewer-toolbar">
                        <a href="/agents/${agent.name}/view" class="viewer-btn" target="_blank">
                            <i class="fas fa-expand"></i> Fullscreen
                        </a>
                        <button class="viewer-btn" onclick="refreshViewer('${agent.name}')">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                    <iframe src="http://localhost:${getPortForAgent(agent.name)}" 
                            class="agent-viewer-frame"
                            loading="lazy"></iframe>
                </div>
            </div>
        `).join('') + 
        `<div class="global-controls">
            <button class="stop-btn" onclick="killAllAgents()">Stop All</button>
            <button class="stop-btn" onclick="shutdown()">Shutdown</button>
        </div>` :
        '<div class="agent">No agents connected</div>';
});

function restartAgent(agentName) {
    socket.emit('restart-agent', agentName);
}

function startAgent(agentName) {
    socket.emit('start-agent', agentName);
}

function stopAgent(agentName) {
    socket.emit('stop-agent', agentName);
}

function killAllAgents() {
    socket.emit('stop-all-agents');
}

function shutdown() {
    socket.emit('shutdown');
}

function sendMessage(agentName, message) {
    socket.emit('send-message', agentName, message)
}

function refreshViewer(agentName) {
    const iframe = document.querySelector(`#viewer-${agentName} iframe`);
    if (iframe) {
        iframe.src = iframe.src; // Triggers refresh
    }
}

function getAgentPort(name) {
    return registeredAgentsPort[name]
}

// Helper function - you'll need to implement based on your port mapping
function getPortForAgent(agentName) {
    const agentport = parseInt(getAgentPort(agentName.replace('agent-', '')));
    return agentport;
}