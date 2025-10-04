import type { DeckMetadata, SlideContent } from '../types';
import type { ExtractedPdf } from '../pdf/extract';

export interface AnalysisResult {
  metadata: DeckMetadata;
  outline: string[];
  slides: SlideContent[];
  sentences: string[];
}

const FALLBACK_OUTLINE = [
  'Motivation & Problem Statement',
  'Core Methodology',
  'Key Findings',
  'Implications & Future Work',
];

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(' ')
    .map((segment) => (segment.length === 0 ? segment : segment[0].toUpperCase() + segment.slice(1)))
    .join(' ');
}

export function collectHeadings(lines: string[]): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) {
      continue;
    }

    const wordCount = line.split(/\s+/).length;
    const looksNumbered = /^\d+(\.\d+)*\s+/.test(line);
    const looksKeyword = /(introduction|background|related work|method|approach|model|experiment|evaluation|result|discussion|conclusion|future work|summary)/i.test(line);
    const looksTitleCase = wordCount <= 8 && !/[.!?]$/.test(line) && line === titleCase(line);

    if (wordCount <= 2) {
      continue;
    }

    if (!(looksNumbered || looksKeyword || looksTitleCase)) {
      continue;
    }

    const withoutNumbers = line.replace(/^\d+(\.\d+)*\s+/, '');
    const normalized = withoutNumbers.replace(/[:;,.\-\s]+$/g, '').trim();
    const key = normalized.toLowerCase();

    if (!normalized || normalized.length < 3 || normalized.length > 70) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    headings.push(titleCase(normalized));

    if (headings.length >= 12) {
      break;
    }
  }

  return headings;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\r/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 0);
}

export function truncateSentence(sentence: string, maxLength = 160): string {
  if (sentence.length <= maxLength) {
    return sentence;
  }
  const truncated = sentence.slice(0, maxLength - 1).replace(/[,:;\-\s]+$/g, '').trim();
  return `${truncated}…`;
}

function sentencesFromChunk(chunk: string[]): string[] {
  const bullets: string[] = [];
  for (const sentence of chunk) {
    const fragments = sentence.split(/;|:(?!\/)/);
    for (const fragment of fragments) {
      const text = cleanLine(fragment);
      if (text.length === 0) {
        continue;
      }
      if (/^(figure|table)\s+\d+/i.test(text)) {
        continue;
      }
      bullets.push(truncateSentence(text));
    }
  }
  return bullets.slice(0, 6);
}

function deriveTitle(firstPageLines: string[], metadataTitle?: string): string {
  const candidates = [metadataTitle, ...firstPageLines].map((line) => cleanLine(line ?? ''));
  for (const candidate of candidates) {
    if (!candidate || candidate.length < 8) {
      continue;
    }
    if (/^paper$/i.test(candidate)) {
      continue;
    }
    return candidate;
  }
  return 'Untitled Research Paper';
}

function deriveAuthors(firstPageLines: string[], metadataAuthor?: string): string | undefined {
  if (metadataAuthor && metadataAuthor.length >= 4) {
    return metadataAuthor;
  }

  for (const line of firstPageLines.slice(1, 6)) {
    const cleaned = cleanLine(line);
    if (!cleaned) {
      continue;
    }
    if (/\b(author|by|student|advisor)\b/i.test(cleaned)) {
      return cleaned.replace(/^(author|by)[:\s]+/i, '').trim();
    }
    if (/(,| and )/.test(cleaned) && cleaned.split(/\s+/).length <= 15) {
      return cleaned;
    }
  }

  return undefined;
}

function deriveSubtitle(firstPageLines: string[], metadataSubject?: string): string | undefined {
  if (metadataSubject && metadataSubject.length > 0) {
    return metadataSubject;
  }

  for (const line of firstPageLines.slice(1, 5)) {
    const cleaned = cleanLine(line);
    if (!cleaned) {
      continue;
    }
    if (/\b(conference|journal|symposium|workshop|university|college|laboratory|institute|department)\b/i.test(cleaned)) {
      return cleaned;
    }
  }

  return undefined;
}

function deriveOutline(headings: string[]): string[] {
  if (headings.length >= 3) {
    return headings.slice(0, 8);
  }

  const outline = [...FALLBACK_OUTLINE];
  for (let i = headings.length - 1; i >= 0 && outline.length < 8; i -= 1) {
    outline.splice(1, 0, headings[i]);
  }
  return outline.slice(0, 6);
}

function buildContentSlides(
  outline: string[],
  sentences: string[],
  targetContentSlides: number,
): SlideContent[] {
  const filteredSentences = sentences.filter((sentence) => {
    if (sentence.length < 20) {
      return false;
    }
    if (/\b(doi|copyright|license|creative commons|arxiv|email|www\.)/i.test(sentence)) {
      return false;
    }
    return true;
  });

  const effectiveSlides = Math.max(
    3,
    Math.min(targetContentSlides, Math.max(3, Math.ceil(filteredSentences.length / 3))),
  );

  const chunkSize = Math.max(1, Math.ceil(filteredSentences.length / effectiveSlides));
  const chunks: string[][] = [];

  for (let i = 0; i < filteredSentences.length; i += chunkSize) {
    chunks.push(filteredSentences.slice(i, i + chunkSize));
  }

  while (chunks.length < effectiveSlides) {
    chunks.push([]);
  }

  const sections = outline.length > 0 ? outline.slice(0, Math.min(outline.length, 6)) : FALLBACK_OUTLINE;
  const slidesPerSection = Math.max(1, Math.ceil(chunks.length / sections.length));

  const slides: SlideContent[] = [];

  chunks.forEach((chunk, index) => {
    const sectionIndex = Math.min(sections.length - 1, Math.floor(index / slidesPerSection));
    const sectionTitle = sections[sectionIndex];
    const bullets = sentencesFromChunk(chunk);

    const titleFromBullet = bullets[0]?.split('.').shift() ?? undefined;
    const slideTitle = titleFromBullet && titleFromBullet.length > 4 && titleFromBullet.length < 70
      ? titleFromBullet
      : `${sectionTitle}`;

    slides.push({
      id: `slide-${index + 1}`,
      title: slideTitle,
      section: sectionTitle,
      blocks: [
        {
          kind: 'bullets',
          items: bullets.length > 0 ? bullets : ['Key points will be refined after manual editing.'],
        },
      ],
    });
  });

  return slides;
}

function buildClosingSlide(sentences: string[]): SlideContent {
  const fallbackBullets = [
    'Revisit the problem, dataset, or theoretical gap addressed by the paper.',
    'Summarize the proposed approach and why it matters.',
    'Highlight the most important quantitative or qualitative results.',
  ];

  const meaningful = sentences.filter((sentence) => sentence.length > 20);
  const picks = [
    meaningful[0],
    meaningful[Math.floor(meaningful.length / 2)],
    meaningful[meaningful.length - 1],
  ]
    .filter(Boolean)
    .map((sentence) => truncateSentence(sentence, 140));

  const bullets = picks.length >= 2 ? picks : fallbackBullets;

  return {
    id: 'closing-slide',
    title: 'Takeaways & Next Steps',
    section: 'Conclusion',
    blocks: [
      {
        kind: 'bullets',
        items: bullets,
      },
    ],
  };
}

export function analyzePaper(
  extracted: ExtractedPdf,
  targetSlides: number,
): AnalysisResult {
  const firstPage = extracted.pageLines[0] ?? [];

  const paperTitle = deriveTitle(firstPage, extracted.metadata.title);
  const paperSubtitle = deriveSubtitle(firstPage, extracted.metadata.subject);
  const authors = deriveAuthors(firstPage, extracted.metadata.author);

  const outlineHeadings = collectHeadings(extracted.pageLines.flat());
  const outline = deriveOutline(outlineHeadings);

  const sentences = splitIntoSentences(extracted.allText);
  const targetContentSlides = Math.max(3, Math.min(targetSlides - 3, 12));

  const contentSlides = buildContentSlides(outline, sentences, targetContentSlides);
  const closingSlide = buildClosingSlide(sentences);
  const slides: SlideContent[] = [...contentSlides, closingSlide];

  const metadata: DeckMetadata = {
    paperTitle,
    paperSubtitle,
    authors,
    generatedAt: new Date().toISOString(),
    mode: 'static',
    slideCount: slides.length + 2,
  };

  return { metadata, outline, slides, sentences };
}
