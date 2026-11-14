import data from "./data/mockData.json";

export type Painting = {
  id: string;
  title: string;
  artist: string;
  displayDate: string;
  medium: string;
  theme: string;
  broadTheme: string;
  style: string;
  broadStyle: string;
  keywords: string[];
  school: string;
  imageUrl: string;
  thumbUrl: string;
};

export type Rating = { paintingId: string; rating: number };
export type CategoryGroup = "styles" | "themes" | "schools" | "artists";
export type CategoryChoice = { value: string; weight: 1 | 2 };
export type SelectedCategories = Record<CategoryGroup, CategoryChoice[]>;
export type FeatureOrigin = "selection" | "history";
export type FeatureType = "theme" | "style" | "school" | "keyword" | "artist";
export type MatchedFeature = {
  name: string;
  type: FeatureType;
  contribution: number;
  origin: FeatureOrigin;
};
export type PreferenceProfile = {
  weights: Record<string, number>;
  categoryWeights: Record<string, number>;
  historyWeights: Record<string, number>;
  history: Rating[];
  categoryFactor: number;
  historyFactor: number;
};
export type Recommendation = {
  paintingId: string;
  score: number;
  matchedFeatures: MatchedFeature[];
  mostSimilarHistoryItemId?: string;
  similarityToHistoryItem?: number;
};

/**
 * Equilibra categorias escolhidas e histórico quando ambos existem.
 * 0 usa apenas o histórico; 1 usa apenas as categorias.
 */
export const PROFILE_ALPHA = 0.5;

const paintings = data.paintings as Painting[];
const paintingMap = new Map(paintings.map((painting) => [painting.id, painting]));

const categoryLabels: Record<CategoryGroup, string> = {
  styles: "Estilo",
  themes: "Tema",
  schools: "Escola",
  artists: "Artista",
};

const dimensions = (painting: Painting) =>
  [
    `Tema: ${painting.broadTheme}`,
    `Tema: ${painting.theme}`,
    painting.broadStyle ? `Estilo: ${painting.broadStyle}` : "",
    painting.style ? `Estilo: ${painting.style}` : "",
    `Escola: ${painting.school}`,
    `Artista: ${painting.artist}`,
    ...painting.keywords.map((keyword) => `Palavra-chave: ${keyword}`),
  ].filter((feature, index, all) => Boolean(feature) && all.indexOf(feature) === index);

const featureType = (name: string): FeatureType => {
  if (name.startsWith("Tema:")) return "theme";
  if (name.startsWith("Estilo:")) return "style";
  if (name.startsWith("Escola:")) return "school";
  if (name.startsWith("Palavra-chave:")) return "keyword";
  return "artist";
};

const vectorNorm = (values: number[]) =>
  Math.sqrt(values.reduce((total, value) => total + value * value, 0));

/**
 * Recebe histórico, categorias e alpha e devolve o vetor do perfil.
 * O histórico é a média dos atributos ponderados pelas notas; as categorias
 * entram com seus pesos 1/2. Se uma das partes estiver vazia, a outra vale 100%.
 */
export function buildProfile(
  history: Rating[],
  selectedCategories: SelectedCategories,
  alpha: number,
): PreferenceProfile {
  const categoryWeights: Record<string, number> = {};
  (Object.keys(categoryLabels) as CategoryGroup[]).forEach((group) => {
    selectedCategories[group].forEach(({ value, weight }) => {
      categoryWeights[`${categoryLabels[group]}: ${value}`] = weight / 2;
    });
  });

  const historyWeights: Record<string, number> = {};
  const noteWeight: Record<number, number> = {
    1: -1,
    2: -0.5,
    3: 0,
    4: 0.5,
    5: 1,
  };
  history.forEach(({ paintingId, rating }) => {
    const painting = paintingMap.get(paintingId);
    if (!painting) return;
    dimensions(painting).forEach((feature) => {
      historyWeights[feature] =
        (historyWeights[feature] ?? 0) + noteWeight[rating] / history.length;
    });
  });

  const hasCategories = Object.keys(categoryWeights).length > 0;
  const hasHistory = history.length > 0;
  const categoryFactor = hasHistory && hasCategories ? alpha : hasCategories ? 1 : 0;
  const historyFactor = hasHistory && hasCategories ? 1 - alpha : hasHistory ? 1 : 0;
  const weights: Record<string, number> = {};
  new Set([...Object.keys(categoryWeights), ...Object.keys(historyWeights)]).forEach((feature) => {
    weights[feature] =
      (categoryWeights[feature] ?? 0) * categoryFactor +
      (historyWeights[feature] ?? 0) * historyFactor;
  });

  return {
    weights,
    categoryWeights,
    historyWeights,
    history: [...history],
    categoryFactor,
    historyFactor,
  };
}

/**
 * Recebe perfil, N e IDs excluídos e devolve recomendações por cosseno.
 * As contribuições são calculadas por origem e obras avaliadas nunca entram.
 */
export function recommend(
  profile: PreferenceProfile,
  n: number,
  excludeIds: Iterable<string>,
  diversify = false,
): Recommendation[] {
  const excluded = new Set(excludeIds);
  const profileNorm = vectorNorm(Object.values(profile.weights));
  const candidates = paintings
    .filter((painting) => !excluded.has(painting.id))
    .map((painting) => {
      const features = dimensions(painting);
      const artworkNorm = Math.sqrt(features.length);
      const dot = features.reduce((total, feature) => total + (profile.weights[feature] ?? 0), 0);
      const score =
        profileNorm && artworkNorm
          ? Math.max(0, Math.min(1, dot / (profileNorm * artworkNorm)))
          : 0;

      const matchedFeatures: MatchedFeature[] = [];
      features.forEach((name) => {
        const categoryValue = (profile.categoryWeights[name] ?? 0) * profile.categoryFactor;
        const historyValue = (profile.historyWeights[name] ?? 0) * profile.historyFactor;
        if (categoryValue > 0) {
          matchedFeatures.push({
            name,
            type: featureType(name),
            origin: "selection",
            contribution: Number((categoryValue / (profileNorm * artworkNorm)).toFixed(2)),
          });
        }
        if (historyValue > 0) {
          matchedFeatures.push({
            name,
            type: featureType(name),
            origin: "history",
            contribution: Number((historyValue / (profileNorm * artworkNorm)).toFixed(2)),
          });
        }
      });
      matchedFeatures.sort((a, b) => b.contribution - a.contribution);

      const closest = profile.history
        .map((rating) => {
          const historyPainting = paintingMap.get(rating.paintingId);
          if (!historyPainting) return null;
          const historyFeatures = dimensions(historyPainting);
          const overlap = features.filter((feature) => historyFeatures.includes(feature)).length;
          return {
            paintingId: rating.paintingId,
            similarity: overlap / Math.sqrt(features.length * historyFeatures.length),
          };
        })
        .filter((item): item is { paintingId: string; similarity: number } => Boolean(item))
        .sort((a, b) => b.similarity - a.similarity)[0];

      return {
        paintingId: painting.id,
        score: Number(score.toFixed(2)),
        matchedFeatures: matchedFeatures.slice(0, 4),
        mostSimilarHistoryItemId: closest?.paintingId,
        similarityToHistoryItem: closest ? Number(closest.similarity.toFixed(2)) : undefined,
        diversityGroup: painting.broadStyle || painting.style || painting.broadTheme,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!diversify) {
    return candidates.slice(0, n).map(({ diversityGroup: _, ...recommendation }) => recommendation);
  }

  const ordered: typeof candidates = [];
  const pool = [...candidates];
  while (pool.length && ordered.length < n) {
    const nextIndex = pool.findIndex(
      (candidate) =>
        !ordered.slice(-2).some((picked) => picked.diversityGroup === candidate.diversityGroup),
    );
    ordered.push(pool.splice(nextIndex < 0 ? 0 : nextIndex, 1)[0]);
  }
  return ordered.map(({ diversityGroup: _, ...recommendation }) => recommendation);
}

export function buildTasteProfile(profile: PreferenceProfile) {
  const positive = Object.entries(profile.weights)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(positive[0]?.[1] ?? 1, 1);
  return positive.slice(0, 5).map(([feature, weight]) => {
    const [type, ...value] = feature.split(": ");
    return { name: value.join(": "), type, weight: weight / max };
  });
}
