import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import base64
import datetime
import uuid
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from cv_pipeline import CVPipeline

app = FastAPI()

# Enable CORS for the React development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database for sessions
sessions: Dict[str, Dict[str, Any]] = {}

# Active CV pipeline instances mapped by session_id
cv_pipelines: Dict[str, CVPipeline] = {}

class SessionCreate(BaseModel):
    candidateId: str
    testId: str

class DisqualifyPayload(BaseModel):
    warningLog: List[Dict[str, Any]]
    webcamSnapshotLog: List[Dict[str, Any]]
    shortcutAttemptLog: List[Dict[str, Any]]
    multiMonitorSuspected: bool
    bluetoothDeviceDetected: bool

def calculate_mcq_score(answers: List[Dict[str, Any]]) -> int:
    # Correct answer indices for questions 1-5
    correct_answers = {1: 1, 2: 2, 3: 2, 4: 3, 5: 1}
    mcq_score = 0
    for ans in answers:
        q_id = ans.get("questionId")
        if q_id in correct_answers:
            # Mark the correctness
            is_correct = ans.get("answer") == correct_answers[q_id]
            ans["isCorrect"] = is_correct
            if is_correct:
                mcq_score += 1
    return mcq_score

@app.post("/api/session/create")
async def create_session(payload: SessionCreate):
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "sessionId": session_id,
        "candidateId": payload.candidateId,
        "testId": payload.testId,
        "startTime": datetime.datetime.utcnow().isoformat() + "Z",
        "endTime": None,
        "status": "setup",
        "answers": [],
        "webcamSnapshotLog": [],
        "shortcutAttemptLog": [],
        "warningLog": [],
        "logOnlyEvents": [],
        "multiMonitorSuspected": False,
        "bluetoothDeviceDetected": False,
        "detectedBluetoothDevices": [],
        "disqualified": False,
        "score": {"mcq": 0, "text": "pending"}
    }
    # Instantiate the CV pipeline for this session
    cv_pipelines[session_id] = CVPipeline()
    return {"sessionId": session_id}

@app.post("/api/session/{session_id}/submit")
async def submit_session(session_id: str, payload: Dict[str, Any]):
    if session_id not in sessions:
        sessions[session_id] = {"sessionId": session_id}
    
    # Store complete exam session state
    session_data = sessions[session_id]
    session_data.update(payload)
    session_data["status"] = "submitted"
    session_data["endTime"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Calculate MCQ score
    mcq_score = calculate_mcq_score(session_data.get("answers", []))
    session_data["score"] = {"mcq": mcq_score, "text": "pending"}
    
    # Clean up the CV pipeline
    if session_id in cv_pipelines:
        del cv_pipelines[session_id]
        
    return {"received": True}

@app.post("/api/session/{session_id}/disqualify")
async def disqualify_session(session_id: str, payload: DisqualifyPayload):
    if session_id not in sessions:
        sessions[session_id] = {"sessionId": session_id}
        
    session_data = sessions[session_id]
    session_data.update(payload.dict())
    session_data["status"] = "disqualified"
    session_data["disqualified"] = True
    session_data["endTime"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Calculate MCQ score just in case they have answers
    mcq_score = calculate_mcq_score(session_data.get("answers", []))
    session_data["score"] = {"mcq": mcq_score, "text": "pending"}
    
    # Clean up the CV pipeline
    if session_id in cv_pipelines:
        del cv_pipelines[session_id]
        
    return {"received": True}

@app.get("/api/session/{session_id}/result")
async def get_session_result(session_id: str):
    if session_id not in sessions:
        return {"error": "Session not found"}
    return sessions[session_id]

@app.websocket("/ws/proctor/{session_id}")
async def proctor_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"[WS] Connection accepted for session: {session_id}")
    
    # Retrieve or create CV pipeline for this connection
    if session_id not in cv_pipelines:
        cv_pipelines[session_id] = CVPipeline()
    cv_pipeline = cv_pipelines[session_id]
    
    # Initialize session database entry if not exists
    if session_id not in sessions:
        sessions[session_id] = {
            "sessionId": session_id,
            "candidateId": "unknown",
            "testId": "unknown",
            "startTime": datetime.datetime.utcnow().isoformat() + "Z",
            "endTime": None,
            "status": "setup",
            "answers": [],
            "webcamSnapshotLog": [],
            "shortcutAttemptLog": [],
            "warningLog": [],
            "logOnlyEvents": [],
            "multiMonitorSuspected": False,
            "bluetoothDeviceDetected": False,
            "detectedBluetoothDevices": [],
            "disqualified": False,
            "score": {"mcq": 0, "text": "pending"}
        }
    
    try:
        # Send system ready event
        await websocket.send_json({
            "type": "SYSTEM",
            "event": "READY",
            "message": "FastAPI proctor service ready."
        })
        print(f"[WS] Sent READY event to session: {session_id}")
        
        async for message in websocket.iter_json():
            if message.get("type") == "FRAME":
                try:
                    data_str = message.get("data")
                    if not data_str:
                        print("[WS] Received FRAME message with no data field")
                        continue
                        
                    # Decode base64 frame
                    frame_bytes = base64.b64decode(data_str)
                    np_arr = np.frombuffer(frame_bytes, np.uint8)
                    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                    
                    if frame is None:
                        print("[WS] Failed to decode image frame")
                        await websocket.send_json({
                            "type": "SYSTEM",
                            "event": "CAMERA_ERROR",
                            "message": "Failed to decode frame"
                        })
                        continue
                        
                    # Process frame in pipeline
                    events = cv_pipeline.process_frame(frame)
                    if events:
                        print(f"[WS] CV events generated: {events}")
                    for event in events:
                        await websocket.send_json(event)
                        
                except Exception as e:
                    print(f"[WS] Error processing frame: {e}")
                    await websocket.send_json({
                        "type": "SYSTEM",
                        "event": "CAMERA_ERROR",
                        "message": f"Processing error: {str(e)}"
                    })
                    
    except WebSocketDisconnect:
        print(f"[WS] WebSocket disconnected cleanly for session {session_id}")
    except Exception as e:
        print(f"[WS] Unexpected error in websocket loop: {e}")

