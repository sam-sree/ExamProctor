import { useState, useEffect, useRef } from 'react';

export function useAudioMonitor() {
  const [level, setLevel] = useState(0); // 0 to 100
  const [isActive, setIsActive] = useState(false);
  const [hasSpiked, setHasSpiked] = useState(false);
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const reqIdRef = useRef(null);

  const startMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setIsActive(true);
      setError(null);

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        // Calculate average volume
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) {
            sum += dataArrayRef.current[i];
        }
        const avg = sum / bufferLength;
        // Map 0-255 to 0-100
        const percentage = Math.min(100, Math.max(0, (avg / 255) * 100 * 2)); // *2 to make it more sensitive for UI
        
        setLevel(percentage);
        if (percentage > 30) {
            setHasSpiked(true);
        }

        reqIdRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

    } catch (err) {
      setError("Microphone access denied or unavailable.");
      setIsActive(false);
    }
  };

  const stopMonitor = () => {
    if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.mediaStream.getTracks().forEach(t => t.stop());
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => stopMonitor();
  }, []);

  return { level, isActive, hasSpiked, error, startMonitor, stopMonitor };
}
