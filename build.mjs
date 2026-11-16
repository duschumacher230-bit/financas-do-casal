// Gera os arquivos publicados no GitHub Pages (index.html, app.js) a partir de src/.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
await esbuild.build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: 'app.js', logLevel: 'warning' });
const v = Date.now().toString(36);
writeFileSync('index.html', readFileSync('src/index.tpl.html', 'utf8').replace('__V__', v));
copyFileSync('src/manifest.webmanifest', 'manifest.webmanifest');
console.log('build ok', v);
