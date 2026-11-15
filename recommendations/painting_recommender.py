from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DEFAULT_COLUMNS = ("tdfidf_text",)
PAINTINGS_CSV = "data/dataset/paintings.csv"


class PaintingRecommender:

    def __init__(self, painting_df: pd.DataFrame, liked_threshold: int = 4):
        self.painting_df = painting_df.drop_duplicates("id").reset_index(drop=True)
        self.painting_df["id"] = self.painting_df["id"].astype(str)
        self.ids = self.painting_df["id"].to_numpy()
        self.pos = {pid: i for i, pid in enumerate(self.ids)}
        self.liked_threshold = liked_threshold
        self._matrices = {}                     

    def _matrix(self, columns):
        columns = tuple(columns)
        if columns not in self._matrices:
            missing = [c for c in columns if c not in self.painting_df.columns]
            if missing:
                raise ValueError(f"Unknown columns: {missing}")
            text = self.painting_df[list(columns)].agg(" ".join, axis=1)
            self._matrices[columns] = TfidfVectorizer(
                stop_words="english").fit_transform(text)
        return self._matrices[columns]

    def _similar(self, painting_id, exclude, n, columns):
        if painting_id not in self.pos:
            return []
        matrix = self._matrix(columns)
        scores = cosine_similarity(matrix[self.pos[painting_id]], matrix).ravel()
        result = []
        for j in np.argsort(-scores, kind="stable"):
            if self.ids[j] in exclude or scores[j] <= 0:
                continue
            result.append((self.ids[j], float(scores[j])))
            if len(result) == n:
                break
        return result

    def recommend_for_target(self, painting_id, n=10, columns=DEFAULT_COLUMNS):
        similar = self._similar(painting_id, {painting_id}, n, columns)
        return self._to_frame([(pid, s, painting_id) for pid, s in similar])

    def recommend_for_user(self, ratings_df, user_id, n_seeds=5, per_seed=3,
                           columns=DEFAULT_COLUMNS):
        history = ratings_df[ratings_df["user_id"] == user_id]
        if "date" in history.columns:
            history = history.sort_values("date", kind="stable")
        seen = set(history["painting_id"])

        liked = history[history["rating"] >= self.liked_threshold]
        seeds = liked["painting_id"].tail(n_seeds).iloc[::-1]

        exclude, items = set(seen), []
        for seed in seeds:
            for pid, score in self._similar(seed, exclude, per_seed, columns):
                items.append((pid, score, seed))
                exclude.add(pid)
        return self._to_frame(items)

    def get_paintings(self, ids):
        frame = self.painting_df.set_index("id").reindex(list(ids)).dropna(how="all")
        return frame.reset_index()
    
    def _to_frame(self, items):
        if not items:
            return pd.DataFrame()
        ids, scores, seeds = zip(*items)
        frame = self.painting_df.set_index("id").loc[list(ids)].reset_index()
        frame["score"] = scores
        frame["seed_painting_id"] = seeds
        return frame

COLUMN_MAP = {
    "ObjectID": "id", "Title": "title", "Artist": "artist", "Date": "date",
    "Medium": "medium", "Theme": "theme", "Style": "style", "Keywords": "keywords",
    "School": "school", "Nationality": "nationality", "URL": "url",
    "Thumb": "thumbnail", "TFIDF_Text": "tdfidf_text",
}


@lru_cache(maxsize=1)
def load_paintings() -> pd.DataFrame:
    df = pd.read_csv(PAINTINGS_CSV).rename(columns=COLUMN_MAP)
    df["id"] = df["id"].astype(str)
    other = [c for c in df.columns if c != "id"]
    df[other] = df[other].fillna("").astype(str)   
    return df.drop_duplicates("id").reset_index(drop=True)


@lru_cache(maxsize=1)
def get_recommender() -> PaintingRecommender:
    return PaintingRecommender(load_paintings())