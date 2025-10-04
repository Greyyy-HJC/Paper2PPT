import type { SlideContent } from '../types';
import type { ExtractedPdf } from '../pdf/extract';
import { analyzePaper, truncateSentence } from '../core/analyzer';

interface LlmOptions {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'azure' | 'deepseek' | 'custom';
  targetSlides: number;
}

interface LlmSlidePayload {
  section?: string;
  title: string;
  bullets?: string[];
  paragraph?: string;
  notes?: string;
}

interface LlmResponsePayload {
  paperTitle?: string;
  paperSubtitle?: string;
  authors?: string;
  outline?: string[];
  slides?: LlmSlidePayload[];
}

function buildEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (trimmed.toLowerCase().endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function buildPrompt({
  baseMetadata,
  outline,
  sentences,
  targetSlides,
}: {
  baseMetadata: {
    title: string;
    subtitle?: string;
    authors?: string;
  };
  outline: string[];
  sentences: string[];
  targetSlides: number;
}): { system: string; user: string } {
  const keySentences = sentences.slice(0, 18).map((sentence, index) => `${index + 1}. ${truncateSentence(sentence, 200)}`);
  const context = keySentences.join('\n');
  const outlineText = outline.map((item, index) => `${index + 1}. ${item}`).join('\n');

  const user = `Paper title: ${baseMetadata.title}\n` +
    (baseMetadata.subtitle ? `Subtitle or venue: ${baseMetadata.subtitle}\n` : '') +
    (baseMetadata.authors ? `Author line: ${baseMetadata.authors}\n` : '') +
    `Suggested outline:\n${outlineText || '1. Introduction\n2. Method\n3. Results\n4. Conclusion'}\n\n` +
    `Important sentences from the paper (truncated):\n${context}\n\n` +
    `Target slide count (including conclusion): ${targetSlides}.\n` +
    'Produce a structured LaTeX-friendly outline.';

  const system = [
    'You are Paper2PPT, an expert technical writer who transforms academic papers into Beamer slide decks.',
    'Return JSON ONLY with the schema:',
    '{',
    '  "paperTitle": string,',
    '  "paperSubtitle": string,',
    '  "authors": string,',
    '  "outline": string[],',
    '  "slides": [',
    '     { "section": string, "title": string, "bullets": string[], "notes": string }',
    '  ]',
    '}',
    `Limit slides to ${targetSlides - 2} content slides plus one conclusion slide.`,
    'Bullets must be concise (max 22 words) and factual.',
  ].join(' ');

  return { system, user };
}

async function callProviderChat(options: {
  provider: LlmOptions['provider'];
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const { provider, apiKey, apiBaseUrl, model, systemPrompt, userPrompt } = options;
  const trimmedBase = apiBaseUrl.trim().replace(/\/$/, '');

  if (provider === 'anthropic') {
    const endpoint = `${trimmedBase}/messages`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic request failed: ${response.status} ${errorBody}`);
    }

    const payload = await response.json();
    const content = payload?.content?.[0]?.text;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Anthropic response missing content.');
    }
    return content;
  }

  const endpoint = buildEndpoint(trimmedBase);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'azure') {
    headers['api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorBody}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('LLM response missing content.');
  }

  return content;
}

function mapSlidePayload(slide: LlmSlidePayload, index: number): SlideContent {
  const bullets = Array.isArray(slide.bullets) && slide.bullets.length > 0
    ? slide.bullets.map((item) => item.trim()).filter((item) => item.length > 0)
    : slide.paragraph
      ? [slide.paragraph.trim()]
      : ['(slide content pending refinement)'];

  return {
    id: `llm-slide-${index + 1}`,
    title: slide.title?.trim() || `Topic ${index + 1}`,
    section: slide.section?.trim(),
    blocks: [
      {
        kind: 'bullets',
        items: bullets,
      },
    ],
    notes: slide.notes?.trim(),
  };
}

export async function generateDeckWithLlm(
  extracted: ExtractedPdf,
  options: LlmOptions,
) {
  const baseline = analyzePaper(extracted, options.targetSlides);

  const prompt = buildPrompt({
    baseMetadata: {
      title: baseline.metadata.paperTitle,
      subtitle: baseline.metadata.paperSubtitle,
      authors: baseline.metadata.authors,
    },
    outline: baseline.outline,
    sentences: baseline.sentences,
    targetSlides: options.targetSlides,
  });

  try {
    const content = await callProviderChat({
      provider: options.provider,
      apiKey: options.apiKey,
      apiBaseUrl: options.apiBaseUrl,
      model: options.model,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
    });

    const parsed = JSON.parse(content) as LlmResponsePayload;
    const slidesPayload = Array.isArray(parsed.slides) && parsed.slides.length > 0
      ? parsed.slides
      : baseline.slides.map((slide) => ({
          section: slide.section,
          title: slide.title,
          bullets: slide.blocks
            .filter((block) => block.kind === 'bullets')
            .flatMap((block) => (block.kind === 'bullets' ? block.items : [])),
        }));

    const mappedSlides = slidesPayload.map((slide, index) => mapSlidePayload(slide, index));
    const finalSlides = mappedSlides.length > 0 ? mappedSlides : baseline.slides;

    return {
      metadata: {
        ...baseline.metadata,
        paperTitle: parsed.paperTitle?.trim() || baseline.metadata.paperTitle,
        paperSubtitle: parsed.paperSubtitle?.trim() || baseline.metadata.paperSubtitle,
        authors: parsed.authors?.trim() || baseline.metadata.authors,
        mode: 'llm' as const,
      },
      outline: parsed.outline && parsed.outline.length > 0 ? parsed.outline : baseline.outline,
      slides: finalSlides,
    };
  } catch (error) {
    // fallback to baseline if LLM fails
    return {
      metadata: {
        ...baseline.metadata,
        mode: 'static' as const,
      },
      outline: baseline.outline,
      slides: baseline.slides,
    };
  }
}
