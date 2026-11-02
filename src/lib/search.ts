export function searchScore(text: string, query: string): number {
  const target = text.toLocaleLowerCase('zh-CN');
  const tokens = query.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
  if (!tokens.length) return 1;
  let score = 0;
  for (const token of tokens) {
    const index = target.indexOf(token);
    if (index >= 0) { score += index === 0 ? 100 : 70 - Math.min(index, 40); continue; }
    // English fuzzy subsequences; Chinese uses predictable substring matches.
    if (!/^[a-z0-9]+$/.test(token)) return 0;
    let cursor = 0;
    for (const char of token) { const at = target.indexOf(char, cursor); if (at < 0) return 0; cursor = at + 1; }
    score += 10;
  }
  return score;
}
export const matchesSearch = (text: string, query: string) => searchScore(text, query) > 0;
