from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Deixa as tabelas legíveis no terminal
pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 30)
pd.set_option("display.max_colwidth", 45)

SCRIPT_DIR = Path(__file__).resolve().parent
path = SCRIPT_DIR / "dataset" / "paintings.csv"
if not path.exists():
    raise SystemExit(f"File not found: {path}\nRun first: python data/build_dataset.py")

df = pd.read_csv(path).reset_index(drop=True)

# ---------- TF-IDF ----------
tfidf = TfidfVectorizer(stop_words="english")
tfidf_matrix = tfidf.fit_transform(df["Style"].fillna(""))
print("Matriz TF-IDF:", tfidf_matrix.shape)

features = tfidf.get_feature_names_out()
print("Exemplo de features:", list(features[:20]), "\n")

# Amostra da matriz como tabela
n_cols = min(8, len(features))
sample_rows = df.sample(10, random_state=1).index
sample = pd.DataFrame(
    tfidf_matrix[sample_rows].toarray(),
    columns=features,
    index=df.loc[sample_rows, "Title"].str[:40],
)
print(sample.sample(n_cols, axis=1, random_state=1).round(2).to_string(), "\n")

# ---------- Recomendador ----------
def style_recommender(i, dataframe, items, k=10):
    ix = dataframe.loc[:,i].to_numpy().argpartition(range(-k, 0, -1))
    closest = dataframe.columns[ix[-1:-(k+2):-1]]
    closest.drop(i, errors="ignore", inplace=True)
    return pd.DataFrame(closest).merge(items).head(k)
