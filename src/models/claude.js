import Anthropic from '@anthropic-ai/sdk';
import { strictFormat } from '../utils/text.js';
import { getKey } from '../utils/keys.js';

export class Claude {
    constructor(model_name, url) {
        this.model_name = model_name;

        let config = {};
        if (url)
            config.baseURL = url;
        
        config.apiKey = getKey('ANTHROPIC_API_KEY');

        this.anthropic = new Anthropic(config);
    }

    async sendRequest(turns, systemMessage) {
        const messages = strictFormat(turns);
        let res = null;
        try {
            console.log('Awaiting anthropic api response...')
            // console.log('Messages:', messages);
            const resp = await this.anthropic.messages.create({
                model: this.model_name || "claude-3-sonnet-20240229",
                system: systemMessage,
                max_tokens: 2048,
                messages: messages,
            });
            console.log('Received.')
            res = resp.content[0].text;
        }
        catch (err) {
            console.log(err);
            res = 'My brain disconnected, try again.';
        }
        return res;
    }

    async sendVisionRequest(turns, systemMessage, imageBuffer) {
        const imageMessages = [...turns];
        imageMessages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: systemMessage
                },
                {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: "image/jpeg",
                        data: imageBuffer.toString('base64')
                    }
                }
            ]
        });

        return this.sendRequest(imageMessages, systemMessage);
    }

    async embed(text) {
        throw new Error('Embeddings are not supported by Claude.');
    }
}
