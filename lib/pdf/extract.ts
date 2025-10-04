export interface ExtractedPdf {
  pageLines: string[][];
  allText: string;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

type PdfInput = File | Blob | ArrayBuffer | Uint8Array;

async function toArrayBuffer(input: PdfInput): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength,
    ) as ArrayBuffer;
  }

  if (typeof (input as Blob).arrayBuffer === 'function') {
    return await (input as Blob).arrayBuffer();
  }

  throw new Error('Unsupported PDF source input.');
}

export async function extractPdf(input: PdfInput): Promise<ExtractedPdf> {
  const arrayBuffer = await toArrayBuffer(input);
  const data = new Uint8Array(arrayBuffer);
  const pdfjs = await import('pdfjs-dist/build/pdf');

  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
  } as any);
  const doc = await loadingTask.promise;

  const pageLines: string[][] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';

    for (const item of textContent.items as any[]) {
      if (!item || typeof item.str !== 'string') {
        continue;
      }
      const text = normalizeWhitespace(item.str);
      if (!text) {
        continue;
      }
      currentLine = currentLine ? `${currentLine} ${text}` : text;
      if (item.hasEOL) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
    }

    if (currentLine) {
      lines.push(currentLine.trim());
    }

    pageLines.push(lines);
  }

  let infoTitle: string | undefined;
  let infoAuthor: string | undefined;
  let infoSubject: string | undefined;
  let infoKeywords: string | undefined;

  try {
    const rawMetadata = await doc.getMetadata();
    const info = ((rawMetadata as any)?.info ?? {}) as Record<string, unknown>;
    infoTitle = normalizeWhitespace((info.Title as string) ?? '');
    infoAuthor = normalizeWhitespace((info.Author as string) ?? '');
    infoSubject = normalizeWhitespace((info.Subject as string) ?? '');
    infoKeywords = normalizeWhitespace((info.Keywords as string) ?? '');
  } catch (error) {
    // ignore metadata errors
  }

  await doc.cleanup();
  await doc.destroy();

  const allText = pageLines.flat().join('\n');

  return {
    pageLines,
    allText,
    metadata: {
      title: infoTitle || undefined,
      author: infoAuthor || undefined,
      subject: infoSubject || undefined,
      keywords: infoKeywords || undefined,
    },
  };
}
