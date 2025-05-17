
const socket = io();

let isRendering = false;

// Initialize Leaflet Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 8,
    zoomDelta: 0.25
}).setView([0, 0], 3);

const tileLayer = L.layerGroup().addTo(map);
const tileCache = new Map();

// Handle updates from server
socket.on('chunk-update', ({ x, z, url }) => {
    const key = `${x}|${z}`;
    const bounds = chunkToBounds(z, x);

    if (tileCache.has(key)) {
        tileCache.get(key).setUrl(url); // Update existing overlay
    } else {
        const overlay = L.imageOverlay(url, bounds, {
            className: `chunk-${x}-${z}`,
            interactive: true
        }).addTo(tileLayer);

        tileCache.set(key, overlay);
    }
});

function chunkToBounds(chunkX, chunkZ) {
    // Minecraft X = Leaflet Lng (horizontal)
    // Minecraft Z = Leaflet Lat (vertical inverted)
    const tileSize = 256; // Match your tile image size

    return L.latLngBounds(
        L.latLng(-(chunkZ + 1) * tileSize,  // South edge
            chunkX * tileSize),       // West edge
        L.latLng(-chunkZ * tileSize,        // North edge 
            (chunkX + 1) * tileSize)   // East edge
    );
}

// Add coordinate debugger
map.on('click', (e) => {
    console.log('Clicked at:', e.latlng);
});

// Add grid lines
function addGrid() {
    for (let x = -16; x <= 16; x++) {
        for (let z = -16; z <= 16; z++) {
            L.rectangle(chunkToBounds(x, z), {
                color: '#666',
                weight: 1,
                fill: false
            }).addTo(map);
        }
    }
}
//addGrid();

map.on('moveend', function () {
    updateLayer()
});

function updateLayer() {
    const bounds = map.getBounds();

    // Calculate approximate chunk range based on bounds
    const tileSize = 256; // Should match your chunkToBounds calculation

    // Convert bounds to chunk coordinates
    const minX = Math.floor(bounds.getWest() / tileSize);
    const maxX = Math.floor(bounds.getEast() / tileSize);
    const minZ = Math.floor(-bounds.getNorth() / tileSize);
    const maxZ = Math.floor(-bounds.getSouth() / tileSize);

    // Check chunks in this range
    for (let x = minZ; x <= maxZ; x++) {
        for (let z = minX; z <= maxX; z++) {
            const key = `${x}|${z}`;
            const chunk = tileCache.get(key);

            if (chunk) {
                const chunkBounds = chunkToBounds(chunk.z, chunk.x);

                // Double-check bounds intersection (in case of edge cases)
                if (bounds.intersects(chunkBounds)) {
                    L.imageOverlay(chunk.url, chunkBounds, {
                        className: `chunk-${chunk.x}-${chunk.z}`,
                        interactive: true
                    }).addTo(tileLayer);
                }
            }
        }
    }
}

updateLayer()
