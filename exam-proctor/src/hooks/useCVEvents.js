import { useState, useEffect, useRef } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { analyzeBrightness, analyzeFaces, checkGazeAndPose } from '../utils/localCV';

export function useCVEvents(isEnabled = false, isExam = false) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFaceEvent, setLastFaceEvent] = useState(null);
  const [lastFrame, setLastFrame] = useState(null);
  const [systemError, setSystemError] = useState(null);
  const [stream, setStream] = useState(null);

  const fireWarning = useProctoringStore(state => state.fireWarning);
  const examStatus = useExamStore(state => state.status);
  const sessionId = useExamStore(state => state.sessionId);
  const addWebcamSnapshot = useExamStore(state => state.addWebcamSnapshot);

  // Refs to avoid stale closures in event listeners
  const isExamRef = useRef(isExam);
  const examStatusRef = useRef(examStatus);
  const fireWarningRef = useRef(fireWarning);
  const addWebcamSnapshotRef = useRef(addWebcamSnapshot);

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const processingFrameRef = useRef(false);

  const isBurstActiveRef = useRef(false);
  const burstEndTimeRef = useRef(0);
  const captureTimeoutRef = useRef(null);

  const landmarkerRef = useRef(null);
  const lastBrightnessEventRef = useRef("ROOM_BRIGHT_ENOUGH");

  // Sustained-duration tracking: violation must persist for 3s before firing a warning
  const gazeViolationStartRef = useRef(null);
  const headViolationStartRef = useRef(null);
  const VIOLATION_DURATION_MS = 3000;

  const triggerBurst = () => {
    burstEndTimeRef.current = Date.now() + 2500;
    if (!isBurstActiveRef.current) {
      isBurstActiveRef.current = true;
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
      runCaptureLoop();
    }
  };

  const runCaptureLoop = async () => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    // Check if video metadata is loaded and video is playing
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      captureTimeoutRef.current = setTimeout(runCaptureLoop, 333);
      return;
    }

    const now = Date.now();
    let delay = 5000; // 0.2fps default (1 frame every 5s)

    if (now < burstEndTimeRef.current) {
      delay = 67; // 15fps burst
      isBurstActiveRef.current = true;
    } else {
      isBurstActiveRef.current = false;
    }

    if (!processingFrameRef.current) {
      processingFrameRef.current = true;
      try {
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setLastFrame(dataUrl);

        // 1. Analyze Brightness locally
        const brightRes = analyzeBrightness(canvas, lastBrightnessEventRef.current);
        if (brightRes.changed) {
          lastBrightnessEventRef.current = brightRes.event;
          if (brightRes.event === 'ROOM_TOO_DARK') {
            useProctoringStore.setState({ roomTooDark: true });
          } else if (brightRes.event === 'ROOM_BRIGHT_ENOUGH') {
            useProctoringStore.setState({ roomTooDark: false });
          }
        }

        // 2. Local Face Landmarking
        const timestampMs = performance.now();
        const detectionResult = landmarker.detectForVideo(video, timestampMs);

        // 3. Analyze Face Presence
        const faceRes = analyzeFaces(detectionResult.faceLandmarks, 640, 480);

        if (faceRes.event === "FACE_ABSENT") {
          if (lastFaceEvent !== "FACE_ABSENT") {
            setLastFaceEvent("FACE_ABSENT");
          }
          if (isExamRef.current) {
            fireWarningRef.current('FACE_ABSENT', faceRes);
            useProctoringStore.setState({ faceViolationActive: true, faceViolationType: 'FACE_ABSENT' });
          }
        } else if (faceRes.event === "MULTIPLE_FACES") {
          if (lastFaceEvent !== "MULTIPLE_FACES") {
            setLastFaceEvent("MULTIPLE_FACES");
          }
          if (isExamRef.current) {
            fireWarningRef.current('MULTIPLE_FACES', faceRes);
            useProctoringStore.setState({ faceViolationActive: true, faceViolationType: 'MULTIPLE_FACES' });
          }
        } else {
          // Nominal face detected
          if (lastFaceEvent !== "FACE_NOMINAL" && lastFaceEvent !== "FACE_DETECTED") {
            setLastFaceEvent("FACE_DETECTED");
          }
          useProctoringStore.setState({ faceViolationActive: false, faceViolationType: null });

          // 4. Gaze and Pose tracking (only if single candidate face is verified)
          const validFaces = faceRes.faces || [];
          if (validFaces.length === 1) {
            const gazeRes = checkGazeAndPose(validFaces[0], 640, 480);
            const gazeNow = Date.now();

            if (gazeRes.event === 'GAZE_DEVIATION') {
              // Reset head timer since gaze is the active violation
              headViolationStartRef.current = null;
              if (gazeViolationStartRef.current === null) {
                gazeViolationStartRef.current = gazeNow;
              } else if (isExamRef.current && (gazeNow - gazeViolationStartRef.current) >= VIOLATION_DURATION_MS) {
                fireWarningRef.current('GAZE_DEVIATION', gazeRes);
                gazeViolationStartRef.current = gazeNow; // Reset so next 3s is required for the next warning
              }
            } else if (gazeRes.event === 'HEAD_POSE_VIOLATION') {
              // Reset gaze timer since head is the active violation
              gazeViolationStartRef.current = null;
              if (headViolationStartRef.current === null) {
                headViolationStartRef.current = gazeNow;
              } else if (isExamRef.current && (gazeNow - headViolationStartRef.current) >= VIOLATION_DURATION_MS) {
                fireWarningRef.current('HEAD_POSE_VIOLATION', gazeRes);
                headViolationStartRef.current = gazeNow; // Reset so next 3s is required for the next warning
              }
            } else {
              // Nominal gaze — clear both timers
              gazeViolationStartRef.current = null;
              headViolationStartRef.current = null;
            }
          }
        }
      } catch (err) {
        console.error("[useCVEvents] Local processing loop error:", err);
      } finally {
        processingFrameRef.current = false;
      }
    }

    captureTimeoutRef.current = setTimeout(runCaptureLoop, delay);
  };

  // Sync refs
  useEffect(() => { isExamRef.current = isExam; }, [isExam]);
  useEffect(() => { examStatusRef.current = examStatus; }, [examStatus]);
  useEffect(() => { fireWarningRef.current = fireWarning; }, [fireWarning]);
  useEffect(() => { addWebcamSnapshotRef.current = addWebcamSnapshot; }, [addWebcamSnapshot]);

  useEffect(() => {
    if (!isEnabled) {
      cleanup();
      return;
    }

    console.log(`[useCVEvents] Starting Local Proctoring Hook: isEnabled=${isEnabled}, isExam=${isExam}`);

    const startMediaAndModel = async () => {
      try {
        // Request webcam access
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);

        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.width = 640;
        video.height = 480;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        videoRef.current = video;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        canvasRef.current = canvas;

        // Initialize local WebAssembly MediaPipe task
        console.log("[useCVEvents] Loading FaceLandmarker WebAssembly engine...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 2
        });
        landmarkerRef.current = landmarker;
        console.log("[useCVEvents] Local FaceLandmarker ready.");

        setIsConnected(true);
        runCaptureLoop();
      } catch (err) {
        console.error("[useCVEvents] Setup failed:", err);
        setSystemError("Webcam access denied or proctoring engine failed to initialize.");
      }
    };

    const handleTriggerBurst = () => {
      triggerBurst();
    };
    window.addEventListener('proctor-trigger-burst', handleTriggerBurst);
    window.addEventListener('proctor-warning', handleTriggerBurst);

    startMediaAndModel();
    return () => {
      cleanup();
      window.removeEventListener('proctor-trigger-burst', handleTriggerBurst);
      window.removeEventListener('proctor-warning', handleTriggerBurst);
    };
  }, [isEnabled]);

  // Periodic Snapshot upload
  useEffect(() => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    if (isExam && isConnected) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        snapshotIntervalRef.current = setInterval(() => {
          try {
            ctx.drawImage(video, 0, 0, 640, 480);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            addWebcamSnapshotRef.current({ timestamp: new Date().toISOString(), dataUrl });
          } catch (e) {
            console.error("Snapshot capture error:", e);
          }
        }, 30000);
      }
    }

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
    };
  }, [isExam, isConnected]);

  const cleanup = () => {
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    isBurstActiveRef.current = false;
    burstEndTimeRef.current = 0;
    processingFrameRef.current = false;

    useProctoringStore.setState({ faceViolationActive: false, faceViolationType: null, roomTooDark: false });

    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close();
      } catch (e) {
        console.error("[useCVEvents] Error closing FaceLandmarker:", e);
      }
      landmarkerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    videoRef.current = null;
    canvasRef.current = null;
    setIsConnected(false);
  };

  return { isConnected, lastFaceEvent, systemError, lastFrame, stream };
}
