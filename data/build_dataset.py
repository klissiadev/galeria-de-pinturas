import re
from pathlib import Path
import pandas as pd
import requests

# ---------- Caminhos ----------
SCRIPT_DIR = Path(__file__).resolve().parent          # .../galeria-de-pinturas/data
OUT_DIR = SCRIPT_DIR.parent / "dataset"
OUT_FILE = OUT_DIR / "paintings.csv"

GITHUB = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/"

def load(name):
    local = SCRIPT_DIR / name
    if not local.exists():                            # baixa só na primeira vez
        print(f"Baixando {name}...")
        r = requests.get(GITHUB + name, timeout=300)
        r.raise_for_status()
        local.write_bytes(r.content)
    df = pd.read_csv(local, low_memory=False)
    df.columns = df.columns.str.lower()
    return df

objects      = load("objects.csv")
terms        = load("objects_terms.csv")
images       = load("published_images.csv")
obj_const    = load("objects_constituents.csv")
constituents = load("constituents.csv")

# ---------- Pinturas + imagem open access ----------
paint = objects[objects["classification"] == "Painting"][
    ["objectid", "title", "attribution", "displaydate", "medium",
     "beginyear", "endyear", "visualbrowsertimespan", "creditline", "locationid"]]

img = images[images["viewtype"] == "primary"].drop_duplicates("depictstmsobjectid")
img = img[["depictstmsobjectid", "iiifurl", "iiifthumburl", "assistivetext", "width", "height", "openaccess"]]
df = paint.merge(img, left_on="objectid", right_on="depictstmsobjectid")

# ---------- Termos (theme, style, keyword, school) ----------
def join_unique(series):
    vals = series.dropna().astype(str).str.strip()
    return ", ".join(dict.fromkeys(v for v in vals if v))

def terms_by_type(termtype, colname):
    sub = terms[terms["termtype"] == termtype]
    return sub.groupby("objectid")["term"].apply(join_unique).rename(colname)

for ttype, col in [("Theme", "theme"), ("Style", "style"), ("Keyword", "keyword"),
                   ("School", "school"), ("Technique", "technique"),
                   ("Place Executed", "place")]:
    df = df.merge(terms_by_type(ttype, col), left_on="objectid", right_index=True, how="left")

# ---------- Nacionalidade do artista principal ----------
artists = (obj_const[obj_const["roletype"] == "artist"]
           .sort_values("displayorder")
           .drop_duplicates("objectid")[["objectid", "constituentid"]])
artists = artists.merge(constituents[["constituentid", "nationality"]],
                        on="constituentid", how="left")
df = df.merge(artists[["objectid", "nationality"]], on="objectid", how="left")

# ---------- Tags combinadas e URLs ----------
df["tags"] = (df[["theme", "style", "keyword", "school"]].fillna("")
              .agg(", ".join, axis=1).str.strip(", "))

df["url"] = df["iiifurl"] + "/full/!400,400/0/default.jpg"

texts = load("objects_text_entries.csv")
narr = (texts[texts["texttype"] == "brief_narrative"]
        .groupby("objectid")["text"].apply(lambda s: " ".join(s.astype(str)))
        .rename("narrative"))
df = df.merge(narr, left_on="objectid", right_index=True, how="left")

locs = load("locations.csv")[["locationid", "site", "room"]].drop_duplicates("locationid")
df = df.merge(locs, on="locationid", how="left")

# ---------- Limpeza de texto (tags HTML e underscores de itálico) ----------
def clean(s):
    return re.sub(r"<[^>]+>|_", "", str(s)).strip()

df["title"] = df["title"].map(clean)

# ---------- Coluna combinada para o TF-IDF ----------
# tags + theme + style + title + artist
df["tfidf_text"] = (df[["tags", "theme", "style", "title", "attribution"]]
                    .fillna("").agg(" ".join, axis=1)
                    .str.replace(r"\s+", " ", regex=True).str.strip()
                    .str.lower())

# ---------- Salvar ----------
out = df.rename(columns={
    "objectid": "ObjectID", "title": "Title", "attribution": "Artist",
    "displaydate": "Date", "medium": "Medium", "theme": "Theme",
    "style": "Style", "keyword": "Keywords", "school": "School",
    "nationality": "Nationality", "url": "URL", "iiifthumburl": "Thumb",
    "tfidf_text": "TFIDF_Text",
})[["ObjectID", "Title", "Artist", "Date", "Medium", "Theme", "Style",
    "Keywords", "School", "Nationality", "URL", "Thumb", "TFIDF_Text"]]

OUT_DIR.mkdir(parents=True, exist_ok=True)
out.to_csv(OUT_FILE, index=False, encoding="utf-8")

print(f"Salvo: {OUT_FILE}")
print(f"Total de pinturas: {len(out)}")
print("Cobertura por coluna:")
for c in ["Theme", "Style", "Keywords", "School", "Nationality"]:
    print(f"  {c:12}: {(out[c].fillna('') != '').mean():.0%}")
print()
print(out[["Title", "Artist", "Nationality", "URL"]].sample(5, random_state=1).to_string(index=False))