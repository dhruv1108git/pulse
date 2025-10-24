# Pulse AI Service - Production Dockerfile for Google Cloud Run
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/app
ENV FLASK_APP=app/main.py
# Cloud Run will set PORT automatically (8080)

# Expose port (Cloud Run ignores this but good for documentation)
EXPOSE 8080

# Run the application with Gunicorn
# Gunicorn is a production-ready WSGI server that's more robust than Flask's built-in server
# Cloud Run sets the PORT environment variable, which Gunicorn will automatically use
CMD exec gunicorn --workers 1 --threads 8 --timeout 0 -b "0.0.0.0:${PORT:-8080}" --chdir /app/app "main:app"


