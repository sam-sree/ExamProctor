/**
 * Client-Side Computer Vision Helper Functions
 * Ports the proctoring CV analysis from Python to JavaScript.
 */

/**
 * Checks frame brightness using grayscale mean and hysteresis.
 */
export function analyzeBrightness(canvas, lastBrightnessEvent = "ROOM_BRIGHT_ENOUGH") {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let colorSum = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    colorSum += (r + g + b) / 3;
  }
  
  const brightness = colorSum / (canvas.width * canvas.height);
  
  if (lastBrightnessEvent === "ROOM_TOO_DARK") {
    if (brightness >= 55) {
      return { event: "ROOM_BRIGHT_ENOUGH", brightness, changed: true };
    }
  } else {
    if (brightness < 45) {
      return { event: "ROOM_TOO_DARK", brightness, changed: true };
    }
  }
  return { event: lastBrightnessEvent, brightness, changed: false };
}

/**
 * Checks face count and filters out small background detections (caps minimum size).
 */
export function analyzeFaces(multiFaceLandmarks, frameWidth = 640, frameHeight = 480) {
  if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
    return { event: "FACE_ABSENT", confidence: 1.0, faces: [] };
  }
  
  const realFaces = [];
  for (const landmarks of multiFaceLandmarks) {
    const xs = landmarks.map(lm => lm.x);
    const ys = landmarks.map(lm => lm.y);
    const w = (Math.max(...xs) - Math.min(...xs)) * frameWidth;
    const h = (Math.max(...ys) - Math.min(...ys)) * frameHeight;
    // Cap at 60x60 pixels to count as a "real" face
    if (w >= 60 && h >= 60) {
      realFaces.push(landmarks);
    }
  }
  
  const faceCount = realFaces.length;
  if (faceCount === 0) {
    return { event: "FACE_ABSENT", confidence: 1.0, faces: [] };
  } else if (faceCount > 1) {
    return { event: "MULTIPLE_FACES", confidence: 1.0, metadata: { count: faceCount }, faces: realFaces };
  } else {
    return { event: "FACE_NOMINAL", confidence: 1.0, faces: realFaces };
  }
}

/**
 * Estimates horizontal gaze ratio (iris position within eye horizontal boundaries).
 */
function estimateGazeRatio(irisCenter, eyeLeftCorner, eyeRightCorner) {
  const eyeWidth = Math.abs(eyeRightCorner.x - eyeLeftCorner.x);
  if (eyeWidth === 0) return 0.5;
  const irisOffset = irisCenter.x - eyeLeftCorner.x;
  return irisOffset / eyeWidth;
}

/**
 * Estimates vertical gaze ratio (iris position within eye vertical boundaries).
 */
function estimateVerticalGaze(irisCenter, eyeTop, eyeBottom) {
  const eyeHeight = Math.abs(eyeBottom.y - eyeTop.y);
  if (eyeHeight === 0) return 0.5;
  const irisVertical = irisCenter.y - eyeTop.y;
  return irisVertical / eyeHeight;
}

/**
 * Performs gaze tracking and head pose estimation using geometric ratios.
 */
export function checkGazeAndPose(faceLandmarks, imageWidth = 640, imageHeight = 480) {
  // If refined iris landmarks (index >= 478) are missing, default to nominal ratios
  let h_ratio = 0.5;
  let v_ratio = 0.5;

  if (faceLandmarks.length >= 478) {
    const leftIrisCenter = faceLandmarks[468];
    const rightIrisCenter = faceLandmarks[473];
    const leftEyeInner = faceLandmarks[33];
    const leftEyeOuter = faceLandmarks[133];
    const rightEyeInner = faceLandmarks[362];
    const rightEyeOuter = faceLandmarks[263];
    
    const leftEyeTop = faceLandmarks[159];
    const leftEyeBottom = faceLandmarks[145];
    const rightEyeTop = faceLandmarks[386];
    const rightEyeBottom = faceLandmarks[374];
    
    const leftHRatio = estimateGazeRatio(leftIrisCenter, leftEyeOuter, leftEyeInner);
    const rightHRatio = estimateGazeRatio(rightIrisCenter, rightEyeInner, rightEyeOuter);
    h_ratio = (leftHRatio + rightHRatio) / 2.0;
    
    const leftVRatio = estimateVerticalGaze(leftIrisCenter, leftEyeTop, leftEyeBottom);
    const rightVRatio = estimateVerticalGaze(rightIrisCenter, rightEyeTop, rightEyeBottom);
    v_ratio = (leftVRatio + rightVRatio) / 2.0;
  }

  // Head pose estimation using landmark distance ratios (Yaw, Pitch, Roll)
  const nose = faceLandmarks[4];
  const chin = faceLandmarks[152];
  const leftEyeOuter = faceLandmarks[133];
  const rightEyeOuter = faceLandmarks[263];

  // Roll: Angle of the eye line
  const roll = Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x) * (180 / Math.PI);

  // Yaw: Distance from nose to left/right eyes
  const leftDist = Math.sqrt((nose.x - leftEyeOuter.x) ** 2 + (nose.y - leftEyeOuter.y) ** 2);
  const rightDist = Math.sqrt((nose.x - rightEyeOuter.x) ** 2 + (nose.y - rightEyeOuter.y) ** 2);
  const yawRatio = leftDist / rightDist;
  const yaw = (leftDist - rightDist) / (leftDist + rightDist) * 100;

  // Pitch: Nose position relative to eye center and chin
  const eyeY = (leftEyeOuter.y + rightEyeOuter.y) / 2.0;
  const upperDist = nose.y - eyeY;
  const lowerDist = chin.y - nose.y;
  const pitchRatio = upperDist / lowerDist;
  const pitch = (pitchRatio - 0.45) * 100;

  const metadata = {
    h_ratio,
    v_ratio,
    pitch,
    yaw,
    roll
  };

  // Threshold checks aligned with previous python parameters
  if (h_ratio < 0.28 || h_ratio > 0.72 || v_ratio < 0.28 || v_ratio > 0.72) {
    return { event: "GAZE_DEVIATION", confidence: 1.0, metadata };
  }

  if (yawRatio > 1.80 || yawRatio < 0.55 || pitchRatio < 0.22 || pitchRatio > 0.75 || Math.abs(roll) > 20) {
    return { event: "HEAD_POSE_VIOLATION", confidence: 1.0, metadata };
  }

  return { event: "GAZE_NOMINAL", confidence: 1.0, metadata };
}
