import cv2
import mediapipe as mp
import time
import datetime
from face_detector import analyze_faces
from gaze_tracker import check_gaze_and_pose

class CVPipeline:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=3,
            refine_landmarks=True,
            min_detection_confidence=0.8,
            min_tracking_confidence=0.6
        )
        self.face_absent_start_time = None
        self.multiple_faces_start_time = None
        self.gaze_deviation_start_time = None
        self.last_face_event = None
        self.last_gaze_event = None

    def process_frame(self, frame):
        events = []
        now = time.time()
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.mp_face_mesh.process(rgb_frame)

        face_res = analyze_faces(results.multi_face_landmarks)

        if face_res["event"] == "FACE_ABSENT":
            self.multiple_faces_start_time = None
            self.face_absent_start_time = None
            if self.last_face_event != "FACE_ABSENT":
                events.append({
                    "type": "CV_EVENT",
                    "event": "FACE_ABSENT",
                    "confidence": face_res["confidence"],
                    "metadata": face_res.get("metadata", {}),
                    "timestamp": timestamp
                })
                self.last_face_event = "FACE_ABSENT"

        elif face_res["event"] == "MULTIPLE_FACES":
            self.face_absent_start_time = None
            self.multiple_faces_start_time = None
            if self.last_face_event != "MULTIPLE_FACES":
                events.append({
                    "type": "CV_EVENT",
                    "event": "MULTIPLE_FACES",
                    "confidence": face_res["confidence"],
                    "metadata": face_res.get("metadata", {}),
                    "timestamp": timestamp
                })
                self.last_face_event = "MULTIPLE_FACES"

        else:  # FACE_NOMINAL
            self.face_absent_start_time = None
            self.multiple_faces_start_time = None
            if self.last_face_event != "FACE_NOMINAL":
                if self.last_face_event in ("FACE_ABSENT", "MULTIPLE_FACES"):
                    events.append({
                        "type": "CV_EVENT",
                        "event": "FACE_DETECTED",
                        "confidence": face_res["confidence"],
                        "timestamp": timestamp
                    })
                events.append({
                    "type": "CV_EVENT",
                    "event": "FACE_NOMINAL",
                    "confidence": face_res["confidence"],
                    "metadata": face_res.get("metadata", {}),
                    "timestamp": timestamp
                })
                self.last_face_event = "FACE_NOMINAL"

        # Gaze / Pose Logic
        valid_faces = face_res.get("faces", [])
        if len(valid_faces) == 1:
            gaze_res = check_gaze_and_pose(valid_faces[0], 640, 480)

            if gaze_res["event"] in ["GAZE_DEVIATION", "HEAD_POSE_VIOLATION"]:
                if self.gaze_deviation_start_time is None:
                    self.gaze_deviation_start_time = now
                elif now - self.gaze_deviation_start_time >= 3.0:
                    if self.last_gaze_event != gaze_res["event"]:
                        events.append({
                            "type": "CV_EVENT",
                            "event": gaze_res["event"],
                            "confidence": gaze_res["confidence"],
                            "metadata": gaze_res.get("metadata", {}),
                            "timestamp": timestamp
                        })
                        self.last_gaze_event = gaze_res["event"]
            else:  # GAZE_NOMINAL
                self.gaze_deviation_start_time = None
                if self.last_gaze_event != "GAZE_NOMINAL" and self.last_gaze_event is not None:
                    events.append({
                        "type": "CV_EVENT",
                        "event": "GAZE_NOMINAL",
                        "confidence": gaze_res["confidence"],
                        "metadata": gaze_res.get("metadata", {}),
                        "timestamp": timestamp
                    })
                    self.last_gaze_event = "GAZE_NOMINAL"
        else:
            self.gaze_deviation_start_time = None

        return events
