// Minimal implementations to support matching without external deps

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function buildTrigrams(text: string): Set<string> {
  const s = `  ${text.toLowerCase()}  `;
  const trigrams = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) {
    trigrams.add(s.slice(i, i + 3));
  }
  return trigrams;
}

export function calculateTrigramSimilarity(aTexts: string[], bTexts: string[]): number {
  const aJoined = (aTexts || []).join(' ');
  const bJoined = (bTexts || []).join(' ');
  const aTri = buildTrigrams(aJoined);
  const bTri = buildTrigrams(bJoined);
  if (aTri.size === 0 && bTri.size === 0) return 0;
  let inter = 0;
  for (const t of aTri) if (bTri.has(t)) inter++;
  const union = aTri.size + bTri.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function calculateJaccardSimilarity(aTexts: string[], bTexts: string[]): number {
  const aTokens = new Set<string>((aTexts || []).flatMap(tokenize));
  const bTokens = new Set<string>((bTexts || []).flatMap(tokenize));
  if (aTokens.size === 0 && bTokens.size === 0) return 0;
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  const union = aTokens.size + bTokens.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function calculateVectorSimilarity(aTexts: string[], bTexts: string[]): Promise<number> {
  // Simple TF-based cosine similarity
  const tokens = [...new Set([...(aTexts || []).flatMap(tokenize), ...(bTexts || []).flatMap(tokenize)])];
  if (tokens.length === 0) return 0;
  const aVec = new Array(tokens.length).fill(0);
  const bVec = new Array(tokens.length).fill(0);
  const aAll = (aTexts || []).flatMap(tokenize);
  const bAll = (bTexts || []).flatMap(tokenize);
  tokens.forEach((t, i) => {
    aVec[i] = aAll.filter(x => x === t).length;
    bVec[i] = bAll.filter(x => x === t).length;
  });
  const dot = aVec.reduce((s, v, i) => s + v * bVec[i], 0);
  const normA = Math.sqrt(aVec.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(bVec.reduce((s, v) => s + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export function calculateHybridScore(trigram: number, jaccard: number, vector: number): number {
  // Simple weighted blend
  const wTri = 0.4;
  const wJac = 0.3;
  const wVec = 0.3;
  return wTri * trigram + wJac * jaccard + wVec * vector;
}

export function determineConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}


