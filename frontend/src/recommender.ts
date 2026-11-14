export type Painting = {
  id: string;
  title: string;
  artist: string;
  year: number;
  style: string;
  museum: string;
  nationality: string;
  imageUrl: string;
};

export type Rating = { paintingId: string; rating: number };
export type MatchedFeature = { name: string; contribution: number };
export type Recommendation = {
  paintingId: string;
  score: number;
  matchedFeatures: MatchedFeature[];
  mostSimilarHistoryItemId: string;
  similarityToHistoryItem: number;
};

const dimensions = (painting: Painting) => [
  `Estilo: ${painting.style}`,
  `Artista: ${painting.artist}`,
  `Nacionalidade: ${painting.nationality}`,
  `Museu: ${painting.museum}`,
  `Período: ${Math.floor(painting.year / 100) + 1}º século`,
];

export function buildTasteProfile(paintings: Painting[], ratings: Rating[]) {
  const weights = new Map<string, number>();
  ratings.forEach(({ paintingId, rating }) => {
    const painting = paintings.find((item) => item.id === paintingId);
    if (!painting) return;
    const weight = (rating - 2.5) / 2.5;
    dimensions(painting).forEach((feature) =>
      weights.set(feature, (weights.get(feature) ?? 0) + weight),
    );
  });
  const positive = [...weights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(positive[0]?.[1] ?? 1, 1);
  return positive.slice(0, 5).map(([name, weight]) => ({
    name,
    weight: weight / max,
  }));
}

export function recommendFromRatings(
  paintings: Painting[],
  ratings: Rating[],
  diversify = false,
): Recommendation[] {
  const seen = new Set(ratings.map((rating) => rating.paintingId));
  const liked = ratings
    .filter((rating) => rating.rating >= 3)
    .map((rating) => ({
      ...rating,
      painting: paintings.find((painting) => painting.id === rating.paintingId)!,
    }))
    .filter((item) => item.painting);

  const candidates = paintings
    .filter((painting) => !seen.has(painting.id))
    .map((painting) => {
      const comparisons = liked.map((item) => {
        const shared = dimensions(painting).filter((feature) =>
          dimensions(item.painting).includes(feature),
        );
        const closeness = Math.max(0, 1 - Math.abs(painting.year - item.painting.year) / 250);
        return { item, shared, value: shared.length * 0.2 + closeness * 0.22 };
      });
      const best = comparisons.sort((a, b) => b.value - a.value)[0];
      const fallback = ratings[0]?.paintingId ?? paintings[0].id;
      const matchedFeatures = (best?.shared ?? []).slice(0, 3).map((name, index) => ({
        name,
        contribution: Number((0.28 - index * 0.06).toFixed(2)),
      }));
      if (matchedFeatures.length < 2) {
        matchedFeatures.push({
          name: `Período: proximidade cronológica`,
          contribution: 0.17,
        });
      }
      const score = Math.min(
        0.96,
        0.48 + (best?.value ?? 0) + (painting.id.charCodeAt(2) % 7) / 100,
      );
      return {
        paintingId: painting.id,
        score: Number(score.toFixed(2)),
        matchedFeatures,
        mostSimilarHistoryItemId: best?.item.paintingId ?? fallback,
        similarityToHistoryItem: Number(Math.max(0.5, score - 0.05).toFixed(2)),
        style: painting.style,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!diversify) return candidates.map(({ style: _, ...recommendation }) => recommendation);

  const ordered: typeof candidates = [];
  const pool = [...candidates];
  while (pool.length) {
    const nextIndex = pool.findIndex(
      (candidate) => !ordered.slice(-2).some((picked) => picked.style === candidate.style),
    );
    ordered.push(pool.splice(nextIndex < 0 ? 0 : nextIndex, 1)[0]);
  }
  return ordered.map(({ style: _, ...recommendation }) => recommendation);
}
