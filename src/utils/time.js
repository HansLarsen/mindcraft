export function getTimestamp() {
    const date = new Date();
    return date.toISOString().replace('T', ' ').replace(/\..+/, '');
}