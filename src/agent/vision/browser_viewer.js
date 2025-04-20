import settings from '../../../settings.js';
import prismarineViewer from 'prismarine-viewer';
const mineflayerViewer = prismarineViewer.mineflayer;

export function addBrowserViewer(bot, count_id) {
    if (settings.show_bot_views)
        mineflayerViewer(bot, { port: 3050 + count_id, firstPerson: true, });
}