import { Vec3 } from 'vec3';
import zlib from 'zlib';

export class ChunkManager {
    constructor(bot, serverProxy) {
        this.bot = bot;
        this.serverProxy = serverProxy;
        this.queue = new Map();
        this.isSending = false;
        this.config = {
            maxBatchSize: 3,
            sendInterval: 250,
            maxQueueSize: 50,
            viewDistance: 4,
            yRangeSpan: 40  // Number of blocks to send vertically around player
        };

        this.bot.on('chunkColumnLoad', (chunk) => this.handleChunkUpdate(chunk));
        this.bot.on('move', () => this.prioritizeChunks());
    }

    handleChunkUpdate(chunk) {
        if (this.queue.size >= this.config.maxQueueSize) return;

        const key = `${chunk.x},${chunk.z}`;
        const priority = this.calculateChunkPriority(chunk);
        const serialized = this.serializeChunk(chunk);

        if (!serialized) return;

        this.queue.set(key, {
            ...serialized,
            priority,
            timestamp: Date.now()
        });

        if (!this.isSending) this.processQueue();
    }

    calculateChunkPriority(chunk) {
        const dx = chunk.x * 16 - this.bot.entity.position.x;
        const dz = chunk.z * 16 - this.bot.entity.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    serializeChunk(chunk) {
        try {
            const column = this.bot.world.getColumn(chunk.x, chunk.z);
            if (!column) return null;

            // Calculate vertical range around player
            const centerY = Math.floor(this.bot.entity.position.y);
            const yStart = Math.max(0, centerY - this.config.yRangeSpan);
            const yEnd = Math.min(255, centerY + this.config.yRangeSpan);

            // Block data serialization with palette
            const palette = new Map();
            const blocks = [];
            let paletteIndex = 0;

            // Biome data for ground level
            const biome = [];

            for (let x = 0; x < 16; x++) {
                const biomeRow = [];
                for (let z = 0; z < 16; z++) {
                    // Get biome at surface level
                    biomeRow.push(this.bot.world.getBiome(
                        chunk.x * 16 + x,
                        chunk.z * 16 + z
                    ));

                    // Get block data
                    const columnBlocks = [];
                    for (let y = yStart; y <= yEnd; y++) {
                        const block = column.getBlock(new Vec3(x, y, z));
                        const key = `${block.name}|${block.metadata}`;

                        if (!palette.has(key)) {
                            palette.set(key, paletteIndex++);
                            palette.set(paletteIndex - 1, {  // Reverse mapping
                                type: block.type,
                                metadata: block.metadata,
                                name: block.name
                            });
                        }

                        columnBlocks.push(palette.get(key));
                    }
                    blocks.push(columnBlocks);
                }
                biome.push(biomeRow);
            }

            return {
                x: chunk.x,
                z: chunk.z,
                palette: Array.from(palette.entries()).filter(([k]) => typeof k === 'string'),
                blocks,
                biome,
                yStart,
                yEnd
            };
        } catch (err) {
            console.error('Chunk serialization error:', err);
            return null;
        }
    }

    async processQueue() {
        if (this.queue.size === 0 || !this.serverProxy.connected) {
            this.isSending = false;
            return;
        }

        this.isSending = true;

        try {
            const batch = Array.from(this.queue.values())
                .sort((a, b) => a.priority - b.priority)
                .slice(0, this.config.maxBatchSize);

            const compressed = await this.compressBatch({
                version: this.bot.version,
                position: this.bot.entity.position,
                chunks: batch
            });

            this.serverProxy.sendChunkData(compressed);

            // Clear successfully sent chunks
            batch.forEach(chunk => this.queue.delete(`${chunk.x},${chunk.z}`));

        } catch (err) {
            if (err.code === 'EPIPE') {
                console.log('Connection closed, pausing chunk updates');
                this.queue.clear();
            } else {
                console.error('Chunk processing error:', err);
            }
        }

        setTimeout(() => this.processQueue(), this.config.sendInterval);
    }

    async compressBatch(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(JSON.stringify(data), (err, buffer) => {
                if (err) reject(err);
                else resolve({
                    compressed: true,
                    format: 'gzip',
                    data: buffer.toString('base64')
                });
            });
        });
    }

    prioritizeChunks() {
        this.queue.forEach(chunk => {
            chunk.priority = this.calculateChunkPriority({
                x: chunk.x,
                z: chunk.z
            });
        });
    }
}