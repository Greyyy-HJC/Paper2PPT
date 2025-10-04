export const DEFAULT_LLM_PROMPT = `You are preparing a concise yet informative academic Beamer presentation.
For each section summarize:
1. The research question or motivation and why it matters.
2. The core method or theory, defining key terminology in simple language when first introduced.
3. The experimental setup or evaluation protocol, highlighting datasets, metrics, and baselines.
4. The most important quantitative or qualitative findings, including numbers when available.
5. Limitations, open problems, or future work the authors mention or imply.
6. Practical implications or real-world impact if clear.

Slide formatting requirements:
- 3–5 bullet points per slide, each under 24 words, written as direct takeaways (no trailing punctuation, no numbering).
- Optional speaker notes should provide extra explanation or transitions, up to 3 sentences.
- Prefer plain text; include LaTeX math only if necessary and wrap it in $...$.
- Use short titles (<60 characters) and avoid repeating the parent section name in the title if possible.
- If the paper introduces novel terminology, briefly define it in the bullet where it first appears.
- Maintain chronological narrative: motivation → method → experiments → results → discussion → conclusion.
`;
