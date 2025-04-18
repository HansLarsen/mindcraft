import settings from './settings.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createMindServer } from './src/server/mind_server.js';
import { mainProxy } from './src/process/main_proxy.js';
import segfaultHandler from 'segfault-handler';
import { AgentManager } from './src/process/agent_manager.js';

// Initialize crash handler
segfaultHandler.registerHandler('crash.log');


function parseArguments() {
    return yargs(hideBin(process.argv))
        .option('profiles', {
            type: 'array',
            describe: 'List of agent profile paths',
            default: settings.profiles
        })
        .option('task_path', {
            type: 'string',
            describe: 'Path to task file to execute'
        })
        .option('task_id', {
            type: 'string',
            describe: 'Task ID to execute'
        })
        .help()
        .alias('help', 'h')
        .parse();
}

async function run() {
    try {
        const args = parseArguments();
        const mindServer = createMindServer(settings.mindserver_port);
        const agentManager = new AgentManager();

        // Initialize main proxy connection
        await mainProxy.connect();

        // Create and initialize agents
        await agentManager.initializeAgents(args.profiles, {
            load_memory: settings.load_memory,
            init_message: settings.init_message,
            task_path: args.task_path,
            task_id: args.task_id
        });

        // Handle shutdown gracefully
        process.on('SIGINT', () => {
            console.log('\nShutting down agents...');
            agentManager.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            agentManager.shutdown();
            process.exit(0);
        });

    } catch (error) {
        console.error('Application failed:', error);
        process.exit(1);
    }
}

// Start the application
run();