
const socket = io();

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