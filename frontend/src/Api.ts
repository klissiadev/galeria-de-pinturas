import type {
  CategoryGroup,
  EvaluationData,
  FeatureType,
  MatchedFeature,
  Painting,
  QualitativeCase,
  Rating,
  Recommendation,
  SelectedCategories,
  TasteItem,
  UserSummary,
} from "./Types";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Obras já recebidas da API (histórico e recomendações), consultadas pelos componentes. */
export const paintingCache = new Map<string, Painting>();

// ---------- formatos da API ----------
type ApiPainting = {
  id: string;
  title: string;
  artist: string;
  date: string;
  medium: string;
  theme: string;
  style: string;
  keywords: string;
  school: string;
  url: string;
  thumbnail: string;
};
type ApiHistoryItem = ApiPainting & { rating: number };
type ApiRecommendation = {
  painting_id: string;
  score: number;
  painting: ApiPainting;
  matched_features: MatchedFeature[];
  most_similar_history_item_id: string | null;
  similarity_to_history_item: number | null;
};

const terms = (text: string) =>
  (text ?? "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

function toPainting(p: ApiPainting): Painting {
  const themes = terms(p.theme);
  const styles = terms(p.style);
  const painting: Painting = {
    id: String(p.id),
    title: p.title,
    artist: p.artist,
    displayDate: p.date,
    medium: p.medium,
    broadTheme: themes[0] ?? "",
    theme: themes.slice(1).join(", "),
    broadStyle: styles[0] ?? "",
    style: styles.join(", "),
    keywords: terms(p.keywords),
    school: p.school,
    imageUrl: p.url,
    thumbUrl: p.thumbnail || p.url,
  };
  paintingCache.set(painting.id, painting);
  return painting;
}

const TYPE_LABEL: Record<FeatureType, string> = {
  theme: "Tema",
  style: "Estilo",
  school: "Escola",
  keyword: "Palavra-chave",
  artist: "Artista",
};

// ---------- HTTP ----------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(`Não foi possível conectar à API (${API_URL}). Ela está no ar?`);
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* corpo sem JSON */
    }
    throw new Error(`${response.status}: ${detail}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const enc = encodeURIComponent;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// ---------- endpoints ----------
export const api = {
  async listUsers(): Promise<UserSummary[]> {
    const users = await request<{ id: string; username: string }[]>("/users/?limit=500");
    return users.map((u) => ({ id: u.id, name: u.username }));
  },

  async getUser(id: string): Promise<{ id: string; name: string; categories: SelectedCategories }> {
    const u = await request<{ id: string; username: string; categories: SelectedCategories }>(`/users/${enc(id)}`);
    return { id: u.id, name: u.username, categories: u.categories };
  },

  /** Histórico de avaliações (mais recentes primeiro); também alimenta o cache de obras. */
  async history(id: string): Promise<Rating[]> {
    const items = await request<ApiHistoryItem[]>(`/users/${enc(id)}/history`);
    return items.map((item) => {
      const painting = toPainting(item);
      return { paintingId: painting.id, rating: item.rating };
    });
  },

  categories: () =>
    request<Record<CategoryGroup, string[]>>("/categories/?limit=40&artists_limit=50"),

  searchArtists: (q: string) => request<string[]>(`/categories/artists?q=${enc(q)}&limit=5`),

  async createProfile(name: string, categories: SelectedCategories): Promise<{ id: string }> {
    return request<{ id: string }>("/users/profiles", json("POST", { username: name, categories }));
  },

  deleteUser: (id: string) => request<void>(`/users/${enc(id)}`, { method: "DELETE" }),

  putCategories: (id: string, categories: SelectedCategories) =>
    request<SelectedCategories>(`/users/${enc(id)}/categories`, json("PUT", categories)),

  putRating: (id: string, paintingId: string, rating: number) =>
    request<unknown>(`/users/${enc(id)}/ratings/${enc(paintingId)}`, json("PUT", { rating })),

  deleteRating: (id: string, paintingId: string) =>
    request<void>(`/users/${enc(id)}/ratings/${enc(paintingId)}`, { method: "DELETE" }),

  async recommendations(id: string, n: number, diversify: boolean): Promise<Recommendation[]> {
    const recs = await request<ApiRecommendation[]>(
      `/users/${enc(id)}/recommendations?n=${n}&diversify=${diversify}`,
    );
    return recs.map((r) => {
      const painting = toPainting(r.painting);
      return {
        paintingId: painting.id,
        score: r.score,
        matchedFeatures: r.matched_features,
        mostSimilarHistoryItemId: r.most_similar_history_item_id ?? undefined,
        similarityToHistoryItem: r.similarity_to_history_item ?? undefined,
      };
    });
  },

  async tasteProfile(id: string): Promise<TasteItem[]> {
    const items = await request<{ name: string; type: FeatureType; weight: number }[]>(
      `/users/${enc(id)}/taste-profile`,
    );
    return items.map((item) => ({ ...item, type: TYPE_LABEL[item.type] ?? item.type }));
  },

  async previewTaste(categories: SelectedCategories): Promise<TasteItem[]> {
    const items = await request<{ name: string; type: FeatureType; weight: number }[]>(
      "/users/taste-profile-preview",
      json("POST", categories),
    );
    return items.map((item) => ({ ...item, type: TYPE_LABEL[item.type] ?? item.type }));
  },

  getEvaluationMetrics: () => request<EvaluationData>("/evaluation/metrics"),

  getQualitativeCases: () => request<QualitativeCase[]>("/evaluation/qualitative"),

  runEvaluation: (params?: { seed?: number; min_ratings?: number }) =>
    request<EvaluationData>("/evaluation/run", json("POST", params ?? {})),
};