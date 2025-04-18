const socket = io();
const agentsDiv = document.getElementById('agents');

socket.on('agents-update', (agents) => {
    agentsDiv.innerHTML = agents.length ? 
        agents.map(agent => `
            <div class="agent">
                <span>
                    <span class="status-icon ${agent.in_game ? 'online' : 'offline'}">●</span>
                    ${agent.name}
                </span>
                <div>
                    ${agent.in_game ? `
                        <button class="stop-btn" onclick="stopAgent('${agent.name}')">Stop</button>
                        <button class="restart-btn" onclick="restartAgent('${agent.name}')">Restart</button>
                        <input type="text" id="messageInput" placeholder="Enter a message or command..."></input><button class="start-btn" onclick="sendMessage('${agent.name}', document.getElementById('messageInput').value)">Send</button>
                    ` : `
                        <button class="start-btn" onclick="startAgent('${agent.name}')">Start</button>
                    `}
                </div>
            </div>
        `).join('') + 
        `<button class="stop-btn" onclick="killAllAgents()">Stop All</button>
        <button class="stop-btn" onclick="shutdown()">Shutdown</button>` :
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