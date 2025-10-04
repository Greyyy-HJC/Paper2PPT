import JSZip from 'jszip';
import { analyzePaper } from '../core/analyzer';
import { extractPdf } from '../pdf/extract';
import { sanitizeFilenamePart } from '../shared/filenames';
import { renderIfBeamerDocument } from '../templates/ifBeamer';
import type { GeneratedDeck } from '../types';

async function fetchTemplateAssets(): Promise<{ path: string; data: ArrayBuffer }[]> {
  const basePath = '/templates/if-beamer';
  const manifestResponse = await fetch(`${basePath}/manifest.json`);

  if (!manifestResponse.ok) {
    throw new Error('Unable to load template manifest.');
  }

  const manifest = await manifestResponse.json();
  const assets: { path: string; data: ArrayBuffer }[] = [];

  if (Array.isArray(manifest.assets)) {
    for (const assetPath of manifest.assets as string[]) {
      const assetResponse = await fetch(`${basePath}/${assetPath}`);
      if (!assetResponse.ok) {
        throw new Error(`Unable to fetch template asset: ${assetPath}`);
      }
      const buffer = await assetResponse.arrayBuffer();
      assets.push({ path: assetPath, data: buffer });
    }
  }

  return assets;
}

interface StaticOptions {
  targetSlides?: number;
}

export async function generateStaticDeck(file: File, options: StaticOptions = {}) {
  const extracted = await extractPdf(file);
  const targetSlides = Math.max(8, Math.min(15, options.targetSlides ?? 12));
  const analysis = analyzePaper(extracted, targetSlides);

  const deck: GeneratedDeck = {
    metadata: analysis.metadata,
    outline: analysis.outline,
    slides: analysis.slides,
    latexSource: '',
  };

  const latexSource = renderIfBeamerDocument({
    metadata: deck.metadata,
    outline: deck.outline,
    slides: deck.slides,
  });
  deck.latexSource = latexSource;

  const templateAssets = await fetchTemplateAssets();

  const zip = new JSZip();
  zip.file('main.tex', latexSource);

  for (const asset of templateAssets) {
    zip.file(asset.path, asset.data, { binary: true });
  }

  const filenameStem = sanitizeFilenamePart(deck.metadata.paperTitle);
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const zipFilename = `Paper2PPT-${filenameStem}-${timestamp}.zip`;
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  return { deck, zipBlob, zipFilename };
}
