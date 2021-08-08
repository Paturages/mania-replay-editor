// This adds a proper export to the fuck old lzma npm package so it works here
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.resolve(__dirname, '..', 'node_modules', 'lzma', 'src', 'lzma_worker.js'), { encoding: 'utf8' });
const lines = content.split('\n');

fs.writeFileSync(path.resolve(__dirname, '..', 'src', 'lzma.js'), lines.slice(0, -2).join('\n') + `
export default LZMA;`);
