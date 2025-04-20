class ResourceManager {
    constructor() {
        this.blockDefinitions = {};
        this.blockModels = {};
        this.blockAtlas = deepslate.TextureAtlas.empty();
        this.blocks = {};
        this.opaque = new Set(/* Load your opaque blocks data */);
    }

    getBlockDefinition(id) {
        return this.blockDefinitions[id.toString()];
    }

    getBlockModel(id) {
        return this.blockModels[id.toString()];
    }

    getTextureUV(id) {
        return this.blockAtlas.getTextureUV(id);
    }

    getTextureAtlas() {
        return this.blockAtlas.getTextureAtlas();
    }

    getBlockFlags(id) {
        return { opaque: this.opaque.has(id.toString()) };
    }

    getBlockProperties(id) {
        return this.blocks[id.toString()]?.properties ?? null;
    }

    getDefaultBlockProperties(id) {
        return this.blocks[id.toString()]?.default ?? null;
    }

    async loadFromZip(url) {
        const assetsBuffer = await (await fetch(url)).arrayBuffer();
        const assets = await JSZip.loadAsync(assetsBuffer);

        // Load block states
        await this._loadFromFolderJson(
            assets.folder('minecraft/blockstates'),
            async (id, data) => {
                const fullId = 'minecraft:' + id;
                this.blockDefinitions[fullId] = deepslate.BlockDefinition.fromJson(data);
            }
        );

        // Load block models
        await this._loadFromFolderJson(
            assets.folder('minecraft/models/block'),
            async (id, data) => {
                const fullId = 'minecraft:block/' + id;
                this.blockModels[fullId] = deepslate.BlockModel.fromJson(data);
            }
        );

        // Load textures
        const textures = {};
        await this._loadFromFolderPng(
            assets.folder('minecraft/textures/block'),
            async (id, data) => {
                textures['minecraft:block/' + id] = data;
            }
        );

        this.blockAtlas = await deepslate.TextureAtlas.fromBlobs(textures);
        Object.values(this.blockModels).forEach(m => m.flatten(this));
    }

    async _loadFromFolderJson(folder, callback) {
        const promises = [];
        folder.forEach((path, file) => {
            if (file.dir || !path.endsWith('.json')) return;
            const id = path.replace(/\.json$/, '');
            promises.push(
                file.async('string', function updateCallback(metadata) {
                }).then(data => callback(id, JSON.parse(data)))
            );
        });
        await Promise.all(promises);
    }

    async _loadFromFolderPng(folder, callback) {
        const promises = [];
        folder.forEach((path, file) => {
            if (file.dir || !path.endsWith('.png')) return;
            const id = path.replace(/\.png$/, '');
            promises.push(
                file.async('blob').then(data => callback(id, data))
            );
        });
        await Promise.all(promises);
    }

    async loadBlocks(url) {
        this.blocks = await (await fetch(url)).json();
    }
}