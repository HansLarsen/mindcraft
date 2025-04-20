// world.js
const canvas = document.getElementById('worldCanvas');
const BLOCK_SIZE = 4;
const chunkCache = new Map(); // Stores Map<z, Map<x, Map<y, blockName>>>

// Initialize WebSocket connection
const socket = io();

// Request initial chunks
socket.emit('request-chunks', { chunks: [{ x: 0, z: 0 }] });

// Handle incoming chunks
socket.on('chunk-data', (data) => {
    data.forEach(chunk => {
        if (!chunk) return;
        const key = `${chunk.x},${chunk.z}`;

        // Convert palette-encoded data to 3D array
        const rawData = this.unpackChunk(chunk);

        chunkCache.set(key, rawData);
    });
});

function unpackChunk(chunk) {
    // Create 3D array: z -> x -> y -> blockName
    const rawData = new Map();
    const palette = new Map(chunk.palette);

    chunk.blocks.forEach((column, columnIndex) => {
        const x = Math.floor(columnIndex / 16);
        const z = columnIndex % 16;

        if (!rawData.has(z)) rawData.set(z, new Map());
        const xMap = rawData.get(z);

        if (!xMap.has(x)) xMap.set(x, new Map());
        const yMap = xMap.get(x);

        column.forEach((paletteIndex, yOffset) => {
            const y = chunk.yStart + yOffset;
            let blockName = 'air';

            for (let [key, value] of palette.entries()) {
                if (value === paletteIndex) {
                    blockName = key.split('|')[0];
                    break;
                }
            }
            yMap.set(y, blockName);
        });
    });

    return {
        x: chunk.x,
        z: chunk.z,
        data: rawData,
        yRange: [chunk.yStart, chunk.yEnd],
        timestamp: Date.now()
    };
}

// Example accessor function
function getBlock(x, y, z) {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);
    const key = `${chunkX},${chunkZ}`;

    const chunk = chunkCache.get(key);
    if (!chunk) return 'air';

    const localX = x % 16;
    const localZ = z % 16;

    return chunk.data.get(localZ)?.get(localX)?.get(y) || 'air';
}