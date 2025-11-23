AI Assistant using Gemini LLM + Browser Speech (Speech-to-Text & Text-to-Speech)

Structure:
- backend/main.py       -> FastAPI backend with /api/chat and /api/reset
- frontend/index.html   -> Single-page UI (Web Speech API + fetch to backend)
- static/js/app.js      -> Frontend JS
- static/css/styles.css -> Styling with hover + transitions

Setup (local, no Docker):
1. Install Python 3.10+ and create a venv
   python -m venv venv
   source venv/bin/activate   # or venv\Scripts\activate on Windows
2. Install backend deps:
   pip install -r backend/requirements.txt
3. Set environment variable:
   export GEMINI_API_KEY="YOUR_API_KEY"   # or set in system env on Windows
4. Run backend:
   uvicorn backend.main:app --host 0.0.0.0 --port 9080
5. Open frontend/index.html in Chrome (Web Speech API works best in Chromium-based browsers).

Notes:
- The backend uses google-genai SDK. See Google Gemini docs for authentication and model names.
- This project stores session memory in-process (simple dict). For production use Redis or DB.
