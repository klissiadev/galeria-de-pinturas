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
  selectionWeights: Record<string, number>;
  ratingWeights: Record<string, number>;
  ratings: Rating[];
};
export type Recommendation = {
  paintingId: string;
  score: number;
  matchedFeatures: MatchedFeature[];
  mostSimilarHistoryItemId?: string;
  similarityToHistoryItem?: number;
};

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

const combinedWeights = (profile: PreferenceProfile) => {
  const combined: Record<string, number> = { ...profile.selectionWeights };
  Object.entries(profile.ratingWeights).forEach(([feature, weight]) => {
    combined[feature] = (combined[feature] ?? 0) + weight;
  });
  return combined;
};

/**
 * Recebe as categorias escolhidas no cold start e devolve um perfil vetorial
 * inicial, preservando os pesos 1 ("Gosto") e 2 ("Gosto muito").
 */
export function buildInitialProfile(selectedCategories: SelectedCategories): PreferenceProfile {
  const selectionWeights: Record<string, number> = {};
  (Object.keys(categoryLabels) as CategoryGroup[]).forEach((group) => {
    selectedCategories[group].forEach(({ value, weight }) => {
      selectionWeights[`${categoryLabels[group]}: ${value}`] = weight;
    });
  });
  return { selectionWeights, ratingWeights: {}, ratings: [] };
}

/**
 * Recebe um perfil inicial e avaliações por estrelas, e devolve um novo perfil:
 * notas altas somam e notas baixas subtraem os atributos das obras avaliadas.
 */
export function updateProfileWithRatings(
  profile: PreferenceProfile,
  ratings: Rating[],
  paintings: Painting[],
): PreferenceProfile {
  const ratingWeights: Record<string, number> = {};
  const ratingImpact: Record<number, number> = {
    1: -1.2,
    2: -0.65,
    3: 0.2,
    4: 0.8,
    5: 1.35,
  };
  ratings.forEach(({ paintingId, rating }) => {
    const painting = paintings.find((item) => item.id === paintingId);
    if (!painting) return;
    dimensions(painting).forEach((feature) => {
      ratingWeights[feature] = (ratingWeights[feature] ?? 0) + ratingImpact[rating];
    });
  });
  return { ...profile, ratingWeights, ratings: [...ratings] };
}

/**
 * Recebe um perfil vetorial e N, calcula cosseno contra cada obra não avaliada
 * e devolve até N recomendações ordenadas, com contribuições e suas origens.
 */
export function recommend(
  profile: PreferenceProfile,
  n: number,
  paintings: Painting[],
  diversify = false,
): Recommendation[] {
  const weights = combinedWeights(profile);
  const profileNorm = vectorNorm(Object.values(weights));
  const seen = new Set(profile.ratings.map((rating) => rating.paintingId));
  const likedHistory = profile.ratings.filter((rating) => rating.rating >= 3);

  const candidates = paintings
    .filter((painting) => !seen.has(painting.id))
    .map((painting) => {
      const features = dimensions(painting);
      const artworkNorm = Math.sqrt(features.length);
      const dot = features.reduce((total, feature) => total + (weights[feature] ?? 0), 0);
      const score =
        profileNorm && artworkNorm
          ? Math.max(0, Math.min(1, dot / (profileNorm * artworkNorm)))
          : 0;

      const matchedFeatures: MatchedFeature[] = [];
      features.forEach((name) => {
        const selectionValue = profile.selectionWeights[name] ?? 0;
        const historyValue = profile.ratingWeights[name] ?? 0;
        if (selectionValue > 0) {
          matchedFeatures.push({
            name,
            type: featureType(name),
            origin: "selection",
            contribution: Number((selectionValue / (profileNorm * artworkNorm)).toFixed(2)),
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

      const closest = likedHistory
        .map((rating) => {
          const historyPainting = paintings.find((item) => item.id === rating.paintingId);
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
        style: painting.broadStyle || painting.style || painting.broadTheme,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!diversify) {
    return candidates.slice(0, n).map(({ style: _, ...recommendation }) => recommendation);
  }

  const ordered: typeof candidates = [];
  const pool = [...candidates];
  while (pool.length && ordered.length < n) {
    const nextIndex = pool.findIndex(
      (candidate) => !ordered.slice(-2).some((picked) => picked.style === candidate.style),
    );
    ordered.push(pool.splice(nextIndex < 0 ? 0 : nextIndex, 1)[0]);
  }
  return ordered.map(({ style: _, ...recommendation }) => recommendation);
}

export function buildTasteProfile(profile: PreferenceProfile) {
  const positive = Object.entries(combinedWeights(profile))
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(positive[0]?.[1] ?? 1, 1);
  return positive.slice(0, 5).map(([feature, weight]) => {
    const [type, ...value] = feature.split(": ");
    return {
      name: value.join(": "),
      type,
      weight: weight / max,
    };
  });
}

export function recommendFromRatings(
  paintings: Painting[],
  ratings: Rating[],
  diversify = false,
): Recommendation[] {
  const empty: SelectedCategories = {
    styles: [],
    themes: [],
    schools: [],
    artists: [],
  };
  const profile = updateProfileWithRatings(buildInitialProfile(empty), ratings, paintings);
  return recommend(profile, paintings.length, paintings, diversify);
}
