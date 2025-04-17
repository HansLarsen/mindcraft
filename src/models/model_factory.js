import { Gemini } from './gemini.js';
import { GPT } from './gpt.js';
import { Claude } from './claude.js';
import { Mistral } from './mistral.js';
import { ReplicateAPI } from './replicate.js';
import { Local } from './local.js';
import { Novita } from './novita.js';
import { GroqCloudAPI } from './groq.js';
import { HuggingFace } from './huggingface.js';
import { Qwen } from "./qwen.js";
import { Grok } from "./grok.js";
import { DeepSeek } from './deepseek.js';
import { Hyperbolic } from './hyperbolic.js';
import { GLHF } from './glhf.js';
import { OpenRouter } from './openrouter.js';

export default class ModelFactory {
    static cache = new Map(); // Key: `${api}:${model}:${url}`, Value: Model Instance

    static createEmbeddingModel(embedding_config, model_config) {
        let api = model_config.api
        if (model_config.api == null) {
            api = ModelFactory.selectAPI(model_config.model).toLowerCase();
        }

        let embedding = embedding_config;
        if (embedding === undefined) {
            if (api !== 'ollama')
                embedding = {api: api};
            else
                embedding = {api: 'none'};
        }
        else if (typeof embedding === 'string' || embedding instanceof String)
            embedding = {api: embedding};

        console.log('Using embedding settings:', embedding);

        try {
            return ModelFactory.createModel(embedding, embedding.url)
        }
        catch (err) {
            console.warn('Warning: Failed to initialize embedding model:', err.message);
            console.log('Continuing anyway, using word-overlap instead.');
            return null;
        }
    }

    static createModels(model_config, code_model_config, vision_model_config) {
        let chat_model = ModelFactory.createModel(model_config);
        let code_model = chat_model
        let vision_model = chat_model

        if (code_model_config) {
            code_model = ModelFactory.createModel(code_model_config);
        }

        if (vision_model_config) {
            vision_model = ModelFactory.createModel(vision_model_config);
        }

        return [chat_model, code_model, vision_model]
    }

    static createModel(profile) {
        let api = profile.api
        if (profile.api == null) {
            api = ModelFactory.selectAPI(profile.model).toLowerCase();
        }

        const modelName = profile.model.replace(/^(?:[^/]+\/)/, ''); // Remove prefixes like 'ollama/'
        const cacheKey = `${api}:${modelName}:${profile.url}`;

        if (ModelFactory.cache.has(cacheKey)) {
            console.log("Getting: ", cacheKey)
            return ModelFactory.cache.get(cacheKey);
        }

        console.log("Creating: ", cacheKey)

        let model = null;
        switch (api) {
            case 'google':
                model = new Gemini(modelName, profile.url, profile.params);
                break;
            case 'openai':
                model = new GPT(modelName, profile.url, profile.params);
                break;
            case 'anthropic':
                model = new Claude(modelName, profile.url, profile.params);
                break;
            case 'replicate':
                model = new ReplicateAPI(modelName, profile.url, profile.params);
                break;
            case 'ollama':
                model = new Local(modelName, profile.url, profile.params);
                break;
            case 'mistral':
                model = new Mistral(modelName, profile.url, profile.params);
                break;
            case 'groq':
                model = new GroqCloudAPI(modelName, profile.url, profile.params);
                break;
            case 'huggingface':
                model = new HuggingFace(modelName, profile.url, profile.params);
                break;
            case 'glhf':
                model = new GLHF(modelName, profile.url, profile.params);
                break;
            case 'hyperbolic':
                model = new Hyperbolic(modelName, profile.url, profile.params);
                break;
            case 'novita':
                model = new Novita(modelName, profile.url, profile.params);
                break;
            case 'qwen':
                model = new Qwen(modelName, profile.url, profile.params);
                break;
            case 'xai':
                model = new Grok(modelName, profile.url, profile.params);
                break;
            case 'deepseek':
                model = new DeepSeek(modelName, profile.url, profile.params);
                break;
            case 'openrouter':
                model = new OpenRouter(modelName, profile.url, profile.params);
                break;
            default:
                throw new Error('Unknown API:', profile.api);
        }

        ModelFactory.cache.set(cacheKey, model);
        return model;
    }

    static selectAPI(profile) {
        if (typeof profile === 'string' || profile instanceof String) {
            profile = {model: profile};
        }

        if (profile.model.includes('openrouter/'))
            return 'openrouter'; // must do first because shares names with other models
        else if (profile.model.includes('ollama/'))
            return 'ollama'; // also must do early because shares names with other models
        else if (profile.model.includes('gemini'))
            return 'google';
        else if (profile.model.includes('gpt') || profile.model.includes('o1')|| profile.model.includes('o3'))
            return 'openai';
        else if (profile.model.includes('claude'))
            return 'anthropic';
        else if (profile.model.includes('huggingface/'))
            return "huggingface";
        else if (profile.model.includes('replicate/'))
            return 'replicate';
        else if (profile.model.includes('mistralai/') || profile.model.includes("mistral/"))
            return 'mistral';
        else if (profile.model.includes("groq/") || profile.model.includes("groqcloud/"))
            return 'groq';
        else if (profile.model.includes("glhf/"))
            return 'glhf';
        else if (profile.model.includes("hyperbolic/"))
            return 'hyperbolic';
        else if (profile.model.includes('novita/'))
            return 'novita';
        else if (profile.model.includes('qwen'))
            return 'qwen';
        else if (profile.model.includes('grok'))
            return 'xai';
        else if (profile.model.includes('deepseek'))
            return 'deepseek';
        else if (profile.model.includes('mistral'))
            return 'mistral';
        else 
            throw new Error('Unknown api for model:', profile.model);
        
    }
}