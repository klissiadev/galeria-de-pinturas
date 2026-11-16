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