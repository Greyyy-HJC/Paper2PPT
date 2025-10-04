import type { SlideContent } from '../types';
import type { FigureSummary } from './analyzer';

export interface FigureAssetDescriptor {
  id: string;
  filename: string;
  caption?: string;
}

function defaultTitle(index: number): string {
  return `图示 ${index + 1}`;
}

function normalizeCaption(caption?: string): string | undefined {
  if (!caption) {
    return undefined;
  }
  const trimmed = caption.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function applyFigureAssetsToSlides(
  slides: SlideContent[],
  figures: FigureAssetDescriptor[],
): SlideContent[] {
  const mutableSlides = [...slides];

  figures.forEach((figure, index) => {
    const caption = normalizeCaption(figure.caption);
    const imageBlock = {
      kind: 'image' as const,
      path: `figuras/${figure.filename}`,
      caption,
    };

    const slideIndex = mutableSlides.findIndex((slide) => slide.id === figure.id);
    if (slideIndex >= 0) {
      mutableSlides[slideIndex] = {
        ...mutableSlides[slideIndex],
        blocks: [imageBlock],
        section: mutableSlides[slideIndex].section ?? 'Figures',
        subsection: mutableSlides[slideIndex].subsection ?? (caption ?? defaultTitle(index)),
      };
      return;
    }

    mutableSlides.push({
      id: figure.id,
      title: caption ?? defaultTitle(index),
      section: 'Figures',
      subsection: caption ?? defaultTitle(index),
      blocks: [imageBlock],
    });
  });

  return mutableSlides;
}

export function summariesToDescriptors(
  summaries: FigureSummary[] | undefined,
): FigureAssetDescriptor[] {
  if (!summaries) {
    return [];
  }
  return summaries
    .filter((summary) => typeof summary.filename === 'string')
    .map((summary) => ({
      id: summary.id,
      filename: summary.filename as string,
      caption: summary.caption,
    }));
}
