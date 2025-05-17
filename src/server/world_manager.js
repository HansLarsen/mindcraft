import { eventBus } from "./event_bus.js";
import zlib from 'zlib';
import { createCanvas } from 'canvas'; // Requires node-canvas
import sharp from 'sharp';

export class WorldManager {
    constructor(web_viewer_io) {
        this.io = web_viewer_io;
        this.chunks = new Map(); // Stores chunks as "x,z" keys
        this.sockets = []
        this.tileCache = new Map(); // Stores rendered PNG buffers

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        eventBus.on('chunk-data', (update) => this.handleWorldUpdate(update));
    }

    handleConnection(socket) {
        socket.on('request-chunks', (data) => {
            const responseChunks = data.chunks.map(requested => {
                const chunkKey = `${requested.x},${requested.z}`;
                return this.createChunkMessage(chunkKey, data.yRange);
            }).filter(Boolean);

            socket.emit('chunk-data', responseChunks);
        });

        socket.on('get-cached-chunks', (callback) => {
            let keys = [];
            this.chunks.keys().forEach((index) => {
                keys.push({ x: parseInt(index.split(',')[0]), z: parseInt(index.split(',')[1]) });
            })
            callback(JSON.stringify(keys));
        });

        this.sendInitialState(socket);

        this.sockets.push(socket)
    }

    createChunkMessage(chunkKey, yRange = null) {
        const storedChunk = this.chunks.get(chunkKey);
        if (!storedChunk) return null;

        // Handle Y-range requests
        if (yRange) {
            const [yStart, yEnd] = yRange;
            return this.processChunkSlice(storedChunk, yStart, yEnd);
        }

        // Default to surface view
        return this.processChunkSlice(storedChunk, 0, 255);
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

                const tile_chunkKey = `${chunkData.z / 16},${chunkData.x / 16}`;
                // Render and cache tile
                const tileBuffer = await this.renderChunkToTile(existing);
                this.tileCache.set(tile_chunkKey, tileBuffer);

                // Notify clients
                this.updateChunk({
                    x: chunkData.z / 16,
                    z: chunkData.x / 16,
                    tileUrl: `/tiles/${chunkData.x}/${chunkData.z}.png`
                });
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
            'short_grass': '#4CAF50',
            'stone': '#808080',    // Gray
            'water': '#2196F3',    // Blue
            'sand': '#FFD700',     // Gold
            'dirt': '#8B4513',      // Brown
            'birch_leaves': '#77fc03',
            'oak_leaves': '#0e8501',
            'spruce_leaves': '#0eff01',
            'copper_ore': '#C68346',
            'poppy': '#E35335',
            'dandelion': '#F0E130',
            'azalea_leaves': '#ECB4CE',
            'flowering_azalea_leaves': '#ECB4CE',
            'sugar_cane': '#80996d',
            'coal_ore': '#00000'
        };
        return colors[blockName];
    }

    setupTileRoutes(app) {
        app.get('/tiles/:x/:z.png', (req, res) => {
            const { x, z } = req.params;
            const tile = this.tileCache.get(`${x},${z}`);

            if (tile) {
                res.set('Content-Type', 'image/png');
                res.set('Cache-Control', 'public, max-age=604800');
                res.send(tile);
            } else {
                res.status(404).send('Tile not found');
            }
        });
    }

    async renderChunkToTile(chunk) {
        // Create 256x256 canvas (16px per block)
        const canvas = createCanvas(256, 256);
        const ctx = canvas.getContext('2d');

        // Draw biome-based background
        ctx.fillStyle = this.biomeToColor(chunk.biome[0][0]);
        ctx.fillRect(0, 0, 256, 256);

        // Draw blocks
        for (let x = 0; x < 16; x++) {
            for (let z = 0; z < 16; z++) {
                const column = chunk.blocks[x][z];
                const y = this.findTopBlockY(column);
                const blockName = column[y];

                if (blockName !== 'air') {
                    const color = this.blockToColor(blockName);
                    if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect(x * 16, z * 16, 16, 16); // 16px per block
                    }
                }
            }
        }

        // Convert to optimized PNG
        return sharp(canvas.toBuffer())
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toBuffer();
    }

    findTopBlockY(column) {
        for (let y = 255; y >= 0; y--) {
            if (column[y] !== 'air') return y;
        }
        return -1;
    }

    biomeToColor(biomeId) {
        const biomeColors = {
            0: '#88BB67',   // Plains
            1: '#5A7246',   // Forest
            4: '#8EB971',   // River
            12: '#90714D'   // Desert
        };
        return biomeColors[biomeId] || '#888888';
    }

    updateChunk(chunk) {
        this.sockets.forEach(socket => {
            if (socket?.connected) {
                socket.emit('chunk-update', {
                    x: chunk.x,
                    z: chunk.z,
                    url: chunk.tileUrl
                });
            }
        });
    }

    // Add this new method
    async sendInitialState(socket) {
        // Send all cached chunks
        for (const [chunkKey, chunk] of this.tileCache) {
            const [x, z] = chunkKey.split(',').map(Number);

            // Send tile URL if available
            if (this.tileCache.has(chunkKey)) {
                socket.emit('chunk-update', {
                    x,
                    z,
                    url: `/tiles/${x}/${z}.png`
                });
            }
        }
    }
}