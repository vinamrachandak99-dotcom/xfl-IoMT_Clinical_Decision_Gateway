# Explainable Federated Learning for Healthcare IoT (XFL-Gateway)

[![Flower](https://img.shields.io/badge/Federated%20Learning-Flower%20(flwr)-FF6F00?style=for-the-badge&logo=flower)](https://flower.ai/)
[![FastAPI](https://img.shields.io/badge/Edge%20API-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Clinical%20Dashboard-Next.js%2014-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Docker Compose](https://img.shields.io/badge/Orchestration-Docker%20Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> A production-ready, privacy-preserving IoMT (Internet of Medical Things) clinical decision support platform simulating a decentralized healthcare network. Powered by **Federated Averaging (FedAvg)** over gRPC and **Localized SHAP (SHapley Additive exPlanations)** for zero-data-leakage diagnostics.

---

## Architecture Overview

```
                          ┌────────────────────────────────────────┐
                          │       Flower Federated Server          │
                          │        (FedAvg over gRPC :8080)        │
                          │   Aggregates model weights per round   │
                          └───────────────────┬────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │ gRPC Synced Tensor Weights                        │ gRPC Synced Tensor Weights
                    ▼                                                   ▼
     ┌─────────────────────────────┐                     ┌─────────────────────────────┐
     │   Hospital A (Edge Node)    │                     │   Hospital B (Edge Node)    │
     │   FastAPI Gateway :8001     │                     │   FastAPI Gateway :8002     │
     │ ─────────────────────────── │                     │ ─────────────────────────── │
     │ • Local SQLite (local_vitals)│                     │ • Local SQLite (local_vitals)│
     │ • Flower NumPyClient Thread │                     │ • Flower NumPyClient Thread │
     │ • Synced Model: local_model │                     │ • Synced Model: local_model │
     │ • Local SHAP LinearExplainer│                     │ • Local SHAP LinearExplainer│
     └──────────────┬──────────────┘                     └──────────────┬──────────────┘
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              │ HTTP POST /predict (CORS Enabled)
                                              ▼
                          ┌────────────────────────────────────────┐
                          │    Decentralized Clinical Dashboard    │
                          │     Next.js 14 • Tailwind • Recharts   │
                          │         Browser Client (:3000)         │
                          └────────────────────────────────────────┘
```

---

## Core Capabilities

- **Zero Raw Data Leakage (HIPAA-Ready Simulation):** Patient records never leave the hospital's local edge database. Only aggregated model weights (coefficients and bias terms) are communicated with the central aggregator over gRPC.
- **Federated Averaging (FedAvg):** Coordinated cross-silo training runs asynchronously in background daemon threads across participating edge nodes (`Hospital_A` and `Hospital_B`).
- **Edge-Native Explainable AI (SHAP):** Local feature attribution computed inside the hospital firewall using `shap.LinearExplainer` against a localized reference distribution ($N=50$ samples), yielding exact log-odds risk shifts.
- **Hospital-Grade Telemetry Dashboard:** A light-mode clinical UI featuring responsive two-column medical telemetry inputs, clinical boundary validation, and a custom Recharts waterfall plot with precise risk attribution deltas.
- **Dynamic Node Switching:** Clinicians can toggle seamlessly between Hospital A (Cardiology Center) and Hospital B (General Medicine) to benchmark localized model performance in real time.

---

## Project Structure

```text
xfl-IoMT_Clinical_Decision_Gateway/
├── .gitignore
├── README.md
├── docker-compose.yml              # Multi-container network orchestrator
├── aggregator/                     # Central Flower FL Coordinator
│   ├── Dockerfile
│   ├── requirements.txt
│   └── server.py                   # FedAvg strategy (Port 8080)
├── edge_node/                      # Decentralized Hospital Edge Services
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── db_setup.py                 # SQLite synthetic medical dataset generator
│   └── client_api.py               # FastAPI + Flower Client + SHAP engine (Port 8000)
└── frontend/                       # Clinical Decision Support Interface
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── next.config.js
    └── src/
        └── app/
            ├── globals.css
            ├── layout.tsx
            └── page.tsx            # Full-scale interactive clinical gateway UI
```

---

## Physiological Telemetry Specification

The clinical gateway evaluates seven core cardiovascular indicators scaled to real-world physiological ranges:

| Telemetry Parameter | Unit | Type | Clinical Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Age** | `Years` | Continuous | $1 - 120$ | Patient age in completed years |
| **Resting BP** | `mmHg` | Continuous | $50 - 250$ | Systolic blood pressure at admission |
| **Cholesterol** | `mg/dL` | Continuous | $80 - 600$ | Serum cholesterol level |
| **Max Heart Rate** | `bpm` | Continuous | $40 - 220$ | Maximum heart rate achieved under exercise |
| **ST Depression** | `mm` | Continuous | $0.0 - 10.0$ | Exercise-induced ST segment depression on ECG |
| **Chest Pain Type** | `Enum` | Categorical | Types $0 - 3$ | $0$: Typical, $1$: Atypical, $2$: Non-Anginal, $3$: Asymptomatic |
| **Exercise Induced Angina** | `Binary` | Discrete | $0$ or $1$ | $0$: Absent (Negative), $1$: Present (Positive) |

---

## Quick Start (Docker Compose)

The easiest way to run the entire decoupled stack is with Docker Compose. Zero local dependencies (Node.js or Python) are required on your host machine.

### 1. Clone the Repository
```bash
git clone https://github.com/vinamrachandak99-dotcom/xfl-IoMT_Clinical_Decision_Gateway.git
cd xfl-IoMT_Clinical_Decision_Gateway
```

### 2. Launch All Services
```bash
docker compose up --build
```

This provisions:
- **Flower Aggregator:** `localhost:8080` (gRPC coordination server)
- **Hospital A Node:** `http://localhost:8001` (FastAPI + Flower Client)
- **Hospital B Node:** `http://localhost:8002` (FastAPI + Flower Client)
- **Clinical Dashboard:** `http://localhost:3000` (Next.js Application)

### 3. Access the Dashboard
Open your browser and navigate to:
```
http://localhost:3000
```

---

## API Reference (Edge Nodes)

Each edge node exposes high-performance REST endpoints on its assigned port (`8001` for Hospital A, `8002` for Hospital B):

### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "node": "Hospital_A",
  "model_trained": true
}
```

### Execute Clinical Assessment & Local SHAP
```http
POST /predict
Content-Type: application/json
```
**Request Body:**
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
  "risk_probability": 0.870,
  "baseline_expected_value": 0.299,
  "shap_contributions": [
    { "feature": "Age", "value": 0.60 },
    { "feature": "RestingBP", "value": -0.08 },
    { "feature": "Cholesterol", "value": -1.10 },
    { "feature": "MaxHR", "value": -0.55 },
    { "feature": "ST_Depression", "value": -0.08 },
    { "feature": "ChestPain_Type", "value": 3.42 },
    { "feature": "ExerciseAngina", "value": -0.72 }
  ]
}
```

---

## Local Development (Optional)

If you prefer developing the frontend outside Docker:

```bash
cd frontend
npm install
npm run dev
```

The Next.js development server will start on `http://localhost:3000` and communicate directly with your running edge containers.

---

## Privacy & Security Model

1. **Isolation by Design:** Each hospital container runs an independent SQLite instance (`local_vitals.db`). No shared volumes or cross-node database access is permitted.
2. **Gradient/Weight Only Sync:** The Flower server receives strictly model weights (1D and 2D floating-point arrays representing coefficients and intercepts). No raw records, identifiers, or patient telemetry are ever transmitted.
3. **Local Explainability:** SHAP values are calculated entirely on the edge node using local background samples, safeguarding patient privacy against model inversion attacks.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.