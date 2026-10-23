# Evidence Capture Guide & Demonstration Procedures
**Project:** Explainable Federated Learning for Healthcare IoT Applications (XFL-Gateway)  
**Context:** B.Tech CSE IDEA Lab, Ramdeobaba University

This document outlines the step-by-step procedure to launch the system and capture live evidence for seminar presentations and viva defense.

---

## 1. Quick Launch Options

### Option A: Complete Docker Compose Network (Production Simulation)
```bash
docker compose up --build
```
This automatically provisions:
- **Flower Federated Aggregator:** `localhost:8080` (gRPC coordination server)
- **Hospital A Node (Cardiology):** `http://localhost:8001` (FastAPI + Flower Client)
- **Hospital B Node (General Medicine):** `http://localhost:8002` (FastAPI + Flower Client)
- **Clinical Dashboard:** `http://localhost:3000` (Next.js Application)

### Option B: Local Standalone Development (Host-Native)
If Docker daemon is unavailable:
1. **Start Aggregator:**
   ```bash
   cd aggregator
   python server.py
   ```
2. **Start Hospital A (Terminal 2):**
   ```bash
   cd edge_node
   $env:NODE_NAME="Hospital_A"; $env:FLOWER_SERVER="127.0.0.1:8080"; uvicorn client_api:app --host 0.0.0.0 --port 8001
   ```
3. **Start Hospital B (Terminal 3):**
   ```bash
   cd edge_node
   $env:NODE_NAME="Hospital_B"; $env:FLOWER_SERVER="127.0.0.1:8080"; uvicorn client_api:app --host 0.0.0.0 --port 8002
   ```
4. **Start Frontend (Terminal 4):**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 2. Screenshot Capture Checklist

### Screenshot 1: Single Node Clinical Assessment (Default Linear Model)
1. Open browser at `http://localhost:3000`.
2. Ensure **"Logistic Regression"** model toggle is active and Target Node is **Hospital A (Cardiology :8001)**.
3. Click **"Execute Single Node Assessment (Linear)"**.
4. Capture screenshot showing:
   - Primary diagnostic decision card (**HIGH CARDIAC RISK** / **NORMAL RISK PROFILE**).
   - Posterior probability % vs. Local Baseline expectation $E[f(x)]$.
   - The Recharts horizontal SHAP waterfall bar chart with red risk drivers and green protective factors.
   - The bottom telemetry bar showing exact inference latency (e.g. ~4.8 ms), SHAP latency (~1.7 ms), and cohort size ($N=50$).

### Screenshot 2: Model Architecture Toggle (PyTorch MLP)
1. Click the **"PyTorch MLP"** toggle button in the top navigation bar.
2. Click **"Execute Single Node Assessment (MLP)"**.
3. Capture screenshot showing:
   - Badge updating to **MODEL: MLP (PYTORCH)**.
   - Updated non-linear posterior probability and deep SHAP feature attributions.
   - Measured neural forward pass inference time.

### Screenshot 3: Cross-Silo Comparison Action
1. Click the blue action button:
   **"Compare Nodes (Cardiology vs. General Medicine)"**.
2. Capture screenshot showing:
   - The side-by-side dual-node layout.
   - Left column: **Hospital A (Cardiology)** with its localized baseline risk.
   - Right column: **Hospital B (General Medicine)** with its localized baseline risk.
   - Side-by-side SHAP waterfall plots illustrating how the identical patient's risk is perceived differently across the two hospital cohorts due to baseline population skew.
   - The informational banner explaining data isolation and zero raw data leakage.

### Screenshot 4: Automated Test & Evaluation Verification
1. Open terminal and run:
   ```bash
   pytest tests/test_xfl_gateway.py -v
   ```
2. Capture terminal screenshot showing **8 passed** tests.
3. Run the research evaluation harness:
   ```bash
   python evaluate.py
   ```
4. Capture terminal screenshot displaying the summary metrics and generated evidence artifacts in `evidence/`.

---

## 3. Directory of Generated Evidence Files

| File | Type | Description |
| :--- | :--- | :--- |
| `evidence/evaluation_results.json` | JSON | Complete empirical benchmark: accuracy, precision, recall, F1, ROC-AUC, confusion matrices, cold/warm latencies, consistency metrics. |
| `evidence/model_comparison.csv` | CSV | Tabular summary comparing Logistic Regression (FedAvg) vs. PyTorch MLP. |
| `evidence/roc_curves.png` | Plot | ROC curve plot comparing global linear FedAvg vs. PyTorch MLP on the held-out test cohort. |
| `evidence/shap_waterfall_comparison.png` | Plot | Side-by-side attribution plot illustrating cross-silo explanation variations for the same patient. |
| `evidence/pytest_run.log` | Log | Verifiable execution log of all 8 automated functional and integration tests. |
