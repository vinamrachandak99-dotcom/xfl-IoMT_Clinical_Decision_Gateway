# Explainable Federated Learning for Healthcare IoT (XFL-Gateway)

[![Flower](https://img.shields.io/badge/Federated%20Learning-Flower%20(flwr)-FF6F00?style=for-the-badge&logo=flower)](https://flower.ai/)
[![FastAPI](https://img.shields.io/badge/Edge%20API-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/Deep%20Learning-PyTorch-EE4C2C?style=for-the-badge&logo=pytorch)](https://pytorch.org/)
[![Next.js](https://img.shields.io/badge/Clinical%20Dashboard-Next.js%2014-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Docker Compose](https://img.shields.io/badge/Orchestration-Docker%20Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

> **Academic Context:** B.Tech CSE IDEA Lab Project, Ramdeobaba University.  
> **Team:** Vinamra Chandak, Devyani Gadde, Radha Singh.  
> A privacy-preserving IoMT (Internet of Medical Things) clinical decision support platform simulating a decentralized healthcare network. Powered by **Federated Averaging (FedAvg)** over gRPC and **Localized SHAP (SHapley Additive exPlanations)** for zero-data-leakage diagnostics.

---

## 1. Research Problem & Objectives

In centralized healthcare machine learning, aggregating sensitive patient vitals into a cloud data lake creates severe privacy vulnerabilities and violates data protection regulations (such as HIPAA, GDPR, and DPDP). Conversely, isolated on-premise models trained solely on local records suffer from small sample sizes and poor generalizability.

### Core Research Objectives:
1. **Data Locality & Privacy-Aware Architecture:** Retain all raw physiological telemetry and SHAP background reference cohorts strictly inside client-local edge databases.
2. **Dual-Model Inference & Edge Explainability:** Support both baseline linear models (`LogisticRegression`) and non-linear deep models (`PyTorch MLP`) with real-time on-premise SHAP attribution.
3. **Cross-Silo Explanation Consistency:** Analyze how client-local reference distributions alter feature attributions for identical patient inputs across heterogeneous/non-IID clinical specializations (Cardiology vs. General Medicine).
4. **Computational & Resource Benchmarking:** Profile inference latency, SHAP computation time, memory usage, and communication payload sizes under edge constraints.

---

## 2. Architecture & Data Flow

```
                           ┌────────────────────────────────────────┐
                           │       Flower Federated Server          │
                           │        (FedAvg over gRPC :8080)        │
                           │   Aggregates model weights per round   │
                           └───────────────────┬────────────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     │ gRPC Synced Tensor Weights (No raw data)          │ gRPC Synced Tensor Weights
                     ▼                                                   ▼
      ┌─────────────────────────────┐                     ┌─────────────────────────────┐
      │   Hospital A (Edge Node)    │                     │   Hospital B (Edge Node)    │
      │   FastAPI Gateway :8001     │                     │   FastAPI Gateway :8002     │
      │ ─────────────────────────── │                     │ ─────────────────────────── │
      │ • SQLite: local_vitals.db   │                     │ • SQLite: local_vitals.db   │
      │ • Flower NumPyClient Thread │                     │ • Flower NumPyClient Thread │
      │ • Synced Linear / MLP Models│                     │ • Synced Linear / MLP Models│
      │ • Local Linear / Deep SHAP  │                     │ • Local Linear / Deep SHAP  │
      └──────────────┬──────────────┘                     └──────────────┬──────────────┘
                     │                                                   │
                     └─────────────────────────┬─────────────────────────┘
                                               │ HTTP POST /predict?model={linear|mlp}
                                               ▼
                           ┌────────────────────────────────────────┐
                           │    Decentralized Clinical Dashboard    │
                           │     Next.js 14 • Tailwind • Recharts   │
                           │         Browser Client (:3000)         │
                           └────────────────────────────────────────┘
```

---

## 3. Technology Stack

- **Federated Orchestration:** Flower (`flwr` v1.42) with Federated Averaging (`FedAvg`) over gRPC port `8080`.
- **Edge Inference Engines:** 
  - *Linear Baseline:* Scikit-learn `LogisticRegression` with `shap.LinearExplainer`.
  - *Non-Linear Neural Network:* PyTorch `CardiacMLP` (7 inputs $\rightarrow$ 16 $\rightarrow$ 8 $\rightarrow$ 1 logit) with `shap.DeepExplainer`.
- **Edge Microservice:** FastAPI, Uvicorn (ASGI), Pydantic v2 data validation, Joblib serialization.
- **Local Storage:** SQLite (`local_vitals.db`), zero shared storage between nodes.
- **Clinical Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts SVG charting, Lucide icons.
- **Containerization & Resource Limits:** Docker Compose with hard resource quotas (`cpus: 1.5`, `memory: 4G`).

---

## 4. Repository Structure

```text
xfl-IoMT_Clinical_Decision_Gateway/
├── aggregator/                     # Central Flower FL Coordinator
│   ├── Dockerfile                  # Aggregator image (Python 3.9-slim)
│   ├── requirements.txt            # flwr dependency
│   └── server.py                   # FedAvg strategy & server loop (Port 8080)
├── edge_node/                      # Decentralized Hospital Edge Services
│   ├── Dockerfile                  # Edge service container
│   ├── requirements.txt            # FastAPI, PyTorch, Scikit-learn, SHAP, Flower
│   ├── db_setup.py                 # SQLite synthetic medical dataset generator
│   └── client_api.py               # Dual-model inference, SHAP, and FL client
├── frontend/                       # Clinical Decision Support Interface
│   ├── Dockerfile                  # Multi-stage Next.js production build
│   ├── package.json                # Dependencies: Next.js 14, Recharts, Axios
│   ├── tailwind.config.ts          # Styling configuration
│   └── src/app/
│       ├── layout.tsx              # Root HTML wrapper
│       └── page.tsx                # Dual-node comparison & clinical UI
├── tests/                          # Automated Verification Suite
│   └── test_xfl_gateway.py         # Pytest functional and integration tests
├── evidence/                       # Empirical Research Artifacts & Evidence
│   ├── evaluation_results.json     # Quantitative benchmark metrics
│   ├── model_comparison.csv       # Linear vs MLP comparison table
│   ├── roc_curves.png             # Test set ROC curve plot
│   ├── shap_waterfall_comparison.png # Cross-silo SHAP comparison plot
│   ├── pytest_run.log             # Test execution log
│   └── SCREENSHOT_INSTRUCTIONS.md # Live demonstration guide
├── evaluate.py                     # Research evaluation & benchmarking harness
├── docker-compose.yml              # Container network with resource limits
└── README.md                       # Comprehensive system documentation
```

---

## 5. Physiological Telemetry Specification

The clinical gateway evaluates seven core cardiovascular indicators scaled to real-world physiological ranges:

| Telemetry Parameter | Unit | Type | Clinical Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Age** | `Years` | Continuous | $1 - 120$ | Completed patient age |
| **Resting BP** | `mmHg` | Continuous | $40 - 300$ | Systolic blood pressure at admission |
| **Cholesterol** | `mg/dL` | Continuous | $50 - 700$ | Serum cholesterol level |
| **Max Heart Rate** | `bpm` | Continuous | $30 - 250$ | Maximum heart rate under exercise stress |
| **ST Depression** | `mm` | Continuous | $0.0 - 15.0$ | Exercise-induced ST segment depression on ECG |
| **Chest Pain Type** | `Enum` | Categorical | Types $0 - 3$ | $0$: Typical, $1$: Atypical, $2$: Non-Anginal, $3$: Asymptomatic |
| **Exercise Angina** | `Binary` | Discrete | $0$ or $1$ | $0$: Absent (Negative), $1$: Present (Positive) |

---

## 6. Setup & Execution

### 6.1 Using Docker Compose (Full Decoupled Stack)
```bash
# Clone the repository
git clone https://github.com/vinamrachandak99-dotcom/xfl-IoMT_Clinical_Decision_Gateway.git
cd xfl-IoMT_Clinical_Decision_Gateway

# Launch the entire federated network
docker compose up --build
```
This starts:
- Flower Aggregator on `localhost:8080`
- Hospital A Node on `http://localhost:8001`
- Hospital B Node on `http://localhost:8002`
- Clinical Dashboard on `http://localhost:3000`

### 6.2 Local Development / Host Execution (Without Docker)
```bash
# 1. Install Python dependencies
pip install -r edge_node/requirements.txt pytest pyyaml matplotlib

# 2. Start Aggregator (Terminal 1)
cd aggregator
python server.py

# 3. Start Hospital A (Terminal 2)
cd edge_node
$env:NODE_NAME="Hospital_A"; $env:FLOWER_SERVER="127.0.0.1:8080"; uvicorn client_api:app --host 0.0.0.0 --port 8001

# 4. Start Hospital B (Terminal 3)
cd edge_node
$env:NODE_NAME="Hospital_B"; $env:FLOWER_SERVER="127.0.0.1:8080"; uvicorn client_api:app --host 0.0.0.0 --port 8002

# 5. Start Frontend (Terminal 4)
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 7. Automated Testing & Verification

To execute the test suite:
```bash
pytest tests/test_xfl_gateway.py -v
```

### Verified Test Cases:
1. `test_health_endpoint`: Validates `/health` schema, database counts, and model readiness.
2. `test_predict_default_model`: Confirms default route uses linear model and returns complete telemetry.
3. `test_predict_mlp_model`: Validates `?model=mlp` route using PyTorch MLP and `shap.DeepExplainer`.
4. `test_predict_invalid_model_parameter`: Ensures unknown model parameters return controlled HTTP 400.
5. `test_predict_invalid_input_ranges`: Validates boundary enforcement (HTTP 422).
6. `test_shap_additivity_and_reconciliation`: Numerically audits that $\sum \phi_i + E[f(x)]$ matches model logit.
7. `test_sync_round_telemetry_reflection`: Confirms real synchronization state propagation.
8. `test_docker_compose_validity_and_resource_limits`: Validates YAML syntax and CPU (`1.5`) & memory (`4G`) quotas.

---

## 8. Reproducing Empirical Research Evaluation

Run the evaluation script on the held-out benchmark dataset:
```bash
python evaluate.py
```

### Empirical Results (Measured):
- **Classification Performance (Held-out Test Cohort, N=150):**
  - *Linear FedAvg:* Accuracy = **61.33%**, Precision = **57.14%**, Recall = **90.67%**, F1 = **0.7010**, ROC-AUC = **0.7049**
  - *PyTorch MLP:* Accuracy = **56.67%**, Precision = **54.39%**, Recall = **82.67%**, F1 = **0.6561**, ROC-AUC = **0.6868**
- **Latency & Compute Overhead:**
  - *Linear Model:* Cold inference = **0.96 ms**, Warm inference = **1.25 ms**, SHAP explanation = **0.36 ms**
  - *PyTorch MLP:* Cold inference = **0.22 ms**, Warm inference = **0.04 ms**, Deep SHAP = **2.89 ms** (warm)
- **Cross-Silo Explanation Consistency (Hospital A vs. Hospital B on Same Patients):**
  - *Mean Cosine Similarity:* **0.9051** (Strong directional attribution alignment)
  - *Spearman Rank Correlation ($\rho$):* **0.8286** (High risk-factor ranking consistency)
  - *Top-3 Feature Jaccard Overlap:* **61.3%**
- **Federated Communication Footprint:**
  - Weight payload per round = **64 bytes** (7 floats coefficients + 1 float intercept)

Generated plots and tables are saved in [`evidence/`](evidence/).

---

## 9. API Reference & Schemas

### Health Audit
```http
GET /health
```
```json
{
  "status": "healthy",
  "node": "Hospital_A",
  "model_trained": true,
  "models_ready": {
    "linear": true,
    "mlp": true
  },
  "sync_round": 10,
  "records_in_db": 300,
  "available_models": ["linear", "mlp"]
}
```

### Clinical Assessment & Local SHAP
```http
POST /predict?model=linear
Content-Type: application/json
```
```json
{
  "Age": 58,
  "RestingBP": 142,
  "Cholesterol": 245,
  "MaxHR": 145,
  "ST_Depression": 2.3,
  "ChestPain_Type": 3,
  "ExerciseAngina": 1
}
```
**Response Payload:**
```json
{
  "node": "Hospital_A",
  "model_type": "linear",
  "framework": "scikit-learn",
  "risk_probability": 0.8703,
  "baseline_expected_value": 0.2991,
  "shap_contributions": [
    { "feature": "Age", "value": 0.6012 },
    { "feature": "RestingBP", "value": -0.0821 },
    { "feature": "Cholesterol", "value": -1.1045 },
    { "feature": "MaxHR", "value": -0.5524 },
    { "feature": "ST_Depression", "value": -0.0811 },
    { "feature": "ChestPain_Type", "value": 3.4215 },
    { "feature": "ExerciseAngina", "value": -0.7231 }
  ],
  "sync_round": 10,
  "inference_time_ms": 4.82,
  "shap_time_ms": 1.74,
  "local_cohort_size": 50
}
```

---

## 10. Docker Resource Limits & Runtime Enforcement

In `docker-compose.yml`, both hospital nodes are configured with:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.5'
      memory: 4G
cpus: 1.5
mem_limit: 4g
```

### Note on Docker Compose Limits:
- Under Docker Swarm mode or Docker Compose v2 with Compose specification, `deploy.resources.limits` enforces a maximum ceiling of 1.5 CPU cores (150% total single-core allocation quota, *not* a 1.5 GHz clock frequency cap) and 4 GiB of RAM.
- The root-level attributes `cpus` and `mem_limit` ensure backward compatibility when running standalone Docker Compose without Swarm mode.

---

## 11. Implemented vs. Planned Scope

| Dimension | Seminar 1 Status (Current) | Final Phase (Roadmap) |
| :--- | :--- | :--- |
| **Federated Learning** | Working Flower FedAvg over gRPC with 2 isolated nodes | Scale to 5+ heterogeneous clients; add FedProx & SCAFFOLD |
| **Models** | Logistic Regression (Linear) and PyTorch MLP | TabNet, 1D-CNN for raw ECG streams |
| **Explainable AI** | Local LinearExplainer and DeepExplainer on local cohort ($N=50$) | Centroid-based background clustering ($k$-means medoids) |
| **Data Partitioning** | Synthetic physiological generator scaled to medical ranges | Real clinical benchmarks (UCI Heart Disease, PTB-XL ECG, MIMIC-IV) |
| **Privacy Guarantees** | Physical data isolation + zero telemetry transmission | Differential Privacy (DP-SGD) + Secure Aggregation (SecAgg) |
| **Hardware Testing** | Simulated on host with Docker resource limits | Deployment on physical IoMT edge boards (Raspberry Pi 5 / Jetson) |

---

## 12. License

Distributed under the MIT License. See `LICENSE` for more information.
