from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 30)
pd.set_option("display.max_colwidth", 45)

SCRIPT_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = SCRIPT_DIR / "data" / "dataset"


def compute_rating_stats(user_df: pd.DataFrame) -> pd.DataFrame:
    stats = user_df.groupby("painting_id")["rating"].agg(["mean", "count"])
    return stats.rename(columns={"mean": "avg_rating", "count": "n_ratings"})


class PaintingRecommender:

    def __init__(self, user_df: pd.DataFrame, painting_df: pd.DataFrame,
                 text_col: str = "Style", liked_threshold: int = 4):
        self.user_df = user_df.copy()
        self.painting_df = (painting_df.rename(columns={"ObjectID": "id"})
                            .drop_duplicates("id").reset_index(drop=True))
        self.all_painting_ids = self.painting_df["id"].unique()
        self.pos = {pid: i for i, pid in enumerate(self.painting_df["id"])}
        self.text_col = text_col
        self.liked_threshold = liked_threshold

        self.rating_stats = compute_rating_stats(self.user_df)
        self._build_tfidf()
        self._refresh_popularity()
        self._build_index()

    def _build_tfidf(self) -> None:
        self.tfidf = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = self.tfidf.fit_transform(
            self.painting_df[self.text_col].fillna(""))

    def _to_frame(self, ids, predicted: dict | None = None) -> pd.DataFrame:
        cols = ["id", "Title", "Artist", "Date", "Style", "Theme", "URL", "Thumb"]
        cols = [c for c in cols if c in self.painting_df.columns]
        frame = self.painting_df.set_index("id", drop=False).loc[list(ids), cols]
        frame = frame.reset_index(drop=True)
        frame["painting_id"] = frame["id"]          # compatibilidade com o código antigo
        frame = frame.merge(self.rating_stats, left_on="id", right_index=True, how="left")
        if predicted is not None:
            frame["predicted_rating"] = [round(float(predicted[i]), 2) for i in frame["id"]]
        return frame

    def _compute_weighted_scores(self) -> pd.DataFrame:
        stats = self.user_df.groupby("painting_id")["rating"].agg(["mean", "count"])
        c = stats["count"].mean()
        m = stats["mean"].mean()
        stats["weighted_score"] = (
            (stats["count"] / (stats["count"] + c)) * stats["mean"]
            + (c / (stats["count"] + c)) * m
        )
        return stats

    def _refresh_popularity(self) -> None:
        self._stats = self._compute_weighted_scores()
        self.popular_painting_ids = (
            self._stats.sort_values("weighted_score", ascending=False).index.tolist()
        )

    def _build_index(self) -> None:
        self.users = {}
        self.item_users = {}
        for u, p, s in zip(self.user_df["user_id"], self.user_df["painting_id"],
                           self.user_df["rating"]):
            self.users.setdefault(u, {})[p] = s
            self.item_users.setdefault(p, set()).add(u)

    def _user_scores(self, user_id) -> np.ndarray | None:
        """Similaridade (cosseno) entre o perfil do usuário e todas as pinturas."""
        rated = {p: s for p, s in self.users[user_id].items() if p in self.pos}
        if not rated:
            return None
        ids = np.array(list(rated))
        ratings = np.array([rated[p] for p in ids], dtype=float)

        liked = ratings >= self.liked_threshold
        if not liked.any():                         
            liked = ratings == ratings.max()

        rows = [self.pos[p] for p in ids[liked]]
        weights = ratings[liked]
        profile = np.asarray(
            self.tfidf_matrix[rows].multiply(weights[:, None]).mean(axis=0)
        ).reshape(1, -1)
        return cosine_similarity(profile, self.tfidf_matrix).ravel()

    def _ranked_ids(self, user_id) -> list[tuple]:
        scores = self._user_scores(user_id)
        if scores is None:
            return []
        seen = set(self.users[user_id])
        ids = self.painting_df["id"].to_numpy()
        order = np.argsort(-scores, kind="stable")
        return [(ids[j], scores[j]) for j in order
                if ids[j] not in seen and scores[j] > 0]

    def has_history(self, user_id) -> bool:
        return user_id in self.users

    def get_user_history(self, user_id) -> pd.DataFrame:
        cols = ["painting_id", "rating"] + (["date"] if "date" in self.user_df.columns else [])
        rated = self.user_df.loc[self.user_df["user_id"] == user_id, cols]
        if rated.empty:
            return pd.DataFrame()

        sort_col = "date" if "date" in cols else "rating"
        rated = rated.sort_values(sort_col, ascending=False)
        frame = self._to_frame(rated["painting_id"].tolist())
        return rated.merge(frame, on="painting_id").reset_index(drop=True)

    def get_popular_recommendations(self, n: int = 10, exclude: set | None = None) -> pd.DataFrame:
        exclude = exclude or set()
        top_ids = [pid for pid in self.popular_painting_ids if pid not in exclude][:n]
        means = self._stats["mean"].to_dict()
        return self._to_frame(top_ids, predicted=means)

    def get_recommendations(self, user_id, n: int = 10) -> pd.DataFrame:
        already_rated = set(self.users.get(user_id, {}))

        if not self.has_history(user_id):
            return self.get_popular_recommendations(n=n, exclude=already_rated)

        recs = self._ranked_ids(user_id)[:n]
        ids = [pid for pid, _ in recs]
        predicted = {pid: 1 + 4 * score for pid, score in recs}

        if len(ids) < n:                            
            means = self._stats["mean"].to_dict()
            fill = [pid for pid in self.popular_painting_ids
                    if pid not in already_rated and pid not in predicted][: n - len(ids)]
            for pid in fill:
                predicted[pid] = means[pid]
            ids += fill

        return self._to_frame(ids, predicted=predicted)

    def recommend_ids(self, user_id, n: int = 10, accept=None) -> list:
        if not self.has_history(user_id):
            return []
        ids = [pid for pid, _ in self._ranked_ids(user_id)
               if accept is None or accept(pid)]
        return ids[:n]

    def add_rating(self, user_id, painting_id, rating, date=None) -> None:
        row = {"user_id": user_id, "painting_id": painting_id, "rating": rating}
        if "date" in self.user_df.columns:
            row["date"] = date or pd.Timestamp.today().strftime("%Y-%m-%d")

        mask = (self.user_df["user_id"] == user_id) & (self.user_df["painting_id"] == painting_id)
        self.user_df = pd.concat([self.user_df[~mask], pd.DataFrame([row])], ignore_index=True)

        self.users.setdefault(user_id, {})[painting_id] = rating
        self.item_users.setdefault(painting_id, set()).add(user_id)

        self.rating_stats = compute_rating_stats(self.user_df)
        self._refresh_popularity()

def style_recommender(i, dataframe, items, k=10):
    col = dataframe.loc[:, i]
    if isinstance(col, pd.DataFrame):               
        col = col.iloc[:, 0]

    scores = col.to_numpy()
    order = np.argsort(-scores, kind="stable")     
    closest = dataframe.columns[order]
    closest = closest[closest != i][:k]            
    return pd.DataFrame({"Title": closest}).merge(items).head(k)


if __name__ == "__main__":
    paintings = pd.read_csv(DATASET_DIR / "paintings.csv")
    ratings = pd.read_csv(DATASET_DIR / "ratings.csv")
    rec = PaintingRecommender(ratings, paintings)

    print("Matriz TF-IDF:", rec.tfidf_matrix.shape)
    features = rec.tfidf.get_feature_names_out()
    print("Exemplo de features:", list(features[:20]), "\n")

    n_cols = min(8, len(features))
    sample_rows = rec.painting_df.sample(10, random_state=1).index
    sample = pd.DataFrame(rec.tfidf_matrix[sample_rows].toarray(), columns=features,
                          index=rec.painting_df.loc[sample_rows, "Title"].str[:40])
    print(sample.sample(n_cols, axis=1, random_state=1).round(2).to_string(), "\n")

    cosine_sim_df = pd.DataFrame(cosine_similarity(rec.tfidf_matrix),
                                 index=rec.painting_df["Title"],
                                 columns=rec.painting_df["Title"])
    titulo = "Madonna and Child with Donor"
    if titulo in cosine_sim_df.columns:
        print(f"Parecidas com: {titulo}")
        print(style_recommender(titulo, cosine_sim_df,
                                rec.painting_df[["Title", "Artist", "Style", "Theme"]]).to_string(index=False), "\n")
    else:
        print(f"'{titulo}' não encontrado no dataset.\n")

    uid = ratings["user_id"].value_counts().index[0]
    print(f"Histórico do usuário {uid} (5 mais recentes):")
    print(rec.get_user_history(uid)[["Title", "Style", "rating", "date"]].head(5).to_string(index=False), "\n")

    print(f"Recomendações para o usuário {uid}:")
    print(rec.get_recommendations(uid, n=10)[["Title", "Artist", "Style", "predicted_rating"]].to_string(index=False), "\n")

    print("Cold start (usuário novo):")
    print(rec.get_recommendations(-1, n=5)[["Title", "Artist", "avg_rating", "n_ratings"]].to_string(index=False), "\n")

    novo = rec.get_recommendations(uid, n=1)["id"].iloc[0]
    rec.add_rating(uid, novo, 5)
    print(f"Depois de avaliar {novo} com 5, o top 3 muda para:")
    print(rec.get_recommendations(uid, n=3)[["Title", "Style", "predicted_rating"]].to_string(index=False))