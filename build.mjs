// Gera os arquivos publicados no GitHub Pages (index.html, app.js e chunks/) a partir de src/.
// As bibliotecas de Excel ficam em arquivos separados (chunks/) e só baixam quando alguém importa/exporta.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
rmSync('chunks', { recursive: true, force: true });
await esbuild.build({
  entryPoints: ['src/app.js'], bundle: true, format: 'esm', minify: true, target: 'es2020',
  splitting: true, outdir: '.', entryNames: '[name]', chunkNames: 'chunks/[name]-[hash]', logLevel: 'warning',
});
const v = Date.now().toString(36);
writeFileSync('index.html', readFileSync('src/index.tpl.html', 'utf8').replace('__V__', v));
copyFileSync('src/manifest.webmanifest', 'manifest.webmanifest');
console.log('build ok', v);
