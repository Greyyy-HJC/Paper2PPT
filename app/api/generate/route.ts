import JSZip from 'jszip';
import { NextResponse } from 'next/server';
import { analyzePaper, type AnalysisResult } from '@/lib/core/analyzer';
import { extractPdf, type ExtractedPdf } from '@/lib/pdf/extract';
import { generateDeckWithLlm } from '@/lib/server/llm';
import { loadTemplateAssetsFromFs } from '@/lib/server/templateAssets';
import { sanitizeFilenamePart } from '@/lib/shared/filenames';
import { renderIfBeamerDocument } from '@/lib/templates/ifBeamer';

export const runtime = 'nodejs';

function parseTargetSlides(value: FormDataEntryValue | null): number {
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 6 && parsed <= 30) {
      return parsed;
    }
  }
  return 12;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const formData = await request.formData();

    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
      return new NextResponse('Missing PDF file in request.', { status: 400 });
    }

    const mode = (formData.get('mode') as string) ?? 'llm';
    const provider = (formData.get('provider') as string) ?? 'openai';
    const model = (formData.get('model') as string) ?? 'gpt-4o-mini';
    const apiBaseUrl = (formData.get('apiBaseUrl') as string) ?? 'https://api.openai.com/v1';
    const targetSlides = parseTargetSlides(formData.get('targetSlides'));

    const baselineRaw = formData.get('baseline');
    let baselineFromClient: AnalysisResult | null = null;
    if (typeof baselineRaw === 'string' && baselineRaw.trim().length > 0) {
      try {
        baselineFromClient = JSON.parse(baselineRaw) as AnalysisResult;
      } catch (error) {
        console.warn('[Paper2PPT] Failed to parse baseline payload', error);
      }
    }

    let extracted: ExtractedPdf | null = null;
    let baselineAnalysis: AnalysisResult | null = baselineFromClient;
    let deckData: Pick<AnalysisResult, 'metadata' | 'outline' | 'slides'>;

    const allowedProviders = new Set(['openai', 'anthropic', 'azure', 'deepseek', 'custom']);
    const normalizedProvider = allowedProviders.has(provider)
      ? (provider as 'openai' | 'anthropic' | 'azure' | 'deepseek' | 'custom')
      : 'openai';

    const ensureBaseline = async (): Promise<AnalysisResult> => {
      if (baselineAnalysis) {
        return baselineAnalysis;
      }
      if (!extracted) {
        const pdfBuffer = await fileEntry.arrayBuffer();
        extracted = await extractPdf(pdfBuffer);
      }
      baselineAnalysis = analyzePaper(extracted, targetSlides);
      return baselineAnalysis;
    };

    if (mode === 'llm') {
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return new NextResponse('Missing Authorization Bearer token for LLM mode.', { status: 401 });
      }
      const apiKey = authHeader.slice(7).trim();
      if (!apiKey) {
        return new NextResponse('Invalid API key.', { status: 401 });
      }

      const baselineForLlm = await ensureBaseline();

      const llmDeck = await generateDeckWithLlm(baselineForLlm, {
        apiKey,
        apiBaseUrl,
        model,
        provider: normalizedProvider,
        targetSlides,
      });

      deckData = {
        metadata: {
          ...llmDeck.metadata,
          generatedAt: new Date().toISOString(),
          mode: 'llm',
        },
        outline: llmDeck.outline,
        slides: llmDeck.slides,
      };
    } else {
      const baseline = await ensureBaseline();
      deckData = {
        metadata: {
          ...baseline.metadata,
          generatedAt: new Date().toISOString(),
          mode: 'static',
        },
        outline: baseline.outline,
        slides: baseline.slides,
      };
    }

    const latexSource = renderIfBeamerDocument({
      metadata: deckData.metadata,
      outline: deckData.outline,
      slides: deckData.slides,
    });

    const templateAssets = await loadTemplateAssetsFromFs();
    const zip = new JSZip();
    zip.file('main.tex', latexSource);

    for (const asset of templateAssets) {
      zip.file(asset.path, asset.data, { binary: true });
    }

    const filenameStem = sanitizeFilenamePart(deckData.metadata.paperTitle);
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const zipFilename = `Paper2PPT-${filenameStem}-${timestamp}.zip`;

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return NextResponse.json({
      deck: {
        metadata: deckData.metadata,
        outline: deckData.outline,
        slides: deckData.slides,
        latexSource,
      },
      filename: zipFilename,
      zipBase64: Buffer.from(zipBuffer).toString('base64'),
    });
  } catch (error) {
    console.error('[Paper2PPT] generate API error', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return new NextResponse(message, { status: 500 });
  }
}
