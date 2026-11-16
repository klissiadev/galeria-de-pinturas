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
export type Recommendation = {
  paintingId: string;
  score: number;
  matchedFeatures: MatchedFeature[];
  mostSimilarHistoryItemId?: string;
  similarityToHistoryItem?: number;
};
export type UserSummary = { id: string; name: string };
export type TasteItem = { name: string; type: string; weight: number };

// ---------- Tipos para Avaliação Experimental e Métricas ----------
export type ModelMetrics = {
  "precision@5": number;
  "recall@5": number;
  "ndcg@5": number;
  "coverage@5": number;
  "diversity@5": number;
  "novelty@5": number;
  "precision@10": number;
  "recall@10": number;
  "ndcg@10": number;
  "coverage@10": number;
  "diversity@10": number;
  "novelty@10": number;
};

export type ModelEvaluation = {
  label: string;
  metrics: ModelMetrics;
};

export type EvaluationMetadata = {
  num_users_evaluated: number;
  num_total_paintings: number;
  relevance_threshold: number;
  test_ratio: number;
  seed: number;
};

export type EvaluationData = {
  metadata: EvaluationMetadata;
  models: Record<string, ModelEvaluation>;
};

export type QualitativePainting = {
  id: string;
  title: string;
  artist: string;
  date?: string;
  medium?: string;
  theme?: string;
  style?: string;
  keywords?: string;
  school?: string;
  url?: string;
  thumbnail?: string;
};

export type QualitativeCase = {
  case_type: string;
  title: string;
  description: string;
  user_id: string;
  is_error: boolean;
  train_sample: { id: string; rating: number; painting: QualitativePainting }[];
  test_set: { id: string; rating: number; painting: QualitativePainting }[];
  recommendations: {
    id: string;
    painting: QualitativePainting;
    is_hit: boolean;
    test_rating?: number;
  }[];
  metrics: {
    precision_at_5: number;
    recall_at_5: number;
  };
};
