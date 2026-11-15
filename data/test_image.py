import pandas as pd
import requests

images = pd.read_csv("data/published_images.csv", low_memory=False)
images.columns = images.columns.str.lower()

closed = images[(images["viewtype"] == "primary") & (images["openaccess"] != 1)].head(10)

for _, row in closed.iterrows():
    url = row["iiifurl"] + "/full/!400,400/0/default.jpg"
    r = requests.get(url, timeout=30)
    print(r.status_code, r.headers.get("content-type"), len(r.content), url[:70])