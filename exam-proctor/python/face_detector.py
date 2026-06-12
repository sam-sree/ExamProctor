def analyze_faces(multi_face_landmarks):
    face_count = len(multi_face_landmarks) if multi_face_landmarks else 0

    if face_count == 0:
        return {"event": "FACE_ABSENT", "confidence": 1.0}
    elif face_count > 1:
        return {"event": "MULTIPLE_FACES", "confidence": 1.0, "metadata": {"count": face_count}}
    else:
        return {"event": "FACE_NOMINAL", "confidence": 1.0}
