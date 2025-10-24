#!/bin/bash
# Deploy Pulse AI Service to Cloud Run with all environment variables and secrets

echo "🚀 Deploying Pulse AI Service to Cloud Run..."

# Check if .env exists to get VERTEX_AI values
if [ -f .env ]; then
  source .env
  PROJECT_ID=${VERTEX_AI_PROJECT_ID:-mlops-474023}
  LOCATION=${VERTEX_AI_LOCATION:-us-central1}
else
  PROJECT_ID="mlops-474023"
  LOCATION="us-central1"
fi

echo "📦 Project: $PROJECT_ID"
echo "📍 Region: $LOCATION"
echo ""
echo "🔍 Discovering all secrets in Secret Manager..."

# Get all secrets from Secret Manager by reading the .env file
SECRETS=""
SECRET_COUNT=0

if [ ! -f .env ]; then
  echo "  ⚠️  .env file not found. Cannot determine which secrets to mount."
  exit 1
fi

# Exclude these keys because they are handled as explicit environment variables
EXCLUDED_KEYS=(
  "VERTEX_AI_PROJECT_ID"
  "VERTEX_AI_LOCATION"
  "ELASTIC_INCIDENTS_INDEX"
  "ELASTIC_DISPATCH_LOG_INDEX"
  "VERTEX_AI_EMBEDDING_MODEL"
  "VERTEX_AI_LLM_MODEL"
  "DEMO_PHONE_NUMBER"
)

while IFS='=' read -r key value; do
  # Skip empty lines, comments, and lines with just whitespace
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  
  # Remove leading/trailing whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  # Skip if value is a placeholder
  if [[ "$value" == *"your-"* || "$value" == *"-here"* || -z "$value" ]]; then
      continue
  fi

  # Check if the key is in the excluded list
  is_excluded=false
  for excluded_key in "${EXCLUDED_KEYS[@]}"; do
    if [[ "$key" == "$excluded_key" ]]; then
      is_excluded=true
      break
    fi
  done
  
  if [ "$is_excluded" = true ]; then
    continue
  fi

  # Check if the secret exists in Secret Manager
  if gcloud secrets describe $key --project=$PROJECT_ID &>/dev/null; then
    if [ -z "$SECRETS" ]; then
      SECRETS="$key=$key:latest"
    else
      SECRETS="$SECRETS,$key=$key:latest"
    fi
    echo "  ✅ Including secret: $key"
    ((SECRET_COUNT++))
  else
    echo "  🔸 Skipping: Secret '$key' not found in Secret Manager."
  fi
done < .env

if [ $SECRET_COUNT -eq 0 ]; then
  echo "  ⚠️  No secrets found to mount! Run ./scripts/create_secrets.sh first"
  exit 1
fi

echo ""
echo "📊 Found $SECRET_COUNT secret(s)"
echo ""

# Build environment variables list from .env (for non-secret configs)
ENV_VARS="VERTEX_AI_PROJECT_ID=$PROJECT_ID,VERTEX_AI_LOCATION=$LOCATION"

if [ -f .env ]; then
  # Add optional environment variables if set in .env
  if [ ! -z "$ELASTIC_INCIDENTS_INDEX" ]; then
    ENV_VARS="$ENV_VARS,ELASTIC_INCIDENTS_INDEX=$ELASTIC_INCIDENTS_INDEX"
    echo "  ℹ️  Using custom index: $ELASTIC_INCIDENTS_INDEX"
  fi
  
  if [ ! -z "$ELASTIC_DISPATCH_LOG_INDEX" ]; then
    ENV_VARS="$ENV_VARS,ELASTIC_DISPATCH_LOG_INDEX=$ELASTIC_DISPATCH_LOG_INDEX"
    echo "  ℹ️  Using custom dispatch log index: $ELASTIC_DISPATCH_LOG_INDEX"
  fi
  
  if [ ! -z "$VERTEX_AI_EMBEDDING_MODEL" ]; then
    ENV_VARS="$ENV_VARS,VERTEX_AI_EMBEDDING_MODEL=$VERTEX_AI_EMBEDDING_MODEL"
    echo "  ℹ️  Using custom embedding model: $VERTEX_AI_EMBEDDING_MODEL"
  fi
  
  if [ ! -z "$VERTEX_AI_LLM_MODEL" ]; then
    ENV_VARS="$ENV_VARS,VERTEX_AI_LLM_MODEL=$VERTEX_AI_LLM_MODEL"
    echo "  ℹ️  Using custom LLM model: $VERTEX_AI_LLM_MODEL"
  fi
  
  if [ ! -z "$DEMO_PHONE_NUMBER" ]; then
    ENV_VARS="$ENV_VARS,DEMO_PHONE_NUMBER=$DEMO_PHONE_NUMBER"
    echo "  ℹ️  Using demo phone: $DEMO_PHONE_NUMBER"
  fi
fi

echo ""
echo "🏗️  Deploying service to Cloud Run..."
echo ""

gcloud run deploy pulse \
  --source ./pulse-ai-service \
  --region $LOCATION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars $ENV_VARS \
  --set-secrets $SECRETS \
  --service-account 181417343327-compute@developer.gserviceaccount.com

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment complete!"
  echo "🔗 Your service URL: https://pulse-181417343327.$LOCATION.run.app"
  echo ""
  echo "🧪 Test with:"
  echo "   curl https://pulse-181417343327.$LOCATION.run.app/health"
  echo ""
else
  echo ""
  echo "❌ Deployment failed. Check logs above for errors."
  exit 1
fi
