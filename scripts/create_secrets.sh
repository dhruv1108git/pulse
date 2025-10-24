#!/bin/bash
# Upload all secrets from .env file to Google Cloud Secret Manager

if [ ! -f .env ]; then
  echo "❌ Error: .env file not found!"
  echo "📝 Create one using: cp env-template.txt .env"
  echo "Then fill in your actual values."
  exit 1
fi

echo "🔐 Uploading secrets to Google Cloud Secret Manager..."

while IFS='=' read -r key value; do
  # Skip empty lines, comments, and lines with just whitespace
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  
  # Remove leading/trailing whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Skip if value is placeholder
  [[ "$value" == *"your-"* || "$value" == *"-here"* ]] && continue
  
  # Skip VERTEX_AI variables (these go as env vars, not secrets)
  [[ "$key" == "VERTEX_AI_PROJECT_ID" || "$key" == "VERTEX_AI_LOCATION" ]] && continue
  
  echo "  Creating secret: $key"
  
  # Create the secret (ignore error if it already exists)
  gcloud secrets create "$key" --replication-policy="automatic" 2>/dev/null || true
  
  # Add a version with the value
  echo -n "$value" | gcloud secrets versions add "$key" --data-file=-
  
  echo "  ✅ $key uploaded"
done < .env

echo ""
echo "✅ All secrets uploaded to Secret Manager!"
echo "🚀 Now run: ./deploy-cloud-run.sh to deploy your service"
