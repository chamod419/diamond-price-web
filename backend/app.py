from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

# -----------------------
# Paths
# -----------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "model" / "diamond_model.joblib"
META_PATH  = BASE_DIR / "model" / "meta.json"

# Put the Kaggle excel here for lookup demo:
DATA_PATH  = BASE_DIR / "data" / "Sarah Gets a Diamond data.xls"

# -----------------------
# Load model + metadata
# -----------------------
model = joblib.load(MODEL_PATH)

with open(META_PATH, "r") as f:
    meta = json.load(f)

FEATURE_COLS = meta["feature_cols"]
CAT_COLS = meta["cat_cols"]
NOTE = meta.get("note", "")

# -----------------------
# Load dataset for "Actual" lookup (optional)
# -----------------------
PRICE_BY_ID = {}
if DATA_PATH.exists():
    df_all = pd.read_excel(DATA_PATH)
    df_train = df_all[df_all["Price"].notna()].copy()
    PRICE_BY_ID = dict(zip(df_train["ID"].astype(int), df_train["Price"].astype(float)))
else:
    df_all = None

# -----------------------
# App
# -----------------------
app = FastAPI(title="Diamond Price Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://diamond-price-web.vercel.app",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],  
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Schema (ID optional)
# -----------------------
class DiamondInput(BaseModel):
    id: int | None = Field(None, description="Optional. If provided and in training set, API can return actual price.")
    carat_weight: float = Field(..., gt=0, description="Carat Weight (e.g., 1.10)")
    cut: str
    color: str
    clarity: str
    polish: str
    symmetry: str
    report: str


def build_features(inp: DiamondInput) -> pd.DataFrame:
    row = {
        "Carat Weight": float(inp.carat_weight),
        "Cut": str(inp.cut),
        "Color": str(inp.color),
        "Clarity": str(inp.clarity),
        "Polish": str(inp.polish),
        "Symmetry": str(inp.symmetry),
        "Report": str(inp.report),
    }

    if "log_carat" in FEATURE_COLS:
        row["log_carat"] = float(np.log(row["Carat Weight"]))
    if "carat_sq" in FEATURE_COLS:
        row["carat_sq"] = float(row["Carat Weight"] ** 2)

    df = pd.DataFrame([row])

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype(str)

    df = df.reindex(columns=FEATURE_COLS).fillna(0)
    return df


@app.get("/")
def home():
    return {
        "status": "ok",
        "message": "Diamond Price Predictor API running",
        "note": NOTE,
        "lookup_loaded": bool(PRICE_BY_ID),
        "lookup_count": len(PRICE_BY_ID)
    }


@app.post("/predict")
def predict(inp: DiamondInput):
    # 1) If ID exists in train price dict -> return ACTUAL
    if inp.id is not None:
        _id = int(inp.id)
        if _id in PRICE_BY_ID:
            return {
                "mode": "actual_lookup",
                "id": _id,
                "price": float(PRICE_BY_ID[_id]),
                "currency": "USD"
            }

    # 2) Otherwise -> predict
    X = build_features(inp)
    pred_log = float(model.predict(X)[0])
    pred_price = float(np.expm1(pred_log))

    return {
        "mode": "prediction",
        "predicted_price": pred_price,
        "currency": "USD"
    }
