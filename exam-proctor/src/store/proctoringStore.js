import { create } from 'zustand';

export const useProctoringStore = create((set, get) => ({
  warningCount: 0,
  warningLog: [],
  shortcutAttemptLog: [],
  logOnlyEvents: [],
  disqualified: false,
  isConnectionLost: false,
  isFullscreenExited: false,
  multiMonitorSuspected: false,
  bluetoothDeviceDetected: false,
  detectedBluetoothDevices: [],
  faceViolationActive: false,
  faceViolationType: null,
  isScreenShareEnded: false,
  lastWarningTime: 0,

  fireWarning: (type, metadata = {}, bypassImmunity = false) => {
    // If it's a log-only type, divert to logEvent
    if (['SHORTCUT_ATTEMPT', 'CLOSE_ATTEMPT', 'DEVTOOLS_SUSPECTED'].includes(type)) {
      get().logEvent(type, metadata);
      return;
    }

    const state = get();
    
    // Paused State Immunity
    if (!bypassImmunity && (state.isFullscreenExited || state.isConnectionLost || state.faceViolationActive || state.isScreenShareEnded)) {
      return; 
    }

    // 1-Second Cascade Cooldown
    const now = Date.now();
    if (!bypassImmunity && (now - state.lastWarningTime < 1000)) {
      return;
    }

    const newCount = state.warningCount + 1;
    const entry = { type, timestamp: new Date().toISOString(), count: newCount };

    set({ warningCount: newCount, warningLog: [...state.warningLog, entry], lastWarningTime: now });

    // Show toast for UI warning
    window.dispatchEvent(new CustomEvent('proctor-warning', { detail: entry }));

    if (newCount >= 3) {
      set({ disqualified: true });
    }
  },

  logEvent: (type, metadata = {}) => {
    const timestamp = new Date().toISOString();
    if (type === 'SHORTCUT_ATTEMPT') {
      const shortcut = metadata.shortcut || 'Unknown Shortcut';
      set(state => ({
        shortcutAttemptLog: [...state.shortcutAttemptLog, { shortcut, timestamp }]
      }));
    } else {
      set(state => ({
        logOnlyEvents: [...state.logOnlyEvents, { type, timestamp, metadata }]
      }));
    }
  },

  resetProctoring: () => set({
    warningCount: 0,
    warningLog: [],
    shortcutAttemptLog: [],
    logOnlyEvents: [],
    disqualified: false,
    isConnectionLost: false,
    isFullscreenExited: false,
    multiMonitorSuspected: false,
    bluetoothDeviceDetected: false,
    detectedBluetoothDevices: [],
    faceViolationActive: false,
    faceViolationType: null,
    isScreenShareEnded: false,
    lastWarningTime: 0
  })
}));
