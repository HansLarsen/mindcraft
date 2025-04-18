import { AgentThread } from "./agent_thread.js";
import { readFileSync } from 'fs';
import { mainProxy } from './main_proxy.js';

export class AgentManager {
    constructor() {
        this.agents = new Map();
    }

    async initializeAgents(profiles, options = {}) {
        const { load_memory = false, init_message = null, task_path = null, task_id = null } = options;

        for (const [index, profilePath] of profiles.entries()) {
            try {
                const profile = this.loadProfile(profilePath);
                const agent = new AgentThread(profile.name, profile);

                await agent.start(
                    load_memory,
                    init_message,
                    index,
                    task_path,
                    task_id
                );

                this.agents.set(profile.name, agent);
                mainProxy.registerAgent(profile.name, index);

                // Stagger agent startup
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Failed to initialize agent from ${profilePath}:`, error);
            }
        }
    }

    loadProfile(profilePath) {
        try {
            const rawData = readFileSync(profilePath, 'utf8');
            return JSON.parse(rawData);
        } catch (error) {
            throw new Error(`Failed to load profile ${profilePath}: ${error.message}`);
        }
    }

    shutdown() {
        for (const [name, agent] of this.agents) {
            try {
                agent.stop();
                mainProxy.logoutAgent(name);
            } catch (error) {
                console.error(`Error stopping agent ${name}:`, error);
            }
        }
    }
}