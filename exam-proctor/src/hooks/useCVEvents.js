import { useState, useEffect, useRef } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';

export function useCVEvents(isEnabled = false) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFaceEvent, setLastFaceEvent] = useState(null);
  const [lastFrame, setLastFrame] = useState(null);
  const [systemError, setSystemError] = useState(null);
  const [stream, setStream] = useState(null);

  const fireWarning = useProctoringStore(state => state.fireWarning);
  const examStatus = useExamStore(state => state.status);
  const sessionId = useExamStore(state => state.sessionId);
  const addWebcamSnapshot = useExamStore(state => state.addWebcamSnapshot);

  const examActive = examStatus === 'active';
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const faceDebounceRef = useRef(null);

  // Determine WS URL based on API Base URL
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
  const wsHost = apiBase.replace(/^https?:\/\//, '');
  const wsUrl = `${wsProtocol}://${wsHost}/ws/proctor/${sessionId}`;

  useEffect(() => {
    if (!isEnabled) {
      // Clean up everything if disabled
      cleanup();
      return;
    }

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        streamRef.current = stream;
        setStream(stream);

        // Create virtual video element to draw frames from
        const video = document.createElement('video');
        video.srcObject = stream;
        video.width = 640;
        video.height = 480;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('muted', 'true');
        video.play();
        videoRef.current = video;

        // Create virtual canvas
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

      console.log(`[useCVEvents] Connecting to proctoring service at: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[useCVEvents] WebSocket opened successfully to ${wsUrl}`);
        setIsConnected(true);
        retryCountRef.current = 0;
        useProctoringStore.setState({ isConnectionLost: false });
        startCaptureLoops();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[useCVEvents] WebSocket message received:`, data);

          if (data.type === 'CV_EVENT') {
            if (['FACE_ABSENT', 'MULTIPLE_FACES', 'FACE_NOMINAL', 'FACE_DETECTED'].includes(data.event)) {
              setLastFaceEvent(data.event);
            }

            if (examActive) {
              if (data.event === 'FACE_ABSENT') fireWarning('FACE_ABSENT', data);
              if (data.event === 'MULTIPLE_FACES') fireWarning('MULTIPLE_FACES', data);
              if (data.event === 'GAZE_DEVIATION') fireWarning('GAZE_DEVIATION', data);
              if (data.event === 'HEAD_POSE_VIOLATION') fireWarning('HEAD_POSE_VIOLATION', data);
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
        console.log(`[useCVEvents] WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'None'}`);
        setIsConnected(false);
        stopCaptureLoops();

        if (!isEnabled || examStatus === 'submitted' || examStatus === 'disqualified') {
          return;
        }

        const retries = retryCountRef.current;
        retryCountRef.current = retries + 1;

        let delay = 1000;
        if (retries === 1) delay = 2000;
        else if (retries === 2) delay = 4000;
        else if (retries >= 3) {
          delay = 5000; // Keep retrying in background
          useProctoringStore.setState({ isConnectionLost: true });
        }

        console.log(`[useCVEvents] Retrying connection in ${delay}ms (attempt ${retries + 1})...`);
        reconnectTimeoutRef.current = setTimeout(connectWS, delay);
      };

      ws.onerror = (e) => {
        console.error("[useCVEvents] WebSocket error event:", e);
      };
    };

    startMedia();

    return () => cleanup();
  }, [isEnabled, examActive, examStatus, wsUrl]);

  const startCaptureLoops = () => {
    stopCaptureLoops();

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    // 15fps Frame capture loop (approx. 67ms)
    captureIntervalRef.current = setInterval(() => {
      if (!video || !canvas || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      try {
        ctx.drawImage(video, 0, 0, 640, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64Data = dataUrl.split(',')[1];

        // Send to server
        wsRef.current.send(JSON.stringify({
          type: 'FRAME',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          data: base64Data
        }));

        // Render preview locally
        setLastFrame(dataUrl);
      } catch (e) {
        console.error("Frame capture error:", e);
      }
    }, 67);

    // 30-second audit webcam snapshot loop (only if exam is active)
    if (examActive) {
      snapshotIntervalRef.current = setInterval(() => {
        if (!video || !canvas) return;
        try {
          ctx.drawImage(video, 0, 0, 640, 480);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          addWebcamSnapshot({
            timestamp: new Date().toISOString(),
            dataUrl
          });
        } catch (e) {
          console.error("Snapshot capture error:", e);
        }
      }, 30000);
    }
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

  return { isConnected, lastFaceEvent, systemError, lastFrame, stream: stream };
}
