import pyaudio
import numpy as np
from scipy.signal import butter, lfilter
import time
import datetime

CHUNK = 1024
RATE = 16000
BASELINE_DURATION_SECONDS = 5

def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def butter_bandpass_filter(data, lowcut, highcut, fs, order=5):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = lfilter(b, a, data)
    return y

def audio_main_loop(broadcast_cb, stop_event):
    p = pyaudio.PyAudio()
    
    try:
        stream = p.open(format=pyaudio.paInt16,
                        channels=1,
                        rate=RATE,
                        input=True,
                        frames_per_buffer=CHUNK)
    except Exception as e:
        print(f"Error opening audio stream: {e}")
        broadcast_cb({
            "type": "SYSTEM",
            "event": "AUDIO_ERROR",
            "message": str(e)
        })
        return

    print("Audio stream started. Calibrating baseline...")
    
    # Calibration phase
    baseline_frames = int((RATE / CHUNK) * BASELINE_DURATION_SECONDS)
    baseline_rms_values = []
    
    for _ in range(baseline_frames):
        if stop_event.is_set():
            break
        data = stream.read(CHUNK, exception_on_overflow=False)
        audio_data = np.frombuffer(data, dtype=np.int16)
        rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))
        if rms > 0:
            db = 20 * np.log10(rms)
            baseline_rms_values.append(db)
            
    if stop_event.is_set():
        stream.stop_stream()
        stream.close()
        p.terminate()
        return
        
    ambient_baseline_db = np.mean(baseline_rms_values) if baseline_rms_values else 0
    print(f"Audio calibration complete. Baseline: {ambient_baseline_db:.2f} dB")
    
    # State tracking
    speech_detected_start_time = None
    last_state_was_nominal = True
    
    while not stop_event.is_set():
        data = stream.read(CHUNK, exception_on_overflow=False)
        audio_data = np.frombuffer(data, dtype=np.int16).astype(np.float32)
        
        rms = np.sqrt(np.mean(audio_data**2) + 1e-10)
        db = 20 * np.log10(rms)
        
        # Apply bandpass for speech
        filtered_audio = butter_bandpass_filter(audio_data, 85.0, 3400.0, RATE)
        filtered_rms = np.sqrt(np.mean(filtered_audio**2) + 1e-10)
        filtered_db = 20 * np.log10(filtered_rms)
        
        above_baseline = filtered_db - ambient_baseline_db
        is_speech_level = above_baseline > 18.0
        
        now = time.time()
        
        if is_speech_level:
            if speech_detected_start_time is None:
                speech_detected_start_time = now
            elif now - speech_detected_start_time >= 1.5:
                # Emitting speech detected event
                broadcast_cb({
                    "type": "AUDIO_EVENT",
                    "event": "SPEECH_DETECTED",
                    "db_level": float(filtered_db),
                    "above_baseline_by": float(above_baseline),
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                })
                last_state_was_nominal = False
        else:
            speech_detected_start_time = None
            if not last_state_was_nominal:
                broadcast_cb({
                    "type": "AUDIO_EVENT",
                    "event": "AUDIO_NOMINAL",
                    "db_level": float(filtered_db),
                    "above_baseline_by": float(above_baseline),
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
                })
                last_state_was_nominal = True

    stream.stop_stream()
    stream.close()
    p.terminate()
    print("Audio thread stopped.")
