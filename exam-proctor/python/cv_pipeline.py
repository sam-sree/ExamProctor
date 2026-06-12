import cv2
import mediapipe as mp
import time
import datetime
from face_detector import analyze_faces
from gaze_tracker import check_gaze_and_pose

def cv_main_loop(broadcast_cb, stop_event):
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    if not cap.isOpened():
        print("Error: Could not open camera.")
        broadcast_cb({
            "type": "SYSTEM",
            "event": "CAMERA_ERROR",
            "message": "Could not open camera."
        })
        return
        
    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
        max_num_faces=3,
        refine_landmarks=True,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5
    )
    
    print("CV pipeline started.")
    
    # State tracking
    face_absent_start_time = None
    gaze_deviation_start_time = None
    last_face_event = None
    last_gaze_event = None
    
    while not stop_event.is_set():
        start_time = time.time()
        
        success, frame = cap.read()
        if not success:
            continue
            
        # Optimization: convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = mp_face_mesh.process(rgb_frame)
        
        # --- Face Detection Logic ---
        face_res = analyze_faces(results.multi_face_landmarks)
        now = time.time()
        timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        
        if face_res["event"] == "FACE_ABSENT":
            if face_absent_start_time is None:
                face_absent_start_time = now
            elif now - face_absent_start_time >= 0.1:
                if last_face_event != "FACE_ABSENT":
                    broadcast_cb({
                        "type": "CV_EVENT",
                        "event": "FACE_ABSENT",
                        "confidence": face_res["confidence"],
                        "metadata": face_res.get("metadata", {}),
                        "timestamp": timestamp
                    })
                    last_face_event = "FACE_ABSENT"
        elif face_res["event"] == "MULTIPLE_FACES":
            face_absent_start_time = None
            if last_face_event != "MULTIPLE_FACES":
                broadcast_cb({
                    "type": "CV_EVENT",
                    "event": "MULTIPLE_FACES",
                    "confidence": face_res["confidence"],
                    "metadata": face_res.get("metadata", {}),
                    "timestamp": timestamp
                })
                last_face_event = "MULTIPLE_FACES"
        else:
            face_absent_start_time = None
            if last_face_event != "FACE_NOMINAL":
                 # Also emit a generic FACE_DETECTED when face comes back
                 if last_face_event in ("FACE_ABSENT", "MULTIPLE_FACES"):
                    broadcast_cb({
                        "type": "CV_EVENT",
                        "event": "FACE_DETECTED",
                        "confidence": face_res["confidence"],
                        "timestamp": timestamp
                    })
                 broadcast_cb({
                    "type": "CV_EVENT",
                    "event": "FACE_NOMINAL",
                    "confidence": face_res["confidence"],
                    "metadata": face_res.get("metadata", {}),
                    "timestamp": timestamp
                 })
                 last_face_event = "FACE_NOMINAL"
        
        # --- Gaze / Pose Logic ---
        # Only run if exactly one face is detected
        if results.multi_face_landmarks and len(results.multi_face_landmarks) == 1:
            gaze_res = check_gaze_and_pose(results.multi_face_landmarks[0], 640, 480)
            
            if gaze_res["event"] in ["GAZE_DEVIATION", "HEAD_POSE_VIOLATION"]:
                if gaze_deviation_start_time is None:
                    gaze_deviation_start_time = now
                elif now - gaze_deviation_start_time >= 3.0:
                    if last_gaze_event != gaze_res["event"]:
                        broadcast_cb({
                            "type": "CV_EVENT",
                            "event": gaze_res["event"],
                            "confidence": gaze_res["confidence"],
                            "metadata": gaze_res.get("metadata", {}),
                            "timestamp": timestamp
                        })
                        last_gaze_event = gaze_res["event"]
            else:
                gaze_deviation_start_time = None
                if last_gaze_event != "GAZE_NOMINAL" and last_gaze_event is not None:
                    # Emitting gaze nominal requires it to previously be deviated, we don't spam it.
                    broadcast_cb({
                        "type": "CV_EVENT",
                        "event": "GAZE_NOMINAL",
                        "confidence": gaze_res["confidence"],
                        "metadata": gaze_res.get("metadata", {}),
                        "timestamp": timestamp
                    })
                    last_gaze_event = "GAZE_NOMINAL"
        else:
            # If face lost or multiple, reset gaze timer
            gaze_deviation_start_time = None
            
        # Maintain ~15 FPS
        import base64
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        broadcast_cb({
            "type": "FRAME",
            "dataUrl": f"data:image/jpeg;base64,{jpg_as_text}"
        })

        process_time = time.time() - start_time
        sleep_time = max(0, (1.0 / 15.0) - process_time)
        time.sleep(sleep_time)

    cap.release()
    print("CV pipeline stopped.")
