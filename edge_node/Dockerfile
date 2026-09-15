FROM python:3.9-slim

WORKDIR /app

# Install build dependencies that may be needed for some native wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY db_setup.py client_api.py ./

EXPOSE 8000

CMD ["uvicorn", "client_api:app", "--host", "0.0.0.0", "--port", "8000"]
