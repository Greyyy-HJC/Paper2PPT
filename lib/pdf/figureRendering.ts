import type { FigureSummary } from '../core/analyzer';

interface FigureAsset {
  id: string;
  filename: string;
  caption?: string;
  pageIndex: number;
  blob: Blob;
}

function resolveAssetPrefix(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const data = (window as any).__NEXT_DATA__;
  if (data && typeof data.assetPrefix === 'string' && data.assetPrefix.length > 0) {
    return data.assetPrefix.replace(/\/$/, '');
  }
  return '';
}

async function getPdfDocument(arrayBuffer: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/build/pdf');
  const prefix = resolveAssetPrefix();
  const workerSrc = prefix
    ? `${prefix.replace(/\/$/, '')}/pdf.worker.min.js`
    : './pdf.worker.min.js';
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableWorker: true,
  } as any).promise;
}

async function renderPageToBlob(page: any, pageIndex: number): Promise<Blob> {
  const scale = 1.6;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context!, viewport }).promise;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Failed to render page ${pageIndex + 1}`));
      }
    }, 'image/png', 0.92);
  });
}

export async function extractFigureImages(
  file: File,
  figures: FigureSummary[] = [],
  maxFigures = 6,
): Promise<FigureAsset[]> {
  if (figures.length === 0) {
    return [];
  }

  const limited = figures.slice(0, maxFigures);
  const buffer = await file.arrayBuffer();
  const doc = await getPdfDocument(buffer);
  const assets: FigureAsset[] = [];

  for (let index = 0; index < limited.length; index += 1) {
    const figure = limited[index];
    const pageIndex = Math.max(0, Math.min(doc.numPages - 1, figure.pageIndex));
    const page = await doc.getPage(pageIndex + 1);
    const blob = await renderPageToBlob(page, pageIndex);
    const filename = figure.filename ?? `figure-${pageIndex + 1}-${index + 1}.png`;
    assets.push({
      id: figure.id,
      filename,
      caption: figure.caption,
      pageIndex,
      blob,
    });
  }

  await doc.cleanup();
  await doc.destroy();

  return assets;
}
