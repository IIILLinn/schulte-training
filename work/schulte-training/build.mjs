import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const template = await readFile(new URL('./src/index.html', root), 'utf8');
const styles = await readFile(new URL('./src/styles.css', root), 'utf8');
const core = await readFile(new URL('./src/core.js', root), 'utf8');
const app = await readFile(new URL('./src/app.js', root), 'utf8');
const html = template
  .replace('/* __STYLES__ */', styles)
  .replace('/* __CORE__ */', core)
  .replace('/* __APP__ */', app);

await writeFile(new URL('../../outputs/schulte-training.html', root), html);
console.log('built outputs/schulte-training.html');
