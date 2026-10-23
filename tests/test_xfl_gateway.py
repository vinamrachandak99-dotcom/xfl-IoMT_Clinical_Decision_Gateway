import os
import sys
import json
import pytest
import yaml
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

# Ensure edge_node is importable
EDGE_NODE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "edge_node")
if EDGE_NODE_DIR not in sys.path:
    sys.path.insert(0, EDGE_NODE_DIR)

from client_api import (
    app, startup_event, FEATURE_NAMES, DB_NAME, 
    MODEL_PATH, MLP_MODEL_PATH, SYNC_STATE_PATH, 
    update_sync_state, load_mlp_model
)
from db_setup import initialize_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Ensure edge database, artifacts, and initial models exist before tests run."""
    initialize_db(DB_NAME)
    startup_event()
    update_sync_state(1)
    yield

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def valid_patient_payload():
    return {
        "Age": 58,
        "RestingBP": 142,
        "Cholesterol": 245,
        "MaxHR": 145,
        "ST_Depression": 2.3,
        "ChestPain_Type": 3,
        "ExerciseAngina": 1
    }

def test_health_endpoint(client):
    """Test /health returns service status, database counts, and model readiness."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "node" in data
    assert data["model_trained"] is True
    assert data["models_ready"]["linear"] is True
    assert data["models_ready"]["mlp"] is True
    assert "linear" in data["available_models"]
    assert "mlp" in data["available_models"]
    assert data["records_in_db"] == 300
    assert data["sync_round"] >= 0

def test_predict_default_model(client, valid_patient_payload):
    """Test default prediction route uses linear model and returns complete telemetry."""
    res = client.post("/predict", json=valid_patient_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model_type"] == "linear"
    assert data["framework"] == "scikit-learn"
    assert 0.0 <= data["risk_probability"] <= 1.0
    assert isinstance(data["baseline_expected_value"], float)
    assert len(data["shap_contributions"]) == 7
    
    returned_features = [c["feature"] for c in data["shap_contributions"]]
    assert returned_features == FEATURE_NAMES

    assert data["sync_round"] >= 1
    assert data["inference_time_ms"] > 0
    assert data["shap_time_ms"] > 0
    assert data["local_cohort_size"] == 50

def test_predict_mlp_model(client, valid_patient_payload):
    """Test ?model=mlp query parameter selects the PyTorch MLP path."""
    res = client.post("/predict?model=mlp", json=valid_patient_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model_type"] == "mlp"
    assert data["framework"] == "pytorch"
    assert 0.0 <= data["risk_probability"] <= 1.0
    assert isinstance(data["baseline_expected_value"], float)
    assert len(data["shap_contributions"]) == 7

    returned_features = [c["feature"] for c in data["shap_contributions"]]
    assert returned_features == FEATURE_NAMES

    assert data["inference_time_ms"] > 0
    assert data["shap_time_ms"] > 0
    assert data["local_cohort_size"] == 50

def test_predict_invalid_model_parameter(client, valid_patient_payload):
    """Test invalid model values produce controlled client error (HTTP 400)."""
    res = client.post("/predict?model=unsupported_model", json=valid_patient_payload)
    assert res.status_code == 400
    data = res.json()
    assert "Unsupported model parameter" in data["detail"]

def test_predict_invalid_input_ranges(client):
    """Test invalid input boundaries produce 422 Unprocessable Entity."""
    # Negative age is clinically invalid
    invalid_payload = {
        "Age": -10,
        "RestingBP": 142,
        "Cholesterol": 245,
        "MaxHR": 145,
        "ST_Depression": 2.3,
        "ChestPain_Type": 3,
        "ExerciseAngina": 1
    }
    res = client.post("/predict", json=invalid_payload)
    assert res.status_code == 422

def test_shap_additivity_and_reconciliation(client, valid_patient_payload):
    """
    Verify SHAP efficiency/additivity axiom:
    Sum of feature attributions + expected baseline equals model logit output.
    """
    res = client.post("/predict?model=mlp", json=valid_patient_payload)
    assert res.status_code == 200
    data = res.json()
    
    shap_sum = sum(c["value"] for c in data["shap_contributions"])
    ev = data["baseline_expected_value"]
    reconstructed_logit = shap_sum + ev

    # Calculate actual model logit directly
    import torch
    mlp_model, scaler = load_mlp_model()
    input_df = pd.DataFrame([[valid_patient_payload[f] for f in FEATURE_NAMES]], columns=FEATURE_NAMES)
    input_scaled = scaler.transform(input_df)
    with torch.no_grad():
        actual_logit = mlp_model(torch.tensor(input_scaled, dtype=torch.float32)).item()

    assert abs(reconstructed_logit - actual_logit) < 1e-2

def test_sync_round_telemetry_reflection(client, valid_patient_payload):
    """Verify that updates to the federated sync round are reflected in telemetry."""
    update_sync_state(7)
    res = client.post("/predict?model=linear", json=valid_patient_payload)
    assert res.status_code == 200
    assert res.json()["sync_round"] == 7

def test_docker_compose_validity_and_resource_limits():
    """Verify docker-compose.yml includes CPU and memory quotas for hospital clients."""
    compose_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docker-compose.yml")
    assert os.path.exists(compose_path)

    with open(compose_path, "r", encoding="utf-8") as f:
        compose_cfg = yaml.safe_load(f)

    services = compose_cfg.get("services", {})
    assert "hospital_a" in services
    assert "hospital_b" in services
    assert "aggregator" in services
    assert "frontend" in services

    for node_name in ["hospital_a", "hospital_b"]:
        node = services[node_name]
        deploy_limits = node.get("deploy", {}).get("resources", {}).get("limits", {})
        assert str(deploy_limits.get("cpus")) == "1.5"
        assert str(deploy_limits.get("memory")).upper() == "4G"
