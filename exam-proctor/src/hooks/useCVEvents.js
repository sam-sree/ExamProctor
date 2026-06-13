import { useState, useEffect, useRef } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';

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

  // Refs to avoid stale closures in WebSocket callbacks
  const isExamRef = useRef(isExam);
  const examStatusRef = useRef(examStatus);
  const fireWarningRef = useRef(fireWarning);
  const addWebcamSnapshotRef = useRef(addWebcamSnapshot);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const faceDebounceRef = useRef(null);
  const processingFrameRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { isExamRef.current = isExam; }, [isExam]);
  useEffect(() => { examStatusRef.current = examStatus; }, [examStatus]);
  useEffect(() => { fireWarningRef.current = fireWarning; }, [fireWarning]);
  useEffect(() => { addWebcamSnapshotRef.current = addWebcamSnapshot; }, [addWebcamSnapshot]);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
  const wsHost = apiBase.replace(/^https?:\/\//, '');
  const wsUrl = `${wsProtocol}://${wsHost}/ws/proctor/${sessionId}`;

  useEffect(() => {
    if (!isEnabled) {
      cleanup();
      return;
    }

    console.log(`[useCVEvents] Effect running — isEnabled=${isEnabled}, isExam=${isExam}, isExamRef=${isExamRef.current}`);

    const startMedia = async () => {
      try {
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
        video.play();
        videoRef.current = video;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        canvasRef.current = canvas;

        connectWS();
      } catch (err) {
        console.error("Failed to access camera", err);
        setSystemError("Camera access denied or unavailable.");
      }
    };

    const connectWS = () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }

      console.log(`[useCVEvents] Connecting to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[useCVEvents] WebSocket opened`);
        setIsConnected(true);
        retryCountRef.current = 0;
        useProctoringStore.setState({ isConnectionLost: false });
        startCaptureLoops();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'FRAME_PROCESSED') {
            processingFrameRef.current = false;
            return;
          }

          if (data.type === 'CV_EVENT') {
            console.log(`[useCVEvents] CV_EVENT received: ${data.event} | isExam=${isExamRef.current}`);

            if (['FACE_ABSENT', 'MULTIPLE_FACES', 'FACE_NOMINAL', 'FACE_DETECTED'].includes(data.event)) {
              setLastFaceEvent(data.event);
            }

            if (isExamRef.current) {
              if (data.event === 'FACE_ABSENT') {
                console.log('[useCVEvents] Firing FACE_ABSENT warning');
                fireWarningRef.current('FACE_ABSENT', data);
                useProctoringStore.setState({ faceViolationActive: true, faceViolationType: 'FACE_ABSENT' });
              } else if (data.event === 'MULTIPLE_FACES') {
                console.log('[useCVEvents] Firing MULTIPLE_FACES warning');
                fireWarningRef.current('MULTIPLE_FACES', data);
                useProctoringStore.setState({ faceViolationActive: true, faceViolationType: 'MULTIPLE_FACES' });
              } else if (data.event === 'FACE_NOMINAL' || data.event === 'FACE_DETECTED') {
                useProctoringStore.setState({ faceViolationActive: false, faceViolationType: null });
              } else if (data.event === 'GAZE_DEVIATION') {
                fireWarningRef.current('GAZE_DEVIATION', data);
              } else if (data.event === 'HEAD_POSE_VIOLATION') {
                fireWarningRef.current('HEAD_POSE_VIOLATION', data);
              }
            } else {
              console.log('[useCVEvents] CV_EVENT ignored — isExamRef.current is false');
            }
          } else if (data.type === 'SYSTEM') {
            if (data.event === 'CAMERA_ERROR') {
              setSystemError(data.message);
            }
          }
        } catch (e) {
          console.error("[useCVEvents] Failed to parse WS message", e);
        }
      };

      ws.onclose = (event) => {
        console.log(`[useCVEvents] WebSocket closed. Code: ${event.code}`);
        setIsConnected(false);
        stopCaptureLoops();

        if (!isEnabled || examStatusRef.current === 'submitted' || examStatusRef.current === 'disqualified') {
          return;
        }

        const retries = retryCountRef.current;
        retryCountRef.current = retries + 1;

        let delay = 1000;
        if (retries === 1) delay = 2000;
        else if (retries === 2) delay = 4000;
        else if (retries >= 3) {
          delay = 5000;
          useProctoringStore.setState({ isConnectionLost: true });
        }

        console.log(`[useCVEvents] Retrying in ${delay}ms (attempt ${retries + 1})`);
        reconnectTimeoutRef.current = setTimeout(connectWS, delay);
      };

      ws.onerror = (e) => {
        console.error("[useCVEvents] WebSocket error:", e);
      };
    };

    startMedia();
    return () => cleanup();
  }, [isEnabled, wsUrl]);

  // Snapshot loop reacts to isExam and connection state separately
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

  const startCaptureLoops = () => {
    stopCaptureLoops();

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    captureIntervalRef.current = setInterval(() => {
      if (!video || !canvas || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (processingFrameRef.current) return;

      try {
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64Data = dataUrl.split(',')[1];

        processingFrameRef.current = true;

        // Safety: always unblock frame sending after 500ms even if server is slow/reconnected
        setTimeout(() => {
          processingFrameRef.current = false;
        }, 500);

        wsRef.current.send(JSON.stringify({
          type: 'FRAME',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          data: base64Data
        }));

        setLastFrame(dataUrl);
      } catch (e) {
        console.error("Frame capture error:", e);
        processingFrameRef.current = false;
      }
    }, 67);
  };

  const stopCaptureLoops = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
  };

  const cleanup = () => {
    stopCaptureLoops();
    processingFrameRef.current = false;
    useProctoringStore.setState({ faceViolationActive: false, faceViolationType: null });
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (faceDebounceRef.current) {
      clearTimeout(faceDebounceRef.current);
      faceDebounceRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
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
