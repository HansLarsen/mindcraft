const socket = io();
let allLogs = {}; // Structure: { agentName: [{ timestamp, log }, ...] }
let activeFilters = new Set();

// Initialize connection
socket.on('connect', () => {
    socket.emit('update-log');
    document.getElementById('searchBox').addEventListener('input', updateLogView);
});

// Handle log updates
socket.on('log-update', (logs) => {
    allLogs = logs;
    updateLogView();
});

socket.on('update-log-partial', (update) => {
    try {
        allLogs[update.name].push({ timestamp: update.timestamp, message: update.message });
        updateLogView();
    } catch (error) {
        console.log(error);
    }
})

// Update visible logs
function updateLogView() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const container = document.getElementById('logContainer');

    container.innerHTML = Object.entries(allLogs)
        .filter(([agentName]) => activeFilters.size === 0 || activeFilters.has(agentName))
        .map(([agentName, logs]) => {
            // Filter logs for this agent
            const filteredLogs = logs.filter(logEntry =>
                agentName.toLowerCase().includes(searchTerm) ||
                logEntry.message.toLowerCase().includes(searchTerm) ||
                logEntry.timestamp.toLowerCase().includes(searchTerm)
            );

            if (filteredLogs.length === 0) return '';

            return `
                <div class="agent-log">
                    <div class="agent-header">
                        <h3>${agentName} (${filteredLogs.length} entries)</h3>
                        <div class="log-meta">
                            <button class="toggle">▼</button>
                        </div>
                    </div>
                    <div class="log-entries">
                        ${filteredLogs.map(log => `
                            <div class="log-entry">
                                <span class="timestamp">[${log.timestamp}]</span>
                                <span class="message">${log.message}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
}

// Basic styles
const style = document.createElement('style');
style.textContent = `
    .agent-log {
        background: #2d2d2d;
        border-radius: 3px;
        margin: 6px 0;
    }
    
    .agent-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        padding: 6px 10px;
        background: #363636;
    }
    
    .agent-header h3 {
        margin: 0;
        font-size: 0.95em;
        font-weight: 500;
        color: #e0e0e0;
    }
    
    .log-entries {
        padding: 2px 3px;
        background: #252525;
        display: block;
    }
    
    .log-entry {
        padding: 1px 0;
        border-bottom: 1px solid #333;
        font-size: 0.9em;
        line-height: 1.4;
    }
    
    .timestamp {
        color: #4CAF50;
        margin-right: 8px;
        font-size: 0.85em;
    }
    
    .message {
        color: #d0d0d0;
    }
    
    .toggle {
        background: none;
        border: none;
        color: #888;
        padding: 2px 6px;
        font-size: 0.9em;
        margin-left: 8px;
    }
    
    .toggle:hover {
        background: rgba(255,255,255,0.05);
    }
    
    #searchBox {
        padding: 6px 8px;
        font-size: 0.9em;
        margin-bottom: 8px;
    }
`;
document.head.appendChild(style);

// Toggle visibility
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle')) {
        const entries = e.target.closest('.agent-log').querySelector('.log-entries');
        entries.style.display = entries.style.display === 'none' ? 'block' : 'none';
        e.target.textContent = entries.style.display === 'none' ? '▶' : '▼';
    }
});