FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for document processing + Node.js for frontend build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc libffi-dev curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy frontend and build it
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ .
RUN npm run build

# Copy API code
WORKDIR /app
COPY api/ api/
COPY data/ data/

# Ensure upload/processed directories exist
RUN mkdir -p data/uploads data/processed

EXPOSE 5002

# Flask will serve the built frontend from frontend/dist
CMD ["gunicorn", "--bind", "0.0.0.0:5002", "--workers", "2", "--timeout", "120", "api.app:app"]
