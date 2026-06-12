import { useState, useEffect, useRef } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';

export function useCVEvents(url = 'ws://localhost:8765') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFaceEvent, setLastFaceEvent] = useState(null);
  const [lastFrame, setLastFrame] = useState(null);
  const [systemError, setSystemError] = useState(null);
  const fireWarning = useProctoringStore(state => state.fireWarning);
  const examStatus = useExamStore(state => state.status);
  const examActive = examStatus === 'active';
  const wsRef = useRef(null);

  useEffect(() => {
    const connect = () => {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'CV_EVENT') {
              if (['FACE_ABSENT', 'MULTIPLE_FACES', 'FACE_NOMINAL', 'FACE_DETECTED'].includes(data.event)) {
                  setLastFaceEvent(data.event);
              }

              // Fire warnings only if exam is active
              if (examActive) {
                  if (data.event === 'FACE_ABSENT') fireWarning('FACE_ABSENT', data);
                  if (data.event === 'MULTIPLE_FACES') fireWarning('MULTIPLE_FACES', data);
                  if (data.event === 'GAZE_DEVIATION') fireWarning('GAZE_DEVIATION', data);
                  if (data.event === 'HEAD_POSE_VIOLATION') fireWarning('HEAD_POSE_VIOLATION', data);
              }
          } else if (data.type === 'AUDIO_EVENT' && examActive) {
              if (data.event === 'SPEECH_DETECTED') {
                  fireWarning('BACKGROUND_AUDIO', data);
              }
          } else if (data.type === 'SYSTEM' && data.event === 'CAMERA_ERROR') {
              setSystemError(data.message);
          } else if (data.type === 'FRAME') {
              setLastFrame(data.dataUrl);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect in a bit if exam is still active
        setTimeout(connect, 3000);
      };
      
      wsRef.current.onerror = (e) => {
          console.error("WebSocket error", e);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
          wsRef.current.close();
      }
    };
  }, [url, fireWarning, examActive]);

  return { isConnected, lastFaceEvent, systemError, lastFrame };
}
