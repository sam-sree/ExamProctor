import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import datetime
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from bayesian_scoring import BayesianScoringAgent

agent = BayesianScoringAgent()

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

class SessionCreate(BaseModel):
    candidateId: str
    testId: str

class DisqualifyPayload(BaseModel):
    answers: Optional[List[Dict[str, Any]]] = []
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
        "proctorOverride": None,
        "score": {"mcq": 0, "text": "pending"}
    }
    return {"sessionId": session_id}

@app.post("/api/session/{session_id}/submit")
async def submit_session(session_id: str, payload: Dict[str, Any]):
    if session_id not in sessions:
        sessions[session_id] = {"sessionId": session_id}
    
    # Store complete exam session state
    session_data = sessions[session_id]
    session_data.update(payload)
    session_data["endTime"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Calculate MCQ score
    mcq_score = calculate_mcq_score(session_data.get("answers", []))
    session_data["score"] = {
        "mcq": mcq_score,
        "text": "pending",
        "trustworthiness": None
    }

    # Bayesian Scoring calculation on all submissions
    warning_log = session_data.get("warningLog", [])
    shortcut_log = session_data.get("shortcutAttemptLog", [])
    
    res = agent.calculate_integrity_score(warning_log, shortcut_log, session_data)
    
    if res["cheatProbability"] > 85.0:
        session_data["disqualified"] = True
        session_data["status"] = "disqualified"
        session_data["score"]["trustworthiness"] = None
    else:
        if session_data.get("disqualified") == True:
            session_data["score"]["trustworthiness"] = None
            session_data["status"] = "disqualified"
        else:
            session_data["score"]["trustworthiness"] = res["trustworthinessScore"]
            session_data["status"] = res["classification"]
        
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
    session_data["score"] = {
        "mcq": mcq_score,
        "text": "pending",
        "trustworthiness": None
    }
    
    return {"received": True}

@app.get("/api/session/{session_id}/result")
async def get_session_result(session_id: str):
    if session_id not in sessions:
        return {"error": "Session not found"}
    return sessions[session_id]
