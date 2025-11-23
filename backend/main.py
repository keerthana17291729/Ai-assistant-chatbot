from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, uuid

# Gemini SDK (google-genai)
try:
    from google import genai
except Exception:
    genai = None

API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="AI Assistant (Gemini + Speech)")

# -------------------------------
# ENABLE CORS (fixes OPTIONS 405)
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],             # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# SIMPLE IN-MEMORY SESSION STORE
# -------------------------------
sessions = {}

# -------------------------------
# REQUEST / RESPONSE MODELS
# -------------------------------
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    error: Optional[str] = None

# -------------------------------
# GEMINI CLIENT
# -------------------------------
def get_client():
    if genai is None:
        raise RuntimeError("google-genai SDK not installed. Run: pip install google-genai")

    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set in environment")

    return genai.Client()  # Reads GEMINI_API_KEY internally

# -------------------------------
# /api/chat  → main chat handler
# -------------------------------
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: Request):
    # Read raw JSON safely (prevents 422 errors)
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    session_id = data.get("session_id") or str(uuid.uuid4())
    message = data.get("message")

    if not message or not str(message).strip():
        raise HTTPException(status_code=400, detail="Empty message")

    # Retrieve session history
    history = sessions.setdefault(session_id, [])
    history.append({"role": "user", "content": message})

    # System prompt + context
    system_prompt = (
        "You are a helpful AI assistant. "
        "Keep answers concise. Ask clarifying questions when needed."
    )

    try:
        client = get_client()

        # Build prompt text
        prompt = "\n".join([f"{h['role']}: {h['content']}" for h in history[-10:]])
        final_prompt = system_prompt + "\n" + prompt

        # Gemini API call
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=final_prompt
        )

        reply_text = getattr(response, "text", None) or str(response)

    except Exception as e:
        reply_text = f"ASR/API Error: Failed to get response from Gemini → {e}"
        return ChatResponse(session_id=session_id, reply=reply_text, error=str(e))

    # Add assistant message to session
    history.append({"role": "assistant", "content": reply_text})
    sessions[session_id] = history

    return ChatResponse(
        session_id=session_id,
        reply=reply_text,
        error=None
    )

# -------------------------------
# /api/reset  → session memory reset
# -------------------------------
@app.post("/api/reset")
async def reset(request: Request):
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    sid = data.get("session_id")
    if not sid:
        raise HTTPException(status_code=400, detail="session_id required")

    sessions.pop(sid, None)
    return {"status": "ok", "session_id": sid}
