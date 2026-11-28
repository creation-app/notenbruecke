import { build } from 'esbuild'; import fs from 'node:fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: process.argv.includes('--min'), write: false, target: 'es2019' });
const font = (pkg, file, fam, w) => `@font-face{font-family:"${fam}";font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64')}) format("woff2")}`;
const fonts = [font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-400-normal.woff2', 'Atkinson Hyperlegible', 400), font('atkinson-hyperlegible', 'atkinson-hyperlegible-latin-700-normal.woff2', 'Atkinson Hyperlegible', 700), font('press-start-2p', 'press-start-2p-latin-400-normal.woff2', 'Press Start 2P', 400)].join('\n');
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
// Zwei Adressen, ein Spiel: die Test-Fassung (alles frei) und die Kauf-Fassung (Schranke nach den ersten Leveln).
const page = shop => fs.readFileSync('src/index.template.html', 'utf8').replace(/__ROOT__/g, shop ? '../' : '').replace('/*FONTS*/', () => fonts).replace('/*BUNDLE*/', () => (shop ? 'window.NB_SHOP=true;\n' : '') + js);
fs.mkdirSync('dist/shop', { recursive: true }); fs.writeFileSync('dist/notenbruecke.html', page(false)); fs.writeFileSync('dist/index.html', page(false)); fs.writeFileSync('dist/shop/index.html', page(true));
// Installierbar: Manifest, Symbole und Service Worker liegen neben der Seite.
fs.mkdirSync('dist/icons', { recursive: true }); for (const f of fs.readdirSync('static/icons')) fs.copyFileSync('static/icons/' + f, 'dist/icons/' + f);
fs.copyFileSync('static/sw.js', 'dist/sw.js'); fs.copyFileSync('static/manifest.webmanifest', 'dist/manifest.webmanifest'); fs.copyFileSync('static/manifest.shop.webmanifest', 'dist/shop/manifest.webmanifest');
// Lehrer-Seite (eigene kleine Seite, gleiche Server-Adresse wie das Spiel)
const api = (fs.readFileSync('src/config.js', 'utf8').match(/API_URL = '([^']*)'/) || [])[1] || '';
const lr = await build({ entryPoints: ['src/lehrer.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2019' });
fs.mkdirSync('dist/lehrer', { recursive: true }); fs.writeFileSync('dist/lehrer/index.html', fs.readFileSync('src/lehrer.template.html', 'utf8').replace("/*API*/''", () => JSON.stringify(api)).replace('/*BUNDLE*/', () => lr.outputFiles[0].text.replace(/<\/script/g, '<\\/script')));
console.log('gebaut:', (page(false).length / 1024).toFixed(0), 'KB (Test- und Kauf-Fassung)');
