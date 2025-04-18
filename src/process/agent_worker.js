import { workerData, parentPort } from 'worker_threads';
import { Agent } from '../agent/agent.js';
import inspector from "node:inspector";

class AgentWorker {
    constructor(data) {
        this.agent = new Agent({
            name: data.profile.name,
            profile: data.profile,
            loadMemory: data.loadMemory,
            initialMessage: data.initMessage
        });

        if (process.execArgv.includes("--inspect-brk")) {
            inspector.open();
            inspector.waitForDebugger();
        }

        this.setupHandlers();
    }

    setupHandlers() {
        parentPort.on('message', (msg) => {
            switch (msg.type) {
                case 'command':
                    this.agent.handleCommand(msg.command);
                    break;
                case 'shutdown':
                    this.agent.cleanup();
                    process.exit(0);
                    break;
            }
        });
    }

    start(...args) {
        this.agent.start(...args);
    }
}

const worker = new AgentWorker(workerData);
worker.start(workerData.profile,
    workerData.loadMemory,
    workerData.initMessage,
    workerData.countId,
    workerData.taskPath,
    workerData.taskId);