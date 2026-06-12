import { useState, useEffect, useRef } from 'react';
import { useProctoringStore } from '../store/proctoringStore';
import { useExamStore } from '../store/examStore';

export function useAudioMonitor() {
  const [level, setLevel] = useState(0); // 0 to 100 for UI
  const [isActive, setIsActive] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [ambientBaselineDb, setAmbientBaselineDb] = useState(0);
  const [hasSpiked, setHasSpiked] = useState(false);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const reqIdRef = useRef(null);
  const streamRef = useRef(null);

  // References for speech detection algorithm
  const calibrationValuesRef = useRef([]);
  const calibrationStartRef = useRef(null);
  const speechStartTimeRef = useRef(null);
  const lastStateWasNominalRef = useRef(true);

  // We read examActive from examStore to ensure we only trigger strikes during the exam
  const examStatus = useExamStore(state => state.status);
  const examActive = examStatus === 'active';

  const startMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setIsActive(true);
      setError(null);
      setIsCalibrating(true);

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // 1. Create bandpass filters using highpass + lowpass in series
      const hpFilter = audioContextRef.current.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 85;

      const lpFilter = audioContextRef.current.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 3400;

      // 2. Create analyser
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
      
      // 3. Connect stream -> highpass -> lowpass -> analyser
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lpFilter.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const freqDataArray = new Uint8Array(bufferLength);
      const timeDataArray = new Float32Array(analyserRef.current.fftSize);

      calibrationValuesRef.current = [];
      calibrationStartRef.current = Date.now();
      speechStartTimeRef.current = null;
      lastStateWasNominalRef.current = true;

      const updateLoop = () => {
        if (!analyserRef.current) return;
        
        // A. Visual volume level (using frequency data for visual response)
        analyserRef.current.getByteFrequencyData(freqDataArray);
        let freqSum = 0;
        for (let i = 0; i < bufferLength; i++) {
          freqSum += freqDataArray[i];
        }
        const avgFreq = freqSum / bufferLength;
        const visualPercentage = Math.min(100, Math.max(0, (avgFreq / 255) * 100 * 2.5));
        setLevel(visualPercentage);
        
        if (visualPercentage > 30) {
          setHasSpiked(true);
        }

        // B. Speech detection (using time domain RMS & Decibels)
        analyserRef.current.getFloatTimeDomainData(timeDataArray);
        let timeSquareSum = 0;
        for (let i = 0; i < timeDataArray.length; i++) {
          timeSquareSum += timeDataArray[i] * timeDataArray[i];
        }
        const rms = Math.sqrt(timeSquareSum / timeDataArray.length) + 1e-10;
        const db = 20 * Math.log10(rms);

        const nowMs = Date.now();
        
        // 5-second ambient baseline calibration at session start
        if (calibrationStartRef.current && (nowMs - calibrationStartRef.current < 5000)) {
          calibrationValuesRef.current.push(db);
        } else if (calibrationStartRef.current) {
          // Calibration finished!
          const values = calibrationValuesRef.current;
          const baseline = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
          setAmbientBaselineDb(baseline);
          setIsCalibrated(true);
          setIsCalibrating(false);
          calibrationStartRef.current = null;
          console.log(`Audio baseline calibrated at: ${baseline.toFixed(2)} dB`);
        } else {
          // Normal analysis phase
          const aboveBaseline = db - ambientBaselineDb;
          const isSpeechLevel = aboveBaseline > 18.0;

          if (isSpeechLevel) {
            if (speechStartTimeRef.current === null) {
              speechStartTimeRef.current = nowMs;
            } else if (nowMs - speechStartTimeRef.current >= 1500) {
              if (lastStateWasNominalRef.current && examActive) {
                // Speech detected for 1.5 continuous seconds -> Fire warning
                useProctoringStore.getState().fireWarning('BACKGROUND_AUDIO', {
                  db_level: parseFloat(db.toFixed(2)),
                  above_baseline_by: parseFloat(aboveBaseline.toFixed(2))
                });
                lastStateWasNominalRef.current = false;
              }
            }
          } else {
            speechStartTimeRef.current = null;
            if (!lastStateWasNominalRef.current) {
              lastStateWasNominalRef.current = true;
            }
          }
        }

        reqIdRef.current = requestAnimationFrame(updateLoop);
      };

      updateLoop();

    } catch (err) {
      console.error(err);
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
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => stopMonitor();
  }, []);

  return { 
    level, 
    isActive, 
    isCalibrated, 
    isCalibrating, 
    ambientBaselineDb, 
    hasSpiked, 
    error, 
    startMonitor, 
    stopMonitor 
  };
}
