"""
XFL-IoMT Gateway: Research Evaluation & Benchmarking Harness
Evaluates:
  1. Classification performance (Accuracy, Precision, Recall, F1, ROC-AUC, Confusion Matrix)
  2. Latency & Computational Overhead (Cold vs. Warm inference, SHAP runtime)
  3. Model Size & Communication Payload Footprint
  4. Cross-Silo Explanation Consistency (Cosine Similarity, Spearman Rank, Top-k Jaccard)
Generates reproducible outputs in the evidence/ directory.
"""

import os
import sys
import time
import json
import platform
import sqlite3
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, 
    f1_score, roc_auc_score, confusion_matrix, roc_curve
)
from scipy.stats import spearmanr
import shap

# Ensure edge_node imports work
EDGE_NODE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "edge_node")
if EDGE_NODE_DIR not in sys.path:
    sys.path.insert(0, EDGE_NODE_DIR)

from client_api import CardiacMLP, FEATURE_NAMES

def generate_medical_partition(n_samples: int, random_seed: int, age_bias: float = 0.0):
    """Generate physiological telemetry scaled to real cardiovascular ranges."""
    X, y = make_classification(
        n_samples=n_samples, 
        n_features=7, 
        n_informative=5, 
        n_redundant=1,
        random_state=random_seed
    )
    # Scale to medical parameters
    X[:, 0] = np.interp(X[:, 0], (X[:, 0].min(), X[:, 0].max()), (30 + age_bias, 80))
    X[:, 1] = np.interp(X[:, 1], (X[:, 1].min(), X[:, 1].max()), (95, 180))
    X[:, 2] = np.interp(X[:, 2], (X[:, 2].min(), X[:, 2].max()), (140, 360))
    X[:, 3] = np.interp(X[:, 3], (X[:, 3].min(), X[:, 3].max()), (80, 200))
    X[:, 4] = np.interp(X[:, 4], (X[:, 4].min(), X[:, 4].max()), (0.0, 5.0))
    X[:, 5] = np.digitize(X[:, 5], bins=np.linspace(X[:, 5].min(), X[:, 5].max(), 4)) - 1
    X[:, 6] = (X[:, 6] > 0).astype(int)

    df = pd.DataFrame(X, columns=FEATURE_NAMES)
    df["Target"] = y
    return df

def run_evaluation():
    print("=" * 70)
    print("XFL-IoMT GATEWAY: EMPIRICAL BENCHMARK & EVALUATION HARNESS")
    print("=" * 70)

    evidence_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "evidence")
    os.makedirs(evidence_dir, exist_ok=True)

    # 1. Environment & Hardware Inventory
    env_info = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "os": f"{platform.system()} {platform.release()} ({platform.version()})",
        "python_version": platform.python_version(),
        "torch_version": torch.__version__,
        "shap_version": shap.__version__,
        "processor": platform.processor(),
        "machine": platform.machine()
    }
    print(f"Environment: Python {env_info['python_version']} | PyTorch {env_info['torch_version']} | SHAP {env_info['shap_version']}")

    # 2. Data Partitioning (Simulated Non-IID Hospital Cohorts & Held-out Test)
    # Hospital A (Cardiology, older cohort bias)
    df_node_a = generate_medical_partition(n_samples=300, random_seed=42, age_bias=10.0)
    # Hospital B (General Medicine, younger cohort)
    df_node_b = generate_medical_partition(n_samples=300, random_seed=99, age_bias=0.0)
    # Independent Held-out Benchmark Test Set
    df_test = generate_medical_partition(n_samples=150, random_seed=777, age_bias=5.0)

    X_train_a, y_train_a = df_node_a[FEATURE_NAMES], df_node_a["Target"]
    X_train_b, y_train_b = df_node_b[FEATURE_NAMES], df_node_b["Target"]
    X_test, y_test = df_test[FEATURE_NAMES], df_test["Target"]

    # 3. Model Training
    # --- Linear Model (Hospital A) ---
    t0 = time.perf_counter()
    linear_a = LogisticRegression(max_iter=1000)
    linear_a.fit(X_train_a, y_train_a)
    linear_train_time_ms = (time.perf_counter() - t0) * 1000.0

    # --- Linear Model (Hospital B) ---
    linear_b = LogisticRegression(max_iter=1000)
    linear_b.fit(X_train_b, y_train_b)

    # --- Federated Averaging (FedAvg on Linear Weights) ---
    fedavg_coef = (linear_a.coef_ + linear_b.coef_) / 2.0
    fedavg_intercept = (linear_a.intercept_ + linear_b.intercept_) / 2.0
    linear_global = LogisticRegression()
    linear_global.classes_ = linear_a.classes_
    linear_global.coef_ = fedavg_coef
    linear_global.intercept_ = fedavg_intercept

    # Payload calculation for gRPC parameter transmission
    payload_bytes = fedavg_coef.nbytes + fedavg_intercept.nbytes

    # --- PyTorch MLP Model (Hospital A) ---
    scaler_a = StandardScaler()
    X_train_a_scaled = scaler_a.fit_transform(X_train_a)
    X_test_scaled = scaler_a.transform(X_test)

    mlp_model = CardiacMLP(input_dim=7, hidden_dim=16)
    optimizer = torch.optim.Adam(mlp_model.parameters(), lr=0.01, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()

    X_train_tensor = torch.tensor(X_train_a_scaled, dtype=torch.float32)
    y_train_tensor = torch.tensor(y_train_a.values, dtype=torch.float32).unsqueeze(1)

    t0 = time.perf_counter()
    mlp_model.train()
    for _ in range(80):
        optimizer.zero_grad()
        out = mlp_model(X_train_tensor)
        loss = criterion(out, y_train_tensor)
        loss.backward()
        optimizer.step()
    mlp_train_time_ms = (time.perf_counter() - t0) * 1000.0
    mlp_model.eval()

    # 4. Evaluation on Independent Held-Out Test Set
    # Predictions
    y_prob_linear = linear_global.predict_proba(X_test)[:, 1]
    y_pred_linear = (y_prob_linear >= 0.5).astype(int)

    with torch.no_grad():
        test_tensor = torch.tensor(X_test_scaled, dtype=torch.float32)
        mlp_logits = mlp_model(test_tensor).numpy().flatten()
        y_prob_mlp = 1.0 / (1.0 + np.exp(-mlp_logits))
        y_pred_mlp = (y_prob_mlp >= 0.5).astype(int)

    metrics = {
        "Linear_FedAvg": {
            "accuracy": round(float(accuracy_score(y_test, y_pred_linear)), 4),
            "precision": round(float(precision_score(y_test, y_pred_linear, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, y_pred_linear)), 4),
            "f1_score": round(float(f1_score(y_test, y_pred_linear)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, y_prob_linear)), 4),
            "confusion_matrix": confusion_matrix(y_test, y_pred_linear).tolist(),
            "training_time_ms": round(linear_train_time_ms, 2)
        },
        "PyTorch_MLP": {
            "accuracy": round(float(accuracy_score(y_test, y_pred_mlp)), 4),
            "precision": round(float(precision_score(y_test, y_pred_mlp, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, y_pred_mlp)), 4),
            "f1_score": round(float(f1_score(y_test, y_pred_mlp)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, y_prob_mlp)), 4),
            "confusion_matrix": confusion_matrix(y_test, y_pred_mlp).tolist(),
            "training_time_ms": round(mlp_train_time_ms, 2)
        }
    }

    # 5. Latency Profiling (Cold vs. Warm)
    single_patient_df = X_test.iloc[0:1]
    single_scaled_tensor = torch.tensor(scaler_a.transform(single_patient_df), dtype=torch.float32)

    # Linear Latency
    t0 = time.perf_counter()
    _ = linear_global.predict_proba(single_patient_df)
    linear_cold_ms = (time.perf_counter() - t0) * 1000.0

    warm_times = []
    for _ in range(50):
        t0 = time.perf_counter()
        _ = linear_global.predict_proba(single_patient_df)
        warm_times.append((time.perf_counter() - t0) * 1000.0)
    linear_warm_ms = float(np.mean(warm_times))

    # MLP Latency
    t0 = time.perf_counter()
    with torch.no_grad():
        _ = mlp_model(single_scaled_tensor)
    mlp_cold_ms = (time.perf_counter() - t0) * 1000.0

    warm_times = []
    for _ in range(50):
        t0 = time.perf_counter()
        with torch.no_grad():
            _ = mlp_model(single_scaled_tensor)
        warm_times.append((time.perf_counter() - t0) * 1000.0)
    mlp_warm_ms = float(np.mean(warm_times))

    # SHAP Latency
    bg_sample_50 = X_train_a.sample(50, random_state=42)
    t0 = time.perf_counter()
    linear_explainer = shap.LinearExplainer(linear_global, bg_sample_50)
    _ = linear_explainer.shap_values(single_patient_df)
    linear_shap_cold_ms = (time.perf_counter() - t0) * 1000.0

    shap_warm_times = []
    for _ in range(20):
        t0 = time.perf_counter()
        _ = linear_explainer.shap_values(single_patient_df)
        shap_warm_times.append((time.perf_counter() - t0) * 1000.0)
    linear_shap_warm_ms = float(np.mean(shap_warm_times))

    bg_tensor_50 = torch.tensor(scaler_a.transform(bg_sample_50), dtype=torch.float32)
    t0 = time.perf_counter()
    mlp_explainer = shap.DeepExplainer(mlp_model, bg_tensor_50)
    _ = mlp_explainer.shap_values(single_scaled_tensor)
    mlp_shap_cold_ms = (time.perf_counter() - t0) * 1000.0

    shap_warm_times = []
    for _ in range(10):
        t0 = time.perf_counter()
        _ = mlp_explainer.shap_values(single_scaled_tensor)
        shap_warm_times.append((time.perf_counter() - t0) * 1000.0)
    mlp_shap_warm_ms = float(np.mean(shap_warm_times))

    latencies = {
        "linear_inference_cold_ms": round(linear_cold_ms, 3),
        "linear_inference_warm_ms": round(linear_warm_ms, 3),
        "mlp_inference_cold_ms": round(mlp_cold_ms, 3),
        "mlp_inference_warm_ms": round(mlp_warm_ms, 3),
        "linear_shap_cold_ms": round(linear_shap_cold_ms, 3),
        "linear_shap_warm_ms": round(linear_shap_warm_ms, 3),
        "mlp_shap_cold_ms": round(mlp_shap_cold_ms, 3),
        "mlp_shap_warm_ms": round(mlp_shap_warm_ms, 3)
    }

    # 6. Cross-Silo Explanation Consistency (Hospital A vs. Hospital B)
    # The identical global model is explained using Node A's background vs Node B's background
    bg_a = X_train_a.sample(50, random_state=42)
    bg_b = X_train_b.sample(50, random_state=42)
    explainer_a = shap.LinearExplainer(linear_global, bg_a)
    explainer_b = shap.LinearExplainer(linear_global, bg_b)

    cosine_sims = []
    spearman_corrs = []
    top_3_jaccard = []

    for idx in range(min(30, len(X_test))):
        sample = X_test.iloc[idx:idx+1]
        shap_a = explainer_a.shap_values(sample).flatten()
        shap_b = explainer_b.shap_values(sample).flatten()

        # 1. Cosine Similarity
        norm_a, norm_b = np.linalg.norm(shap_a), np.linalg.norm(shap_b)
        if norm_a > 1e-9 and norm_b > 1e-9:
            cos_sim = np.dot(shap_a, shap_b) / (norm_a * norm_b)
            cosine_sims.append(cos_sim)

        # 2. Spearman Rank Correlation
        corr, _ = spearmanr(shap_a, shap_b)
        if not np.isnan(corr):
            spearman_corrs.append(corr)

        # 3. Top-3 Feature Jaccard Index
        top_a = set(np.argsort(np.abs(shap_a))[-3:])
        top_b = set(np.argsort(np.abs(shap_b))[-3:])
        jaccard = len(top_a.intersection(top_b)) / len(top_a.union(top_b))
        top_3_jaccard.append(jaccard)

    consistency = {
        "mean_cosine_similarity": round(float(np.mean(cosine_sims)), 4),
        "mean_spearman_rank_correlation": round(float(np.mean(spearman_corrs)), 4),
        "mean_top3_jaccard_overlap": round(float(np.mean(top_3_jaccard)), 4),
        "evaluated_instances": len(cosine_sims)
    }

    # 7. Model Sizes & Communication Payload
    model_footprints = {
        "linear_parameters_payload_bytes": payload_bytes,
        "mlp_num_trainable_parameters": sum(p.numel() for p in mlp_model.parameters() if p.requires_grad),
        "fl_rounds_configured": 10,
        "clients_active": 2
    }

    # 8. Compile Complete Results Dict
    results = {
        "metadata": env_info,
        "classification_performance": metrics,
        "latency_profile_ms": latencies,
        "explanation_consistency": consistency,
        "communication_and_model_size": model_footprints
    }

    # Save to evidence JSON
    results_json_path = os.path.join(evidence_dir, "evaluation_results.json")
    with open(results_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Save to comparison CSV
    csv_rows = [
        {"Model": "Logistic Regression (FedAvg)", **metrics["Linear_FedAvg"]},
        {"Model": "PyTorch MLP", **metrics["PyTorch_MLP"]}
    ]
    pd.DataFrame(csv_rows).to_csv(os.path.join(evidence_dir, "model_comparison.csv"), index=False)

    # 9. Generate Plots
    # Plot 1: ROC Curves
    plt.figure(figsize=(7, 5))
    fpr_lin, tpr_lin, _ = roc_curve(y_test, y_prob_linear)
    fpr_mlp, tpr_mlp, _ = roc_curve(y_test, y_prob_mlp)
    plt.plot(fpr_lin, tpr_lin, label=f"Linear FedAvg (AUC = {metrics['Linear_FedAvg']['roc_auc']:.3f})", color="#2563eb", lw=2)
    plt.plot(fpr_mlp, tpr_mlp, label=f"PyTorch MLP (AUC = {metrics['PyTorch_MLP']['roc_auc']:.3f})", color="#7c3aed", lw=2)
    plt.plot([0, 1], [0, 1], 'k--', alpha=0.4)
    plt.title("ROC Curves: Global FedAvg vs. PyTorch MLP", fontsize=12, fontweight='bold')
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(evidence_dir, "roc_curves.png"), dpi=200)
    plt.close()

    # Plot 2: Cross-Silo SHAP Comparison for Archetypal Patient
    sample_pt = X_test.iloc[0:1]
    shap_node_a = explainer_a.shap_values(sample_pt).flatten()
    shap_node_b = explainer_b.shap_values(sample_pt).flatten()

    fig, ax = plt.subplots(figsize=(9, 5))
    x_indices = np.arange(len(FEATURE_NAMES))
    bar_width = 0.35

    ax.barh(x_indices - bar_width/2, shap_node_a, bar_width, label="Hospital A (Cardiology)", color="#3b82f6", alpha=0.9)
    ax.barh(x_indices + bar_width/2, shap_node_b, bar_width, label="Hospital B (General Med)", color="#6366f1", alpha=0.9)

    ax.set_yticks(x_indices)
    ax.set_yticklabels(FEATURE_NAMES, fontweight='semibold')
    ax.set_xlabel("SHAP Attribution (Log-Odds Impact)", fontweight='bold')
    ax.set_title("Cross-Silo SHAP Attribution Comparison (Same Patient, Local Baselines)", fontsize=11, fontweight='bold')
    ax.axvline(0, color='gray', linestyle='--', alpha=0.6)
    ax.legend()
    plt.grid(axis='x', alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(evidence_dir, "shap_waterfall_comparison.png"), dpi=200)
    plt.close()

    print("\nEVALUATION COMPLETED SUCCESSFULLY!")
    print(f"Results saved to: {results_json_path}")
    print(f"Comparison CSV: {os.path.join(evidence_dir, 'model_comparison.csv')}")
    print(f"ROC Curves: {os.path.join(evidence_dir, 'roc_curves.png')}")
    print(f"SHAP Comparison: {os.path.join(evidence_dir, 'shap_waterfall_comparison.png')}")
    print("\nSummary Metrics:")
    print(f"  • Linear FedAvg: Accuracy = {metrics['Linear_FedAvg']['accuracy']}, F1 = {metrics['Linear_FedAvg']['f1_score']}, AUC = {metrics['Linear_FedAvg']['roc_auc']}")
    print(f"  • PyTorch MLP:   Accuracy = {metrics['PyTorch_MLP']['accuracy']}, F1 = {metrics['PyTorch_MLP']['f1_score']}, AUC = {metrics['PyTorch_MLP']['roc_auc']}")
    print(f"  • Explanation Consistency (Hospital A vs B):")
    print(f"      Cosine Sim: {consistency['mean_cosine_similarity']}")
    print(f"      Spearman Rank Corr: {consistency['mean_spearman_rank_correlation']}")
    print(f"      Top-3 Feature Overlap: {consistency['mean_top3_jaccard_overlap'] * 100:.1f}%")

if __name__ == "__main__":
    run_evaluation()
