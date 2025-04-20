import { eventBus } from "./event_bus.js";
import zlib from 'zlib';

export class WorldManager {
    constructor(web_viewer_io) {
        this.io = web_viewer_io;
        this.chunks = new Map(); // Stores chunks as "x,z" keys

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        eventBus.on('chunk-data', (update) => this.handleWorldUpdate(update));
    }

    handleConnection(socket) {
        socket.on('request-chunks', (data) => {
            const responseChunks = data.chunks.map(requested => {
                const chunkKey = `${requested.x},${requested.z}`;
                const storedChunk = this.chunks.get(chunkKey);
                if (!storedChunk) return null;

                // Handle Y-range requests
                if (data.yRange) {
                    const [yStart, yEnd] = data.yRange;
                    return this.processChunkSlice(storedChunk, yStart, yEnd);
                }

                // Default to surface view
                return this.processChunkSlice(storedChunk, 0, 255);
            }).filter(Boolean);

            socket.emit('chunk-data', responseChunks);
        });

        socket.on('get-cached-chunks', (callback) => {
            callback(Array.from(this.chunks.values()));
        });
    }

    processChunkSlice(fullChunk, yStart, yEnd) {
        const palette = new Map();
        let paletteIndex = 0;
        const blocks = [];

        // 1. Extract Y-range blocks and build optimized palette
        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                const column = [];
                for (let y = yStart; y <= yEnd; y++) {
                    const blockName = fullChunk.blocks[x][z][y] || 'air';

                    if (!palette.has(blockName)) {
                        palette.set(blockName, paletteIndex++);
                    }
                    column.push(palette.get(blockName));
                }
                blocks.push(column); // [x*16 + z] index
            }
        }

        // 2. Convert palette to array format
        const paletteArray = Array.from(palette.entries());

        return {
            x: fullChunk.x,
            z: fullChunk.z,
            blocks,
            palette: paletteArray,
            yStart,
            yEnd
        };
    }

    async decompressChunkData(compressedData) {
        return new Promise((resolve, reject) => {
            if (!compressedData.compressed) {
                resolve(compressedData);
                return;
            }

            const buffer = Buffer.from(compressedData.data, 'base64');

            zlib.gunzip(buffer, (err, decompressed) => {
                if (err) return reject(err);
                try {
                    resolve(JSON.parse(decompressed.toString()));
                } catch (parseErr) {
                    reject(parseErr);
                }
            });
        });
    }

    async handleWorldUpdate(compressedUpdate) {
        try {
            const update = await this.decompressChunkData(compressedUpdate);

            for (const chunkData of update.chunks) {
                const chunkKey = `${chunkData.x},${chunkData.z}`;
                const existing = this.chunks.get(chunkKey) || this.createEmptyChunk(chunkData.x, chunkData.z);

                // Merge partial Y-range updates
                this.mergeChunkData(existing, chunkData);
                this.chunks.set(chunkKey, existing);
            }
        } catch (err) {
            console.error('World update error:', err);
        }
    }

    createEmptyChunk(x, z) {
        return {
            x,
            z,
            blocks: Array.from({ length: 16 }, () =>
                Array.from({ length: 16 }, () =>
                    Array(256).fill('air')
                )
            ),
            biome: Array.from({ length: 16 }, () => Array(16).fill(0)),
            palette: new Map(),
            timestamps: Array.from({ length: 16 }, () =>
                Array.from({ length: 16 }, () =>
                    Array(256).fill(0)
                )
            )
        };
    }

    mergeChunkData(existing, update) {
        const paletteMap = new Map(update.palette);
        const now = Date.now();

        update.blocks.forEach((column, columnIndex) => {
            const x = Math.floor(columnIndex / 16);
            const z = columnIndex % 16;

            column.forEach((paletteIndex, yOffset) => {
                const y = update.yStart + yOffset;
                let blockName = 'air';

                for (let [key, value] of paletteMap.entries()) {
                    if (value === paletteIndex) {
                        blockName = key.split('|')[0];
                        break;
                    }
                }

                if (y >= 0 && y < 256) {
                    existing.blocks[x][z][y] = blockName;
                    existing.timestamps[x][z][y] = now;
                }
            });
        });

        // Merge biome data if present
        if (update.biome) {
            update.biome.forEach((row, x) => {
                row.forEach((biomeId, z) => {
                    existing.biome[x][z] = biomeId;
                });
            });
        }
    }

    blockToColor(blockName) {
        // Simple color mapping - expand as needed
        const colors = {
            'air': '#87CEEB',     // Sky blue
            'grass_block': '#4CAF50', // Green
            'stone': '#808080',    // Gray
            'water': '#2196F3',    // Blue
            'sand': '#FFD700',     // Gold
            'dirt': '#8B4513'      // Brown
        };
        return colors[blockName] || '#000000';
    }
}