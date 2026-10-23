@echo off
echo ===================================================
echo Starting XFL-IoMT Clinical Decision Gateway
echo ===================================================

echo [1/3] Starting Hospital A (Cardiology) on Port 8001...
start "Hospital A - Port 8001" cmd /k "set NODE_NAME=Hospital A (Cardiology)&& set DB_NAME=hospital_a.db&& set MODEL_PATH=model_a.pkl&& set MLP_MODEL_PATH=mlp_a.pt&& set SYNC_STATE_PATH=sync_a.json&& set RANDOM_SEED=42&& python -m uvicorn edge_node.client_api:app --host 0.0.0.0 --port 8001"

echo [2/3] Starting Hospital B (General Medicine) on Port 8002...
start "Hospital B - Port 8002" cmd /k "set NODE_NAME=Hospital B (General Medicine)&& set DB_NAME=hospital_b.db&& set MODEL_PATH=model_b.pkl&& set MLP_MODEL_PATH=mlp_b.pt&& set SYNC_STATE_PATH=sync_b.json&& set RANDOM_SEED=99&& python -m uvicorn edge_node.client_api:app --host 0.0.0.0 --port 8002"

echo [3/3] Starting Next.js Dashboard on Port 3000...
start "Clinical Dashboard - Port 3000" cmd /k "cd frontend && npm run dev"

echo Waiting 5 seconds for services to initialize...
timeout /t 5 /nobreak >nul

echo Launching browser at http://localhost:3000...
start http://localhost:3000

echo ===================================================
echo All services are running!
echo To stop everything, simply run stop_all.bat
echo ===================================================
