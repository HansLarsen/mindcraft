import { Worker, isMainThread, parentPort } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import { mainProxy } from './main_proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentThread {
    constructor(name, profile) {
        this.name = name;
        this.profile = profile;
        this.running = false;
        this.worker = null;
        this.lastRestart = 0;
    }

    async start(loadMemory = false, initMessage = null, countId = 0, taskPath = null, taskId = null) {
        if (this.running) return;

        const workerArgs = {
            profile: this.profile,
            loadMemory,
            initMessage,
            countId,
            taskPath,
            taskId
        };

        this.worker = new Worker(path.join(__dirname, 'agent_worker.js'), {
            workerData: workerArgs,
            stdout: true,
            stderr: true,
            execArgv: ['--inspect=' + (9229 + Math.floor(Math.random() * 100))],
        });

        this.running = true;

        this.worker.on('message', (msg) => {
            switch (msg.type) {
                case 'status':
                    mainProxy.updateAgentStatus(this.name, msg.status);
                    break;
                case 'event':
                    this.handleEvent(msg.event, msg.data);
                    break;
            }
        });

        this.worker.on('error', (err) => {
            console.error(`Agent ${this.name} thread error:`, err);
        });

        this.worker.on('exit', (code) => {
            this.running = false;
            mainProxy.logoutAgent(this.name);
            this.handleExit(code);
        });

        // Pipe stdout/stderr to main process
        this.worker.stdout?.pipe(process.stdout);
        this.worker.stderr?.pipe(process.stderr);
    }

    handleEvent(event, data) {
        // Handle custom events from worker
        console.log(`Event from ${this.name}:`, event, data);
    }

    handleExit(code) {
        if (code > 1) {
            console.error(`Critical error in agent ${this.name}, shutting down`);
            process.exit(code);
        }

        if (code !== 0) {
            const now = Date.now();
            if (now - this.lastRestart < 10000) {
                console.error(`Agent ${this.name} crashed too frequently`);
                return;
            }
            this.lastRestart = now;
            console.log(`Restarting agent ${this.name}...`);
            this.start(true, 'Agent restarted');
        }
    }

    stop() {
        if (!this.running) return;
        this.worker.postMessage({ type: 'shutdown' });
        setTimeout(() => {
            if (this.running) {
                this.worker.terminate();
                this.running = false;
            }
        }, 5000); // Graceful shutdown timeout
    }

    sendCommand(command) {
        if (this.running) {
            this.worker.postMessage({ type: 'command', command });
        }
    }
}