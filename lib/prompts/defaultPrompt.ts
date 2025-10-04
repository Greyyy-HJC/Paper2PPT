export const DEFAULT_LLM_PROMPT = `Structure the deck into the following thematic order and only create additional slides when strictly necessary:
1. Motivation
2. Method
3. Experiments
4. Results
5. Discussion
6. Conclusion

When producing the JSON response:
- Set the "section" field to one of the headings above in the same order.
- For every slide provide a "subsection" string; this will become a LaTeX \\subsection{}.
- Each slide must contain 4–6 bullet points that capture concrete technical details (datasets, metrics, numerical values, qualitative observations, limitations, implications, etc.).
- Bullets should be declarative sentences under 26 words, without trailing punctuation or numbering, and use active voice.
- Define new terminology or abbreviations the first time they appear.
- Add up to 3 sentences of speaker notes when they help explain transitions or interpret results.
- Respect the requested slide count exactly (excluding title and agenda frames). If information is sparse, merge concepts rather than invent content.
- Prefer plain text. Use inline LaTeX math $...$ only when formulas or symbols are essential.
- Highlight limitations or future work explicitly in the Discussion slide and summarise actionable insights in the Conclusion slide.
`;
