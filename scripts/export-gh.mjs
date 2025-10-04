import { rmSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'out');
const docsDir = join(process.cwd(), 'docs');

if (!existsSync(outDir)) {
  throw new Error('Build output not found. Run "npm run build:static" first.');
}

if (existsSync(docsDir)) {
  rmSync(docsDir, { recursive: true, force: true });
}

mkdirSync(docsDir, { recursive: true });
cpSync(outDir, docsDir, { recursive: true });

console.log('Copied static export to ./docs for GitHub Pages.');
