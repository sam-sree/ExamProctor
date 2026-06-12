import React, { useRef, useState, useEffect } from 'react';
import { useCVEvents } from '../hooks/useCVEvents';
import { useProctoringStore } from '../store/proctoringStore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CameraSetup({ onNext }) {
  const videoRef = useRef(null);
  const [flaggedDevices, setFlaggedDevices] = useState([]);
  const [bluetoothCheckbox, setBluetoothCheckbox] = useState(false);
  const [checkboxMessage, setCheckboxMessage] = useState('');

  // Start CV events connection in setup mode to scan face
  const { isConnected, lastFaceEvent, systemError, stream } = useCVEvents(true);

  const checkBluetoothDevices = async () => {
    try {
      const devList = await navigator.mediaDevices.enumerateDevices();
      const audioDevs = devList.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
      
      const bluetoothKeywords = ["airpods", "bluetooth", "wireless", "headset", "buds"];
      const flagged = audioDevs.filter(d => 
        d.label && bluetoothKeywords.some(keyword => d.label.toLowerCase().includes(keyword))
      );
      
      setFlaggedDevices(flagged);
      
      if (flagged.length > 0) {
        useProctoringStore.setState({
          bluetoothDeviceDetected: true,
          detectedBluetoothDevices: flagged.map(f => f.label)
        });
      } else {
        useProctoringStore.setState({
          bluetoothDeviceDetected: false,
          detectedBluetoothDevices: []
        });
      }
      return flagged.length;
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
      return 0;
    }
  };

  useEffect(() => {
    checkBluetoothDevices();
    // Re-check periodically during this setup screen
    const interval = setInterval(checkBluetoothDevices, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCheckboxChange = async (e) => {
    const checked = e.target.checked;
    setBluetoothCheckbox(checked);
    if (checked) {
      const count = await checkBluetoothDevices();
      if (count > 0) {
        setCheckboxMessage("Device still detected. Please disconnect it and try again.");
        // Uncheck after short delay so user sees the change
        setTimeout(() => setBluetoothCheckbox(false), 300);
      } else {
        setCheckboxMessage("");
      }
    }
  };

  const getStatusColor = () => {
    if (!isConnected) return 'var(--warn)';
    if (lastFaceEvent === 'FACE_DETECTED' || lastFaceEvent === 'FACE_NOMINAL') return 'var(--success)';
    if (lastFaceEvent === 'MULTIPLE_FACES' || lastFaceEvent === 'FACE_ABSENT') return 'var(--danger)';
    return 'var(--text-disabled)';
  };

  const getStatusText = () => {
    if (systemError) return `Camera Error: ${systemError}`;
    if (!isConnected) return "Connecting to proctoring service...";
    if (lastFaceEvent === 'FACE_DETECTED' || lastFaceEvent === 'FACE_NOMINAL') return "Face detected - good position";
    if (lastFaceEvent === 'MULTIPLE_FACES') return "Multiple faces detected - ensure you are alone";
    if (lastFaceEvent === 'FACE_ABSENT') return "No face detected - position yourself in frame";
    return "Scanning for face...";
  };

  // Ready to continue only if:
  // 1. Face is detected and nominal
  // 2. Either no bluetooth devices are flagged, OR bluetooth devices were flagged but user checked the confirmation box
  const hasBluetoothAdvisory = flaggedDevices.length > 0;
  const isBluetoothReady = !hasBluetoothAdvisory || bluetoothCheckbox;
  const isFaceReady = isConnected && (lastFaceEvent === 'FACE_NOMINAL' || lastFaceEvent === 'FACE_DETECTED');
  const isReady = isFaceReady && isBluetoothReady;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      
      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--success)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--primary)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
        <div style={{ width: '40px', height: '2px', background: 'var(--border)' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '640px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '48px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }} className="animate-slide-up">
        
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Camera Check</h2>
          <p style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>
            Your camera is used for continuous identity and gaze verification.
          </p>
        </div>

        {/* Video Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              aspectRatio: '16/9',
              objectFit: 'cover',
              borderRadius: '12px',
              border: '2px solid var(--primary)',
              transform: 'scaleX(-1)' // Mirror
            }} 
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getStatusColor(), transition: 'background 300ms ease' }} className={!isConnected ? "animate-pulse-once" : ""} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{getStatusText()}</span>
          </div>
        </div>

        {/* Bluetooth Warning */}
        {hasBluetoothAdvisory && (
          <div style={{
            background: 'var(--warn-soft)',
            border: '1.5px solid var(--warn)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '16px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#D97706' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Bluetooth Device Detected</div>
                <div style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.4 }}>
                  A Bluetooth audio device has been detected: <strong>{flaggedDevices.map(d => d.label).join(', ')}</strong>. Please disconnect all wireless earbuds and headphones before proceeding. Wired or no audio devices only.
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <input 
                type="checkbox"
                checked={bluetoothCheckbox}
                onChange={handleCheckboxChange}
                style={{ width: '18px', height: '18px', accentColor: 'var(--warn)' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                I have disconnected all Bluetooth devices
              </span>
            </label>

            {checkboxMessage && (
              <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                {checkboxMessage}
              </div>
            )}
          </div>
        )}

        <button 
          onClick={onNext}
          disabled={!isReady}
          style={{
            width: '100%',
            background: isReady ? 'var(--primary)' : 'var(--border)',
            color: isReady ? 'white' : 'var(--text-disabled)',
            fontWeight: 700,
            fontSize: '14px',
            height: '52px',
            borderRadius: 'var(--radius-btn)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            transition: 'all 300ms ease',
            marginTop: '16px'
          }}
        >
          Continue
        </button>

      </div>
    </div>
  );
}
