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

function stripSectionNumber(value: string): string {
  return value.replace(/^\d+(?:\.\d+)*\s+/, '');
}

function normalizeHeadingKey(value: string): string {
  return stripSectionNumber(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function uniqueSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(sentence);
  }
  return result;
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

function filterGeneralSentences(sentences: string[]): string[] {
  return sentences
    .map((sentence) => truncateSentence(sentence, 160))
    .filter((sentence) => {
      if (sentence.length < 25) {
        return false;
      }
      if (/\b(doi|copyright|license|creative commons|arxiv|email|www\.)/i.test(sentence)) {
        return false;
      }
      return true;
    });
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

function collectSectionDrafts(
  extracted: ExtractedPdf,
  outline: string[],
): {
  sectionBullets: Map<string, string[]>;
  abstractBullets: string[];
  keywordBullets: string[];
} {
  const normalizedHeadingMap = new Map<string, string>();
  outline.forEach((heading) => {
    const key = normalizeHeadingKey(heading);
    if (key.length > 0 && !normalizedHeadingMap.has(key)) {
      normalizedHeadingMap.set(key, heading);
    }
  });

  const sectionLines = new Map<string, string[]>();
  const abstractLines: string[] = [];
  const keywordLines: string[] = [];

  const pushSectionLine = (heading: string, line: string) => {
    if (!sectionLines.has(heading)) {
      sectionLines.set(heading, []);
    }
    sectionLines.get(heading)!.push(line);
  };

  let currentHeading: string | null = null;

  for (const page of extracted.pageLines) {
    for (const rawLine of page) {
      const trimmed = cleanLine(rawLine);
      if (!trimmed) {
        continue;
      }

      const stripped = stripSectionNumber(trimmed);
      const normalized = normalizeHeadingKey(stripped);

      if (normalized === 'abstract') {
        currentHeading = 'Abstract';
        continue;
      }

      if (normalized === 'keywords') {
        currentHeading = 'Keywords';
        continue;
      }

      let matchedHeading = normalizedHeadingMap.get(normalized);
      if (!matchedHeading && normalized.length > 0) {
        for (const [key, value] of Array.from(normalizedHeadingMap.entries())) {
          if (normalized.startsWith(key) || key.startsWith(normalized)) {
            matchedHeading = value;
            break;
          }
        }
      }

      if (matchedHeading) {
        currentHeading = matchedHeading;
        continue;
      }

      if (currentHeading === 'Abstract') {
        abstractLines.push(trimmed);
        continue;
      }

      if (currentHeading === 'Keywords') {
        keywordLines.push(trimmed);
        continue;
      }

      if (currentHeading) {
        pushSectionLine(currentHeading, trimmed);
      }
    }
  }

  const sectionBullets = new Map<string, string[]>();
  for (const [heading, lines] of Array.from(sectionLines.entries())) {
    const sentences = uniqueSentences(splitIntoSentences(lines.join(' ')))
      .map((sentence) => truncateSentence(sentence, 150))
      .filter((sentence) => sentence.length > 20)
      .slice(0, 5);
    if (sentences.length > 0) {
      sectionBullets.set(heading, sentences);
    }
  }

  const abstractBullets = abstractLines.length > 0
    ? uniqueSentences(splitIntoSentences(abstractLines.join(' ')))
        .map((sentence) => truncateSentence(sentence, 150))
        .filter((sentence) => sentence.length > 20)
        .slice(0, 5)
    : [];

  let keywordSource = '';
  if (keywordLines.length > 0) {
    keywordSource = keywordLines.join(' ');
  }
  if (!keywordSource && extracted.pageLines[0]) {
    for (const rawLine of extracted.pageLines[0]) {
      const match = rawLine.match(/keywords?[:\-]?\s*(.*)/i);
      if (match && match[1]) {
        keywordSource = match[1];
        break;
      }
    }
  }

  const keywordBullets = keywordSource
    ? keywordSource
        .split(/[,;•]/)
        .map((token) => cleanLine(token))
        .filter((token) => token.length > 2 && token.length <= 60)
        .slice(0, 6)
    : [];

  return { sectionBullets, abstractBullets, keywordBullets };
}

function deriveAuthorBullets(firstPageLines: string[], metadataAuthor?: string): string[] {
  const names = new Set<string>();
  const affiliations = new Set<string>();

  const pushName = (value: string) => {
    const cleaned = cleanLine(value);
    if (cleaned.length > 1 && cleaned.length <= 80) {
      names.add(cleaned);
    }
  };

  const splitAuthorString = (value: string) => {
    value.split(/,|;| and /i)
      .map((part) => cleanLine(part))
      .filter((part) => part.length > 1 && part.length <= 80 && !/@/.test(part))
      .forEach((part) => pushName(part));
  };

  if (metadataAuthor) {
    splitAuthorString(metadataAuthor);
  }

  const linesToInspect = firstPageLines.slice(0, 12);
  const affiliationRegex = /(university|institute|department|school|laboratory|centre|center|college|academy)/i;

  for (const rawLine of linesToInspect) {
    const cleaned = cleanLine(rawLine);
    if (!cleaned || cleaned.length > 120) {
      continue;
    }
    if (/abstract|keywords?/i.test(cleaned)) {
      continue;
    }
    if (/@/.test(cleaned)) {
      continue;
    }
    if (affiliationRegex.test(cleaned)) {
      affiliations.add(cleaned);
      continue;
    }
    if (/,| and |;/i.test(cleaned) || /^[A-Z][A-Za-z\-\. ]{3,}$/.test(cleaned)) {
      splitAuthorString(cleaned);
    }
  }

  const bullets: string[] = [];
  names.forEach((name) => bullets.push(`Author: ${name}`));
  affiliations.forEach((aff) => bullets.push(`Affiliation: ${aff}`));

  return bullets.slice(0, 6);
}

function extractAbstractBullets(
  draftBullets: string[],
  sentences: string[],
): string[] {
  if (draftBullets.length > 0) {
    return draftBullets.slice(0, 5);
  }
  return filterGeneralSentences(sentences).slice(0, 4);
}

function takeMatchingFromQueue(keyword: string, queue: string[], count: number): string[] {
  const lowerKeyword = keyword.toLowerCase();
  const picked: string[] = [];
  let index = 0;
  while (index < queue.length && picked.length < count) {
    if (queue[index].toLowerCase().includes(lowerKeyword)) {
      picked.push(queue.splice(index, 1)[0]);
      continue;
    }
    index += 1;
  }
  if (picked.length < count) {
    picked.push(...queue.splice(0, Math.max(0, count - picked.length)));
  }
  return picked;
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
  const generalSentenceQueue = filterGeneralSentences(sentences);

  const { sectionBullets, abstractBullets, keywordBullets } = collectSectionDrafts(extracted, outline);
  const authorBullets = deriveAuthorBullets(firstPage, authors);
  const abstractSlideBullets = extractAbstractBullets(abstractBullets, sentences);

  const slides: SlideContent[] = [];

  if (authorBullets.length > 0) {
    slides.push({
      id: 'authors-slide',
      title: '作者与机构',
      section: 'Introduction',
      subsection: '作者与机构',
      blocks: [
        {
          kind: 'bullets',
          items: authorBullets,
        },
      ],
    });
  }

  if (keywordBullets.length > 0) {
    slides.push({
      id: 'keywords-slide',
      title: '关键术语',
      section: 'Introduction',
      subsection: '关键术语',
      blocks: [
        {
          kind: 'bullets',
          items: keywordBullets,
        },
      ],
    });
  }

  if (abstractSlideBullets.length > 0) {
    slides.push({
      id: 'abstract-slide',
      title: '摘要概览',
      section: 'Introduction',
      subsection: '摘要概览',
      blocks: [
        {
          kind: 'bullets',
          items: abstractSlideBullets.slice(0, 4),
        },
      ],
    });

    abstractSlideBullets.forEach((item) => {
      const idx = generalSentenceQueue.findIndex((sentence) => sentence === item);
      if (idx >= 0) {
        generalSentenceQueue.splice(idx, 1);
      }
    });
  }

  const maxContentSlides = Math.max(3, Math.min(targetSlides - 2, 15));
  const availableCoreSlots = Math.max(1, maxContentSlides - 1);
  if (slides.length > availableCoreSlots) {
    slides.splice(availableCoreSlots);
  }
  const remainingSectionSlots = Math.max(0, availableCoreSlots - slides.length);
  const sectionHeadings = outline.length > 0
    ? outline.slice(0, Math.min(outline.length, remainingSectionSlots))
    : FALLBACK_OUTLINE.slice(0, remainingSectionSlots);

  sectionHeadings.forEach((heading, index) => {
    const draftBullets = sectionBullets.get(heading) ?? [];
    const items = draftBullets.length > 0
      ? draftBullets.slice(0, 4)
      : takeMatchingFromQueue(heading, generalSentenceQueue, 4);
    const cleanedItems = items.length > 0
      ? items.map((item) => truncateSentence(item, 150))
      : ['(内容待补充)'];

    slides.push({
      id: `section-${index + 1}`,
      title: heading,
      section: heading,
      subsection: heading,
      blocks: [
        {
          kind: 'bullets',
          items: cleanedItems,
        },
      ],
    });
  });

  while (slides.length < availableCoreSlots && generalSentenceQueue.length > 0) {
    const items = generalSentenceQueue.splice(0, 4);
    if (items.length === 0) {
      break;
    }
    slides.push({
      id: `filler-${slides.length + 1}`,
      title: '更多要点',
      section: 'Discussion',
      subsection: '更多要点',
      blocks: [
        {
          kind: 'bullets',
          items,
        },
      ],
    });
  }

  while (slides.length < availableCoreSlots) {
    slides.push({
      id: `placeholder-${slides.length + 1}`,
      title: '内容待补充',
      section: 'Discussion',
      subsection: '内容待补充',
      blocks: [
        {
          kind: 'bullets',
          items: ['(手动补充关键要点)'],
        },
      ],
    });
  }

  const closingSlide = buildClosingSlide(sentences);
  const contentSlides = [...slides, closingSlide];

  if (contentSlides.length > maxContentSlides) {
    contentSlides.splice(maxContentSlides);
  }

  const metadata: DeckMetadata = {
    paperTitle,
    paperSubtitle,
    authors,
    generatedAt: new Date().toISOString(),
    mode: 'static',
    slideCount: contentSlides.length + 2,
  };

  return { metadata, outline, slides: contentSlides, sentences };
}
