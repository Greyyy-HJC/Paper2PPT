import { promises as fs } from 'node:fs';
import path from 'node:path';

const TEMPLATE_DIR = path.join(process.cwd(), 'public', 'templates', 'if-beamer');

interface TemplateAsset {
  path: string;
  data: Buffer;
}

interface TemplateManifest {
  assets: string[];
}

async function readManifest(): Promise<TemplateManifest> {
  const manifestPath = path.join(TEMPLATE_DIR, 'manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as TemplateManifest;
  if (!Array.isArray(parsed.assets)) {
    throw new Error('Invalid template manifest.');
  }
  return parsed;
}

export async function loadTemplateAssetsFromFs(): Promise<TemplateAsset[]> {
  const manifest = await readManifest();
  const assets: TemplateAsset[] = [];

  for (const relativePath of manifest.assets) {
    const absolutePath = path.join(TEMPLATE_DIR, relativePath);
    const data = await fs.readFile(absolutePath);
    assets.push({ path: relativePath, data });
  }

  return assets;
}
