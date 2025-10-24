# Pulse - AI-Powered Emergency Intelligence Platform

> Real-time emergency incident tracking with Elasticsearch + Google Cloud AI

<img src="https://img.shields.io/badge/Elasticsearch-005571?style=for-the-badge&logo=elasticsearch&logoColor=white" /> <img src="https://img.shields.io/badge/Google_Cloud_AI-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white" /> <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" /> <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" />

---

## 🎬 Product Walkthrough
[![Demo](https://img.youtube.com/vi/z1mjh4dASW4/0.jpg)](https://youtu.be/z1mjh4dASW4)

---

## 🎯 What is Pulse?

Pulse is an intelligent emergency response platform combining:
- **Elasticsearch** - Hybrid search, geospatial analytics, real-time aggregations
- **Google Cloud AI** (Gemini 2.5 Flash + Embeddings) - NLP, semantic search, chat assistant
- **React Native** - Cross-platform mobile app (Android) with maps
- **BLE Mesh Networking** - Offline peer-to-peer incident sharing

### Key Features

💬 **Conversational AI Search** – Ask anything in plain English ("fires near me yesterday") and get instant, intelligent answers powered by hybrid search (BM25 + semantic vectors) and advanced Elasticsearch queries  
🗺️ **Interactive Maps** - Real-time incident visualization with Google Maps  
🌐 **Smart Helplines** - Web search + LLM extraction for any location worldwide  
📡 **Offline-First** - BLE mesh for incident relay when network is unavailable  
🚨 **SOS Emergency** - Emergency alerts with Twilio SMS dispatch

### Incident Types

- 🔥 Fire
- 🚨 Crime
- 🚧 Roadblock
- ⚡ Power Outage

---

## 🚀 Quick Start

### Prerequisites

- Elasticsearch Cloud account
- Google Cloud project with Vertex AI enabled
- Node.js 18+ & Python 3.10+
- Android Studio (for mobile)

### 1. Environment Setup

```bash
# Copy .example file and rename to .env
cp .example .env

# Edit .env with your credentials
# Required: Elasticsearch, Vertex AI
```

### 2. Setup Elasticsearch Indices

```bash
npm install
npx tsx scripts/setup-elastic-indices.ts
npx tsx scripts/setup-helplines-cache.ts
npx tsx scripts/setup-relay-indices.ts
```

### 3. Start Backend Service

```bash
cd pulse-ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app/main.py
```

### 4. Web App (Firebase Hosting)

```bash
cd pulse-web
npm install
npm run build
firebase deploy --only hosting
```

### 5. Mobile App (Android)

```bash
cd pulse-mobile
npm install

# Update API URL for physical devices
# pulse-mobile/src/constants/api.ts

# Build APK
cd android
./gradlew assembleDebug

# Install on device
```

**Permissions needed:** Location, Bluetooth, Nearby Devices

---

## 🏆 Elasticsearch Features Used

### Search & Queries
- Hybrid Search (BM25 + kNN vector search)
- Multi-match queries with field boosting
- Function score queries with decay functions
- Bool queries (must, should, filter clauses)
- Geo distance queries for location-based search
- Range queries and fuzzy matching
- Search result highlighting

### Aggregations
- Stats aggregations (count, min, max, avg)
- Percentile aggregations
- Date histogram aggregations
- Geohash grid aggregations for spatial clustering
- Geo centroid aggregations
- Terms aggregations
- Filter and nested aggregations

### Advanced Features
- Dense vector fields for semantic search
- Geo-point field type for geospatial queries
- Index Lifecycle Management for data retention
- Multiple indices for different data types
- Custom field mappings

---

## 🤖 Google Cloud AI Integration

### Models Used
- **Gemini 2.5 Flash**: Chat, NLP parsing, extraction
- **Gemini Embedding 001**: Semantic search vectors

### Use Cases
1. AI Chat Assistant - Conversational incident queries
2. Smart Helplines - Extract contacts from web search results
3. NLP Query Parsing - Natural language → Elasticsearch DSL
4. Safety Analysis - Incident correlation and scoring

---

## 🎨 Architecture

```
┌──────────────────────────────────────────────────┐
│         Mobile/Web App (React Native)            │
│  Report | Incidents+Map | Assistant | Helplines  │
└─────────────────┬────────────────────────────────┘
                  │ HTTP/REST
                  ▼
┌──────────────────────────────────────────────────┐
│      Pulse AI Service (Flask - Port 5001)        │
│  Chat | Search | Analytics | Helplines | SOS     │
└──────┬─────────────────┬──────────────────┬──────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│Elasticsearch│  │ Vertex AI    │  │ Twilio SMS   │
│             │  │ Gemini 2.5   │  │ (Emergency)  │
└─────────────┘  └──────────────┘  └──────────────┘
```

### Offline Mode (BLE Mesh)
```
User (no internet) → 
BLE Broadcast → 
Nearby Device (has internet) → 
Process & Store in ES → 
BLE Response back → 
Original User receives answer
```

---

## 📡 API Reference

### Core Endpoints

#### Health Check
```bash
GET /health
```

#### AI Assistant
```bash
POST /api/assistant/chat
{
  "message": "What fires happened today?",
  "location": {"lat": 37.7749, "lon": -122.4194}
}
```

#### Enhanced Assistant (Semantic Search)
```bash
POST /api/assistant/chat/enhanced
# Features: Semantic search on descriptions, safety analysis, time-aware
```

#### Smart Helplines (Web Search + LLM)
```bash
GET /api/helplines/smart?location=San Francisco, CA
# Returns: Emergency contacts with sources, 30-day cache
```

#### NLP Search
```bash
GET /api/incidents/nlp-search?q=fires near me yesterday
# Features: Multi-match, fuzzy, highlighting, function score
```

#### Safety Insights
```bash
GET /api/insights/safety-score?lat=37.7&lon=-122.4&radius=10km
GET /api/insights/trends?interval=1h&time_range=24h
GET /api/insights/hotspots?precision=5
GET /api/insights/summary
```

#### Incidents
```bash
POST /api/incidents/store    # Store new incident
GET  /api/incidents/list     # List recent incidents
GET  /api/incidents/stats    # Get statistics
```

#### Offline Relay
```bash
POST /api/relay/query        # Process relayed query
GET  /api/relay/check?query_id=xxx  # Check query status
```

---

## 📱 Mobile App Screens

1. **Home** - Dashboard with stats
2. **Report** - Submit incident reports
3. **Incidents** - List + Map view toggle
4. **Assistant** - AI chat interface
5. **Helplines** - Smart helplines search
6. **Mesh** - BLE network status

---

## 🌐 Web App

**Features:**
- ✅ All mobile features except BLE mesh
- ✅ Responsive design (desktop/mobile)
- ✅ Real-time incident tracking
- ✅ AI assistant chat
- ✅ Smart helplines search
- ✅ Interactive Google Maps

---

## 🧪 Testing

```bash
# Setup verification
npx tsx scripts/verify-setup.ts

# API endpoint tests
npx tsx scripts/test-all-endpoints.ts

# Test individual endpoint
curl https://pulse-474o3a7wtq-uc.a.run.app/health
```

---

## 🔧 Elasticsearch Indices

### pulse-incidents
```json
{
  "report_id": "uuid",
  "report_type": "fire|crime|roadblock|power_outage",
  "title": "string",
  "description": "string",
  "location": {"lat": 12.34, "lon": 56.78},
  "text_embedding": [768-dim vector],
  "@timestamp": "ISO 8601"
}
```

### pulse-helplines-cache
```json
{
  "location": "City, State",
  "data": {"emergency": "911", "contacts": [...]},
  "sources": ["url1", "url2"],
  "expires_at": "ISO 8601",
  "cached_at": "ISO 8601"
}
```

### pulse-relay-queries
```json
{
  "query_id": "unique-id",
  "query_type": "assistant|sos",
  "status": "pending|processing|completed|failed",
  "response": "string",
  "severity": "critical|high|medium|low"
}
```

---

## 🛠️ Troubleshooting

### Web app can't connect
- Hard refresh browser (Ctrl+Shift+R)
- Check backend is running
- Verify API URL in `pulse-web/src/constants/api.ts`

### Mobile app issues
- Update IP in `pulse-mobile/src/constants/api.ts` for physical devices
- Grant all permissions (Location, Bluetooth, Phone)
- Ensure same WiFi network
- Check firewall allows port 5001

---

## 📁 Project Structure

```
pulse/
├── pulse-ai-service/        # Flask backend
│   ├── app/
│   │   ├── main.py          # API routes
│   │   ├── assistant_enhanced.py  # Semantic search assistant
│   │   ├── vertex_ai.py     # Vertex AI client
│   │   ├── elastic_client.py
│   │   ├── helplines_enhanced.py  # Web search + LLM
│   │   └── insights.py      # Analytics
│   └── requirements.txt
│
├── pulse-mobile/            # React Native Android
│   ├── android/             # APK builds
│   └── src/
│       ├── screens/         
│       ├── contexts/        # State management
│       └── components/
│
├── pulse-web/               # React Native Web
│   ├── src/                 # Shared with mobile
│   ├── dist/                # Build output
│   └── webpack.config.js
│
└── scripts/                 # Setup & testing
    ├── setup-elastic-indices.ts
    ├── setup-relay-indices.ts
    └── test-all-endpoints.ts
```

---

## 📄 License
MIT License

---

## 🖼️ UI Preview

<img width="300" src="https://github.com/user-attachments/assets/ae5aa653-51da-4457-8df5-bb17fb9ae575" >
<img width="300" src="https://github.com/user-attachments/assets/10d9f2b8-9c10-4533-841e-9aa3183c2f30" >
<img width="300" src="https://github.com/user-attachments/assets/b7fd225c-eea7-4030-942a-cc9cd4548b97" >
<img width="300" src="https://github.com/user-attachments/assets/389c0c37-2d63-4e34-be12-d83aa40c4d4d" >
<img width="300" src="https://github.com/user-attachments/assets/29816b04-b9c6-4d30-9bc6-a99c5c451cb2" >
<img width="300" src="https://github.com/user-attachments/assets/e0652f45-bf21-4c88-98ce-cba37bb33010" >
<img width="300" src="https://github.com/user-attachments/assets/2184c59e-16a3-40c0-bb98-e83146b7e080" />
<img width="3024" height="1964" alt="tg_image_2012403607" src="https://github.com/user-attachments/assets/f7e6354b-1ecd-449f-aa8b-7322a6cfeeff" />
<img width="3024" height="1964" alt="tg_image_2717638644" src="https://github.com/user-attachments/assets/b104233d-fc29-4b4b-abc0-43b182c223cc" />
<img width="3024" height="1964" alt="tg_image_2271904103" src="https://github.com/user-attachments/assets/35dc8ee7-ebce-4ac0-974d-c7f7e3256563" />
<img width="3024" height="1964" alt="tg_image_4053223420" src="https://github.com/user-attachments/assets/21f14ba7-194e-4c80-8051-7e7b8e036b54" />
<img width="3024" height="1964" alt="tg_image_4137952672" src="https://github.com/user-attachments/assets/6d64133f-ca29-4852-b45e-5c40cf333b7e" />
<img width="3024" height="1964" alt="tg_image_2954650171" src="https://github.com/user-attachments/assets/0a723c2a-5d3c-4588-afef-26cafa829a2b" />

