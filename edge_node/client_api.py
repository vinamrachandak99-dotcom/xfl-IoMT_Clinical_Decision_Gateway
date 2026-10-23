import os
import time
import json
import threading
import sqlite3
import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import shap
import flwr as fl
import torch
import torch.nn as nn
try:
    from db_setup import initialize_db
except ImportError:
    from edge_node.db_setup import initialize_db

# --- 1. FastAPI Setup ---
app = FastAPI(
    title=f"Hospital API: {os.getenv('NODE_NAME', 'Local Node')}",
    version="1.5.0",
    description="Privacy-Preserving IoMT Edge Node with Federated Learning & Local SHAP"
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = os.getenv("DB_NAME", "local_vitals.db")
MODEL_PATH = os.getenv("MODEL_PATH", "local_model.pkl")
MLP_MODEL_PATH = os.getenv("MLP_MODEL_PATH", "local_mlp.pt")
SYNC_STATE_PATH = os.getenv("SYNC_STATE_PATH", "sync_state.json")
FEATURE_NAMES = ["Age", "RestingBP", "Cholesterol", "MaxHR", "ST_Depression", "ChestPain_Type", "ExerciseAngina"]

class PatientData(BaseModel):
    Age: float = Field(..., ge=1, le=120, description="Age in years")
    RestingBP: float = Field(..., ge=40, le=300, description="Resting Blood Pressure in mmHg")
    Cholesterol: float = Field(..., ge=50, le=700, description="Serum Cholesterol in mg/dL")
    MaxHR: float = Field(..., ge=30, le=250, description="Max Heart Rate achieved")
    ST_Depression: float = Field(..., ge=0.0, le=15.0, description="ST Depression induced by exercise")
    ChestPain_Type: int = Field(..., ge=0, le=3, description="Chest Pain Type (0-3)")
    ExerciseAngina: int = Field(..., ge=0, le=1, description="Exercise Induced Angina (0=No, 1=Yes)")

# --- 2. PyTorch MLP Architecture ---
class CardiacMLP(nn.Module):
    """Multi-Layer Perceptron for non-linear cardiac risk prediction."""
    def __init__(self, input_dim: int = 7, hidden_dim: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 8),
            nn.ReLU(),
            nn.Linear(8, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

def get_data():
    """Retrieve private patient vitals from the edge SQLite database."""
    if not os.path.exists(DB_NAME):
        initialize_db(DB_NAME)
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM patient_vitals", conn)
    conn.close()
    if "Target" not in df.columns:
        raise RuntimeError("Table 'patient_vitals' missing 'Target' column.")
    X = df[FEATURE_NAMES]
    y = df["Target"]
    return X, y

def get_sync_state() -> dict:
    """Retrieve federated synchronization round from persistent state."""
    if os.path.exists(SYNC_STATE_PATH):
        try:
            with open(SYNC_STATE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"sync_round": 0, "last_synced_at": None}

def update_sync_state(sync_round: int):
    """Persist the current federated synchronization round."""
    state = {
        "sync_round": int(sync_round),
        "last_synced_at": time.time(),
        "node": os.getenv("NODE_NAME", "Local Node")
    }
    with open(SYNC_STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def train_linear_model(X: pd.DataFrame, y: pd.Series):
    """Train and persist local Logistic Regression baseline."""
    model = LogisticRegression(max_iter=1000, warm_start=True)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    return model

def train_mlp_model(X: pd.DataFrame, y: pd.Series, epochs: int = 60):
    """Train and persist local PyTorch MLP with standardized features."""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = CardiacMLP(input_dim=len(FEATURE_NAMES), hidden_dim=16)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()

    X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
    y_tensor = torch.tensor(y.values, dtype=torch.float32).unsqueeze(1)

    model.train()
    for _ in range(epochs):
        optimizer.zero_grad()
        logits = model(X_tensor)
        loss = criterion(logits, y_tensor)
        loss.backward()
        optimizer.step()

    torch.save({
        "state_dict": model.state_dict(),
        "scaler": scaler,
        "input_features": FEATURE_NAMES
    }, MLP_MODEL_PATH)
    return model, scaler

def load_mlp_model():
    """Load the persisted PyTorch MLP and its associated standard scaler."""
    if not os.path.exists(MLP_MODEL_PATH):
        raise FileNotFoundError(f"MLP model artifact not found at {MLP_MODEL_PATH}")
    checkpoint = torch.load(MLP_MODEL_PATH, weights_only=False)
    model = CardiacMLP(input_dim=len(FEATURE_NAMES), hidden_dim=16)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    scaler = checkpoint["scaler"]
    return model, scaler

# --- 3. Flower Client (Federated Learning) ---
class HospitalClient(fl.client.NumPyClient):
    def __init__(self):
        self.model = LogisticRegression(max_iter=1000, warm_start=True)
        self.X_train, self.y_train = get_data()
        # Initial fit defines shapes and ensures local artifacts exist
        self.model.fit(self.X_train, self.y_train)
        joblib.dump(self.model, MODEL_PATH)
        if not os.path.exists(MLP_MODEL_PATH):
            train_mlp_model(self.X_train, self.y_train)

    def get_parameters(self, config):
        return [self.model.coef_, self.model.intercept_]

    def set_parameters(self, parameters):
        self.model.coef_ = parameters[0]
        self.model.intercept_ = parameters[1]

    def fit(self, parameters, config):
        self.set_parameters(parameters)
        self.model.fit(self.X_train, self.y_train)
        joblib.dump(self.model, MODEL_PATH)

        # Update and persist sync round
        current_state = get_sync_state()
        new_round = current_state.get("sync_round", 0) + 1
        # If server config supplies server_round, prioritize it
        if config and "server_round" in config:
            new_round = int(config["server_round"])
        update_sync_state(new_round)

        # Incrementally refine local MLP as well
        try:
            train_mlp_model(self.X_train, self.y_train, epochs=15)
        except Exception as e:
            print(f"[{os.getenv('NODE_NAME', 'Node')}] MLP local fine-tune error: {e}")

        return self.get_parameters(config), len(self.X_train), {"sync_round": new_round}

    def evaluate(self, parameters, config):
        self.set_parameters(parameters)
        accuracy = self.model.score(self.X_train, self.y_train)
        return float(1.0 - accuracy), len(self.X_train), {"accuracy": float(accuracy)}

def start_fl_client():
    server_address = os.getenv("FLOWER_SERVER", "127.0.0.1:8080")
    while True:
        try:
            print(f"[{os.getenv('NODE_NAME', 'Node')}] Connecting to Flower Server at {server_address}...")
            fl.client.start_client(
                server_address=server_address,
                client=HospitalClient().to_client()
            )
            print(f"[{os.getenv('NODE_NAME', 'Node')}] Federated training session completed.")
            break
        except Exception as exc:
            print(f"[{os.getenv('NODE_NAME', 'Node')}] Aggregator connection pending ({exc}). Retrying in 5s...")
            time.sleep(5)

# --- 4. Lifecycle Events ---
@app.on_event("startup")
def startup_event():
    # 1. Initialize SQLite database if needed
    initialize_db(DB_NAME)
    
    # 2. Ensure both models and sync state exist immediately
    X, y = get_data()
    if not os.path.exists(MODEL_PATH):
        train_linear_model(X, y)
    if not os.path.exists(MLP_MODEL_PATH):
        train_mlp_model(X, y)
    if not os.path.exists(SYNC_STATE_PATH):
        update_sync_state(0)

    # 3. Start Flower client thread in background
    threading.Thread(target=start_fl_client, daemon=True).start()

# --- 5. API Endpoints ---
@app.get("/health")
def health_check():
    """Service health, readiness, and federated state audit."""
    linear_ready = os.path.exists(MODEL_PATH)
    mlp_ready = os.path.exists(MLP_MODEL_PATH)
    sync_state = get_sync_state()

    num_records = 0
    if os.path.exists(DB_NAME):
        try:
            conn = sqlite3.connect(DB_NAME)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM patient_vitals")
            num_records = cur.fetchone()[0]
            conn.close()
        except Exception:
            pass

    return {
        "status": "healthy",
        "node": os.getenv("NODE_NAME", "Local Node"),
        "model_trained": linear_ready, # Preserved for backwards compatibility
        "models_ready": {
            "linear": linear_ready,
            "mlp": mlp_ready
        },
        "sync_round": sync_state.get("sync_round", 0),
        "records_in_db": num_records,
        "available_models": ["linear", "mlp"]
    }

@app.post("/predict")
def predict_risk(
    data: PatientData,
    model: str = Query("linear", description="Model architecture to evaluate: 'linear' or 'mlp'")
):
    """
    Execute localized clinical assessment and compute on-premise SHAP feature attribution.
    Raw patient data and background reference cohorts never leave this edge node.
    """
    model_choice = model.lower().strip()
    if model_choice not in ["linear", "logistic_regression", "mlp"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported model parameter '{model}'. Supported values are 'linear' and 'mlp'."
        )
    target_mode = "linear" if model_choice in ["linear", "logistic_regression"] else "mlp"

    # Prepare input DataFrame with guaranteed feature ordering
    input_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    input_df = pd.DataFrame([[input_dict[f] for f in FEATURE_NAMES]], columns=FEATURE_NAMES)

    # Load local background reference cohort
    try:
        X_bg, _ = get_data()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to access local reference data: {exc}")

    if len(X_bg) == 0:
        raise HTTPException(status_code=500, detail="Local patient cohort database is empty.")

    sample_size = min(50, len(X_bg))
    bg_sample = X_bg.sample(sample_size, random_state=42)

    # Execute selected model inference and explanation
    if target_mode == "linear":
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(
                status_code=503,
                detail="Federated linear model artifact is not ready. Please wait."
            )
        try:
            linear_model = joblib.load(MODEL_PATH)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed loading linear model artifact: {exc}")

        # 1. Monotonic inference timer
        t_infer_0 = time.perf_counter()
        prob = float(linear_model.predict_proba(input_df)[0][1])
        inference_time_ms = round((time.perf_counter() - t_infer_0) * 1000.0, 3)

        # 2. Monotonic SHAP explanation timer
        t_shap_0 = time.perf_counter()
        try:
            explainer = shap.LinearExplainer(linear_model, bg_sample)
            shap_vals = explainer.shap_values(input_df)
            expected_val = explainer.expected_value
            if hasattr(expected_val, "__iter__"):
                expected_val = expected_val[0]
            expected_val = float(expected_val)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Linear SHAP explanation failure: {exc}")
        shap_time_ms = round((time.perf_counter() - t_shap_0) * 1000.0, 3)

        vals = np.array(shap_vals).flatten()

    else:  # target_mode == "mlp"
        if not os.path.exists(MLP_MODEL_PATH):
            raise HTTPException(
                status_code=503,
                detail="PyTorch MLP model artifact is not ready. Please wait."
            )
        try:
            mlp_model, scaler = load_mlp_model()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed loading PyTorch MLP artifact: {exc}")

        # 1. Monotonic inference timer
        t_infer_0 = time.perf_counter()
        input_scaled = scaler.transform(input_df)
        input_tensor = torch.tensor(input_scaled, dtype=torch.float32)
        with torch.no_grad():
            logit = mlp_model(input_tensor).item()
            prob = float(torch.sigmoid(torch.tensor(logit)).item())
        inference_time_ms = round((time.perf_counter() - t_infer_0) * 1000.0, 3)

        # 2. Monotonic SHAP explanation timer (DeepExplainer over local reference cohort)
        t_shap_0 = time.perf_counter()
        try:
            bg_scaled = scaler.transform(bg_sample)
            bg_tensor = torch.tensor(bg_scaled, dtype=torch.float32)
            explainer = shap.DeepExplainer(mlp_model, bg_tensor)
            shap_vals = explainer.shap_values(input_tensor)
            expected_val = explainer.expected_value
            if hasattr(expected_val, "__iter__"):
                expected_val = expected_val[0]
            expected_val = float(expected_val)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"PyTorch DeepExplainer failure: {exc}")
        shap_time_ms = round((time.perf_counter() - t_shap_0) * 1000.0, 3)

        vals = np.array(shap_vals).flatten()

    contributions = [{"feature": f, "value": round(float(v), 4)} for f, v in zip(FEATURE_NAMES, vals)]
    sync_state = get_sync_state()

    return {
        "node": os.getenv("NODE_NAME", "Local Node"),
        "model_type": target_mode,
        "framework": "scikit-learn" if target_mode == "linear" else "pytorch",
        "risk_probability": round(float(prob), 4),
        "baseline_expected_value": round(float(expected_val), 4),
        "shap_contributions": contributions,
        "sync_round": int(sync_state.get("sync_round", 0)),
        "inference_time_ms": float(inference_time_ms),
        "shap_time_ms": float(shap_time_ms),
        "local_cohort_size": int(sample_size)
    }
