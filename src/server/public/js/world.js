// world.js
const canvas = document.getElementById('worldCanvas');
const BLOCK_SIZE = 4;
const chunkCache = new Map();
const activeChunks = new Set();
let chunkButtons = {};

// Initialize WebSocket connection
const socket = io();

// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
const controls = new THREE.OrbitControls(camera, canvas);

// Position camera
camera.position.set(0, 255, 0);
controls.target.set(0, 0, 0); // Look at origin
controls.update();
controls.enableDamping = true;
camera.updateMatrixWorld()

// Deepslate structure setup
let deepslateRenderer = null;
let localResourceManager = null

// Window resize handler
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
// Get the reset button element
const resetButton = document.getElementById('resetCameraButton');
// Add a click event listener to the reset button
resetButton.addEventListener('click', resetCamera);

animate();

socket.emit('get-cached-chunks', (chunks) => {
    const chunkList = document.getElementById('chunkList');
    chunkList.innerHTML = ''; // Clear existing buttons

    let chunks_list = JSON.parse(chunks);

    chunks_list.forEach(chunk => {
        if (!chunk.x) chunk.x = 0;
        if (!chunk.z) chunk.z = 0;

        const button = document.createElement('button');
        const key = `${chunk.x},${chunk.z}`;
        button.className = 'chunk-button';
        button.textContent = `Chunk ${key}`;
        button.dataset.chunkKey = key;

        // Add toggle handler
        button.addEventListener('click', () => toggleChunk(chunk.x, chunk.z));

        chunkButtons[key] = button;
        chunkList.appendChild(button);
    });
});

// Function to resize the canvas
function resizeCanvas() {
    canvas.width = window.innerWidth; // Set canvas width to window width
    canvas.height = window.innerHeight; // Set canvas height to window height
    camera.aspect = canvas.width / canvas.height;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.width, canvas.height);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update controls
    controls.update();
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.getInverse(camera.matrixWorld);

    // Convert Three.js camera matrix to deepslate view matrix
    const view = new Float32Array(camera.matrixWorldInverse.elements);

    renderer.render(scene, camera);

    // Render deepslate structure
    if (deepslateRenderer) {
        deepslateRenderer.drawStructure(view);
    }
}

// Handle incoming chunks
socket.on('chunk-data', async (data) => {
    if (localResourceManager === null) {
        localResourceManager = new ResourceManager();
        await localResourceManager.loadFromZip('/assets/minecraft.zip');
        await localResourceManager.loadBlocks('https://raw.githubusercontent.com/Arcensoth/mcdata/master/processed/reports/blocks/simplified/data.min.json');
    }

    data.forEach(chunk => {
        if (!chunk) return;
        const key = `${chunk.x},${chunk.z}`;
        if (!activeChunks.has(key)) return;  // Ignore unrequested chunks

        const rawData = this.unpackChunk(chunk);
        chunkCache.set(key, rawData);
    });

    const new_bounds = calculateStructureBounds(chunkCache);
    const structure = new deepslate.Structure(new_bounds[1]);

    chunkCache.forEach((chunk) => {
        fillDeepslateStructure(new_bounds[0], structure, chunk);
    });

    // Obtain the WebGL context of a canvas element
    const gl = canvas.getContext('webgl')

    // See the demo on how to create a resources object
    deepslateRenderer = new deepslate.StructureRenderer(gl, structure, localResourceManager)
});


function unpackChunk(chunk) {
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
function getBlock(key, x, y, z) {

    const chunk = chunkCache.get(key);
    if (!chunk) return 'air';

    return chunk.data.get(z)?.get(x)?.get(y) || 'air';
}

function resetCamera() {
    camera.position.set(0, 255, 0);  // Reset position
    camera.lookAt(0, 0, 0);  // Look at the origin
    camera.updateMatrixWorld();
    controls.target.set(0, 0, 0);
    controls.update();

}

function calculateStructureBounds(chunkCache) {
    let minX = 0;
    let maxX = 0;
    let minZ = 0;
    let maxZ = 0;
    let minY = 0;
    let maxY = 0;

    chunkCache.forEach((chunk) => {
        let min_x_coord = chunk.x;
        let max_x_coord = (chunk.x + 16);
        let min_z_coord = chunk.z;
        let max_z_coord = (chunk.z + 16);

        if (max_x_coord > maxX) maxX = max_x_coord;
        if (min_x_coord < minX) minX = min_x_coord;
        if (max_z_coord > maxZ) maxZ = max_z_coord;
        if (min_z_coord < minZ) minZ = min_z_coord;

        let min_y_coord = chunk.yRange[0];
        let max_y_coord = chunk.yRange[1];

        if (min_y_coord < minY) minY = min_y_coord;
        if (max_y_coord > maxY) maxY = max_y_coord;
    })

    let offset = [minX, minY, minZ];
    let box_size = [maxX - minX, maxY - minY, maxZ - minZ];

    return [
        offset, box_size
    ];
}

function fillDeepslateStructure(offset, structure, chunk) {
    let block_coord_x = chunk.x;
    let block_coord_z = chunk.z;

    for (let x = 0; x < 16; x++) {
        for (let y = chunk.yRange[0]; y < chunk.yRange[1]; y++) {
            for (let z = 0; z < 16; z++) {
                const worldX = (x + block_coord_x) - offset[0];
                const worldY = y - offset[1];
                const worldZ = (z + block_coord_z) - offset[2];

                const key = `${chunk.x},${chunk.z}`;
                const blockName = getBlock(key, x, y, z);

                if (blockName !== 'air') {
                    if (deepslate && structure) {
                        structure.addBlock([worldX, worldY, worldZ], "minecraft:" + blockName);
                    }
                }

            }
        }
    }
}

function toggleChunk(x, z) {
    const key = `${x},${z}`;
    const button = chunkButtons[key];

    if (activeChunks.has(key)) {
        // Deactivate chunk
        activeChunks.delete(key);
        button.classList.remove('active');
        chunkCache.delete(key);
        rebuildStructure();
    } else {
        // Activate chunk
        activeChunks.add(key);
        button.classList.add('active');
        socket.emit('request-chunks', { chunks: [{ x, z }] });
    }
}
