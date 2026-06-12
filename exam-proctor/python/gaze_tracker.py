import cv2
import numpy as np
import math

def estimate_gaze_ratio(iris_center, eye_left_corner, eye_right_corner):
    eye_width = abs(eye_right_corner.x - eye_left_corner.x)
    if eye_width == 0: return 0.5
    iris_offset = iris_center.x - eye_left_corner.x
    return iris_offset / eye_width

def estimate_vertical_gaze(iris_center, eye_top, eye_bottom):
    eye_height = abs(eye_bottom.y - eye_top.y)
    if eye_height == 0: return 0.5
    iris_vertical = iris_center.y - eye_top.y
    return iris_vertical / eye_height

def rotationMatrixToEulerAngles(R):
    sy = np.sqrt(R[0,0] * R[0,0] +  R[1,0] * R[1,0])
    singular = sy < 1e-6
    if not singular:
        x = math.atan2(R[2,1] , R[2,2])
        y = math.atan2(-R[2,0], sy)
        z = math.atan2(R[1,0], R[0,0])
    else:
        x = math.atan2(-R[1,2], R[1,1])
        y = math.atan2(-R[2,0], sy)
        z = 0
    return np.array([x, y, z])

def check_gaze_and_pose(face_landmarks, image_width, image_height):
    # Check if we have refined landmarks (length >= 478)
    if len(face_landmarks.landmark) < 478:
        # Fallback to nominal gaze if iris landmarks are missing
        h_ratio = 0.5
        v_ratio = 0.5
    else:
        # Landmarks based on MediaPipe 468 point mesh + 10 iris points
        left_iris_center = face_landmarks.landmark[468]
        right_iris_center = face_landmarks.landmark[473]
        left_eye_inner = face_landmarks.landmark[33]
        left_eye_outer = face_landmarks.landmark[133]
        right_eye_inner = face_landmarks.landmark[362]
        right_eye_outer = face_landmarks.landmark[263]
        
        left_eye_top = face_landmarks.landmark[159]
        left_eye_bottom = face_landmarks.landmark[145]
        right_eye_top = face_landmarks.landmark[386]
        right_eye_bottom = face_landmarks.landmark[374]
        
        # Calculate ratios
        left_h_ratio = estimate_gaze_ratio(left_iris_center, left_eye_outer, left_eye_inner)
        right_h_ratio = estimate_gaze_ratio(right_iris_center, right_eye_inner, right_eye_outer)
        h_ratio = (left_h_ratio + right_h_ratio) / 2.0
        
        left_v_ratio = estimate_vertical_gaze(left_iris_center, left_eye_top, left_eye_bottom)
        right_v_ratio = estimate_vertical_gaze(right_iris_center, right_eye_top, right_eye_bottom)
        v_ratio = (left_v_ratio + right_v_ratio) / 2.0

    # Pose estimation
    model_points = np.array([
        (0.0, 0.0, 0.0),             # Nose tip 4
        (0.0, -330.0, -65.0),        # Chin 152
        (-225.0, 170.0, -135.0),     # Left eye left corner 33
        (225.0, 170.0, -135.0),      # Right eye right corner 263
        (-150.0, -150.0, -125.0),    # Left Mouth corner 61
        (150.0, -150.0, -125.0)      # Right mouth corner 291
    ])
    
    image_points = np.array([
        (face_landmarks.landmark[4].x * image_width, face_landmarks.landmark[4].y * image_height),
        (face_landmarks.landmark[152].x * image_width, face_landmarks.landmark[152].y * image_height),
        (face_landmarks.landmark[33].x * image_width, face_landmarks.landmark[33].y * image_height),
        (face_landmarks.landmark[263].x * image_width, face_landmarks.landmark[263].y * image_height),
        (face_landmarks.landmark[61].x * image_width, face_landmarks.landmark[61].y * image_height),
        (face_landmarks.landmark[291].x * image_width, face_landmarks.landmark[291].y * image_height)
    ], dtype="double")
    
    focal_length = image_width
    center = (image_width/2, image_height/2)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype="double")
    
    dist_coeffs = np.zeros((4,1))
    success, rotation_vec, translation_vec = cv2.solvePnP(model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE)
    
    if not success:
        return {"event": "GAZE_NOMINAL", "confidence": 1.0}
        
    rotation_mat, _ = cv2.Rodrigues(rotation_vec)
    euler_angles = rotationMatrixToEulerAngles(rotation_mat)
    
    pitch = np.degrees(euler_angles[0])
    yaw = np.degrees(euler_angles[1])
    roll = np.degrees(euler_angles[2])
    
    deviation = False
    metadata = {
        "h_ratio": h_ratio,
        "v_ratio": v_ratio,
        "pitch": pitch,
        "yaw": yaw,
        "roll": roll
    }
    
    if h_ratio < 0.30 or h_ratio > 0.70 or v_ratio < 0.30 or v_ratio > 0.70:
        return {"event": "GAZE_DEVIATION", "confidence": 1.0, "metadata": metadata}
        
    if abs(yaw) > 35 or abs(pitch) > 25:
        return {"event": "HEAD_POSE_VIOLATION", "confidence": 1.0, "metadata": metadata}
        
    return {"event": "GAZE_NOMINAL", "confidence": 1.0, "metadata": metadata}
