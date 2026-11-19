import { build } from 'esbuild'; import fs from 'node:fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2019' });
const font = (pkg, file, fam, w) => `@font-face{font-family:"${fam}";font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}) format("woff2")}`;
const fonts = [font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-400-normal.woff2', 'Atkinson Hyperlegible', 400), font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-700-normal.woff2', 'Atkinson Hyperlegible', 700), font('press-start-2p', 'press-start-2p-latin-400-normal.woff2', 'Press Start 2P', 400)].join('\n');
const html = fs.readFileSync('src/index.template.html', 'utf8').replace('/*FONTS*/', () => fonts).replace('/*BUNDLE*/', () => r.outputFiles[0].text.replace(/<\/script/g, '<\\/script'));
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/notenbruecke.html', html); console.log('gebaut:', (html.length / 1024).toFixed(0), 'KB');
