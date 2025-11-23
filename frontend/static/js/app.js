// Frontend logic: Web Speech API (SpeechRecognition) + speechSynthesis + fetch to backend
const convEl = document.getElementById("conversation");
const form = document.getElementById("chat-form");
const input = document.getElementById("text-input");
const sendBtn = document.getElementById("send-btn");
const voiceBtn = document.getElementById("voice-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

let sessionId = null;
let recognizing = false;
let recognition = null;

// Initialize SpeechRecognition (Web Speech API)
if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
  statusEl.textContent = "ASR not supported in this browser. Use Chrome/Edge.";
} else {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    recognizing = true;
    statusEl.textContent = "Listening... (speak now)";
    voiceBtn.classList.add("active");
  };
  recognition.onerror = (evt) => {
    recognizing = false;
    console.warn("ASR error", evt);
    statusEl.textContent = "ASR Error: " + (evt.error || "unknown");
    voiceBtn.classList.remove("active");
  };
  recognition.onend = () => {
    recognizing = false;
    voiceBtn.classList.remove("active");
    statusEl.textContent = "";
  };
  recognition.onresult = (evt) => {
    let transcript = "";
    for (let i=0;i<evt.results.length;i++){
      transcript += evt.results[i][0].transcript;
    }
    input.value = transcript;
  };
}

function appendMessage(role, text){
  const div = document.createElement("div");
  div.className = "message " + (role==="user" ? "user":"bot");
  div.textContent = text;
  convEl.appendChild(div);
  convEl.scrollTop = convEl.scrollHeight;
}

async function sendMessage(msg){
  if (!msg || !msg.trim()) {
    statusEl.textContent = "ASR Error: empty message";
    return;
  }
  appendMessage("user", msg);
  input.value = "";
  statusEl.textContent = "Thinking...";
  try {
    const res = await fetch("http://localhost:9080/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ session_id: sessionId, message: msg })
    });
    if (!res.ok){
      const err = await res.text();
      statusEl.textContent = "API Error: " + err;
      appendMessage("bot", "API Error: " + err);
      return;
    }
    const data = await res.json();
    sessionId = data.session_id;
    const reply = data.reply;
    appendMessage("bot", reply);
    statusEl.textContent = "";
    // speak reply using speechSynthesis
    try {
      const utter = new SpeechSynthesisUtterance(reply);
      utter.lang = "en-US";
      utter.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("TTS failed", e);
    }
  } catch (e){
    console.error(e);
    statusEl.textContent = "Network error: " + e.message;
    appendMessage("bot", "Network error: " + e.message);
  }
}

form.addEventListener("submit", (e)=>{
  e.preventDefault();
  sendMessage(input.value);
});

voiceBtn.addEventListener("click", ()=>{
  if (!recognition){
    statusEl.textContent = "ASR not available";
    return;
  }
  if (recognizing){
    recognition.stop();
    return;
  }
  try {
    recognition.start();
  } catch (e){
    console.warn("ASR start failed", e);
    statusEl.textContent = "ASR Error: " + e.message;
  }
});

resetBtn.addEventListener("click", async ()=>{
  if (!sessionId){
    statusEl.textContent = "No session to reset";
    return;
  }
  try {
    const res = await fetch("http://localhost:9080/api/reset", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ session_id: sessionId })
    });
    const j = await res.json();
    sessionId = null;
    appendMessage("bot", "Session reset.");
    statusEl.textContent = "";
  } catch (e){
    statusEl.textContent = "Reset failed: " + e.message;
  }
});

// Simple noise detection: if user types very short messages repeatedly, nudge to clarify
let shortCount = 0;
function shortMessageHeuristic(text){
  if (text.trim().length <= 2) shortCount++; else shortCount=0;
  if (shortCount>=3){
    appendMessage("bot", "I didn't understand — could you give more details?");
    shortCount = 0;
  }
}
input.addEventListener("input", (e)=> shortMessageHeuristic(e.target.value));
