import os
import time
import threading
import sqlite3
import pandas as pd
import numpy as np
import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.linear_model import LogisticRegression
import shap
import flwr as fl
from db_setup import initialize_db

# --- 1. FastAPI Setup ---
app = FastAPI(title=f"Hospital API: {os.getenv('NODE_NAME', 'Local Node')}")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "local_model.pkl"

class PatientData(BaseModel):
    Age: float
    RestingBP: float
    Cholesterol: float
    MaxHR: float
    ST_Depression: float
    ChestPain_Type: int
    ExerciseAngina: int

def get_data():
    conn = sqlite3.connect("local_vitals.db")
    df = pd.read_sql_query("SELECT * FROM patient_vitals", conn)
    conn.close()
    X = df.drop(columns=["Target"])
    y = df["Target"]
    return X, y

# --- 2. Flower Client (Federated Learning) ---
class HospitalClient(fl.client.NumPyClient):
    def __init__(self):
        self.model = LogisticRegression(max_iter=1000, warm_start=True)
        self.X_train, self.y_train = get_data()
        # Initialize model with one local step to define shapes
        self.model.fit(self.X_train, self.y_train)

    def get_parameters(self, config):
        return [self.model.coef_, self.model.intercept_]

    def set_parameters(self, parameters):
        self.model.coef_ = parameters[0]
        self.model.intercept_ = parameters[1]

    def fit(self, parameters, config):
        self.set_parameters(parameters)
        self.model.fit(self.X_train, self.y_train)
        joblib.dump(self.model, MODEL_PATH)  # Save synced weights for FastAPI
        return self.get_parameters(config), len(self.X_train), {}

    def evaluate(self, parameters, config):
        self.set_parameters(parameters)
        accuracy = self.model.score(self.X_train, self.y_train)
        return float(1.0 - accuracy), len(self.X_train), {"accuracy": float(accuracy)}

def start_fl_client():
    server_address = os.getenv("FLOWER_SERVER", "127.0.0.1:8080")
    # Retry loop with backoff to handle aggregator startup lag
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

# --- 3. API Endpoints ---
@app.on_event("startup")
def startup_event():
    initialize_db()
    # Run FL client in the background so it doesn't block the API
    threading.Thread(target=start_fl_client, daemon=True).start()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "node": os.getenv("NODE_NAME", "Local Node"),
        "model_trained": os.path.exists(MODEL_PATH)
    }

@app.post("/predict")
def predict_risk(data: PatientData):
    if not os.path.exists(MODEL_PATH):
        return {"error": "Federated model is still training. Please wait."}
    
    model = joblib.load(MODEL_PATH)
    X_bg, _ = get_data()
    
    input_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    input_df = pd.DataFrame([input_dict])
    
    # Generate Prediction
    prob = model.predict_proba(input_df)[0][1]
    
    # Generate SHAP securely inside the edge firewall
    sample_size = min(50, len(X_bg))
    explainer = shap.LinearExplainer(model, X_bg.sample(sample_size, random_state=42))
    shap_vals = explainer.shap_values(input_df)

    # Format SHAP output for the Next.js frontend
    features = list(input_df.columns)
    vals = shap_vals[0] if isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 2 else shap_vals
    contributions = [{"feature": f, "value": float(v)} for f, v in zip(features, vals)]

    expected_val = explainer.expected_value
    if hasattr(expected_val, "__iter__"):
        expected_val = expected_val[0]

    return {
        "node": os.getenv("NODE_NAME", "Local Node"),
        "risk_probability": float(prob),
        "baseline_expected_value": float(expected_val),
        "shap_contributions": contributions
    }
