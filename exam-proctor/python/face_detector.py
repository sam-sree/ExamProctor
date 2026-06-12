def analyze_faces(multi_face_landmarks, frame_width=640, frame_height=480):
    if not multi_face_landmarks:
        return {"event": "FACE_ABSENT", "confidence": 1.0}

    real_faces = []
    for face_landmarks in multi_face_landmarks:
        xs = [lm.x for lm in face_landmarks.landmark]
        ys = [lm.y for lm in face_landmarks.landmark]
        w = (max(xs) - min(xs)) * frame_width
        h = (max(ys) - min(ys)) * frame_height
        if w >= 60 and h >= 60:
            real_faces.append(face_landmarks)

    face_count = len(real_faces)
    if face_count == 0:
        return {"event": "FACE_ABSENT", "confidence": 1.0, "faces": []}
    elif face_count > 1:
        return {"event": "MULTIPLE_FACES", "confidence": 1.0, "metadata": {"count": face_count}, "faces": real_faces}
    else:
        return {"event": "FACE_NOMINAL", "confidence": 1.0, "faces": real_faces}
