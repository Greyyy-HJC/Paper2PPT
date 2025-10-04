export type SlideBlock =
  | {
      kind: 'bullets';
      items: string[];
    }
  | {
      kind: 'paragraph';
      text: string;
    }
  | {
      kind: 'quote';
      text: string;
    }
  | {
      kind: 'image';
      path: string;
      caption?: string;
      width?: string;
    };

export interface SlideContent {
  id: string;
  title: string;
  blocks: SlideBlock[];
  section?: string;
  subsection?: string;
  notes?: string;
}

export interface DeckMetadata {
  paperTitle: string;
  paperSubtitle?: string;
  authors?: string;
  venue?: string;
  generatedAt: string;
  mode: 'static' | 'llm';
  slideCount: number;
}

export interface GeneratedDeck {
  metadata: DeckMetadata;
  slides: SlideContent[];
  outline: string[];
  latexSource: string;
}

export interface GenerateRequestOptions {
  targetSlides?: number;
  mode: 'static' | 'llm';
  provider?: 'openai' | 'azure' | 'anthropic' | 'deepseek' | 'custom';
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
  prompt?: string;
}
