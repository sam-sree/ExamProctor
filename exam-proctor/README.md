# Exam Proctoring Web Application

This project is a fully browser-based exam proctoring module designed to run in modern browsers (Chrome 110+). It features a local React frontend and a FastAPI backend running OpenCV and MediaPipe for server-side computer vision validation.

## Architecture

The system uses a strict three-layer architecture:

```
React SPA (Browser)
│
├── Exam UI (screens, components)
├── Zustand stores (examStore, proctoringStore)
├── Browser event monitors (visibility, focus, fullscreen, keyboard)
├── Webcam capture (getUserMedia + canvas frame extraction)
├── Audio monitor (Web Audio API, AnalyserNode)
└── WebSocket client (receives CV events, sends frames)
         │
         ▼ ws://localhost:8000/ws/proctor/{sessionId}
FastAPI Backend
│
├── WebSocket endpoint (receives frames, dispatches to CV pipeline)
├── REST endpoints (session create, submit, admin notify)
└── CV pipeline (Python, OpenCV, MediaPipe) — server-side only
```

### 1. React SPA
- **Screens**: Handles onboarding (`Landing.jsx`), mic check (`MicSetup.jsx`), camera/bluetooth setup (`CameraSetup.jsx`), screen share setup (`ScreenShareSetup.jsx`), candidate instructions (`Briefing.jsx`), the exam screen (`Exam.jsx`), disqualification overlay (`Disqualified.jsx`), and final dashboard report (`Results.jsx`).
- **Zustand State**: Synchronizes answers, exam status, snapshots, and proctoring warnings.
- **Audio Monitor Hook**: Implements highpass/lowpass filters, noise calibration, and speech threshold checking entirely in-browser.
- **Browser Event Monitors**: Hooks page visibility, window focus/blur, paste intercepts, keydown locks, and beforeunload handlers.
- **Fullscreen Blocker Component**: Intercepts fullscreen exit, pauses active question timers, and forces re-entry.

### 2. FastAPI Backend
- **REST Endpoints**:
  - `POST /api/session/create`: Initiates candidate test session.
  - `POST /api/session/{sessionId}/submit`: Receives final answers, logs, and computes MCQ score.
  - `POST /api/session/{sessionId}/disqualify`: Updates status to disqualified and registers logs.
  - `GET /api/session/{sessionId}/result`: Serves results.
- **WebSocket Endpoint**:
  - `WS /ws/proctor/{sessionId}`: Listens to incoming 15fps JPEG base64 video frames, feeds them to MediaPipe, and streams back CV events (gaze, face absent, multiple faces, etc.) to the browser.

---

## Getting Started

### Backend Setup
1. Install Python 3.10+ dependencies:
   ```bash
   pip install -r python/requirements.txt
   ```
2. Start the FastAPI server (runs by default on `http://127.0.0.1:8000`):
   ```bash
   python -m uvicorn python.main:app --reload
   ```

### Frontend Setup
1. Install node packages:
   ```bash
   npm install
   ```
2. Start both Vite and FastAPI concurrently:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
