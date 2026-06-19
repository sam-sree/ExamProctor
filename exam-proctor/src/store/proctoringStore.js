import { create } from 'zustand';

const calculateBayesianScore = (warningLog, shortcutAttemptLog, bluetoothDeviceDetected) => {
  const priorCheat = 0.05;
  const priorHonest = 0.95;
  const params = {
    "GAZE_DEVIATION":        {cheat: 0.60, honest: 0.15},
    "FACE_ABSENT":           {cheat: 0.50, honest: 0.05},
    "MULTIPLE_FACES":        {cheat: 0.50, honest: 0.08}, // Reduced — detector can misfire on photos/reflections
    "HEAD_POSE_VIOLATION":   {cheat: 0.50, honest: 0.10},
    "BACKGROUND_AUDIO":      {cheat: 0.40, honest: 0.12},
    "WINDOW_BLUR":           {cheat: 0.70, honest: 0.08},
    "PASTE_DETECTED":        {cheat: 0.90, honest: 0.01},
    "SHORTCUT_ATTEMPT":      {cheat: 0.75, honest: 0.05},
    "FULLSCREEN_EXIT":       {cheat: 0.85, honest: 0.02},
    "BLUETOOTH_CONNECTED":   {cheat: 0.95, honest: 0.01}
  };

  const counts = {};
  Object.keys(params).forEach(k => counts[k] = 0);

  warningLog.forEach(w => {
    if (counts[w.type] !== undefined) counts[w.type]++;
  });

  counts["SHORTCUT_ATTEMPT"] = shortcutAttemptLog.length;

  if (bluetoothDeviceDetected) {
    counts["BLUETOOTH_CONNECTED"] = Math.max(counts["BLUETOOTH_CONNECTED"], 1);
  }

  let odds = priorCheat / priorHonest;
  Object.keys(counts).forEach(k => {
    const count = Math.min(counts[k], 8); // Cap at 8 so repeated warnings continue raising the bar
    if (count > 0) {
      odds *= (params[k].cheat / params[k].honest) ** count;
    }
  });

  const pCheating = odds / (1.0 + odds);
  const trustworthiness = (1.0 - pCheating) * 100.0;

  return {
    pCheat: pCheating,
    bayesianScore: Math.round(trustworthiness * 10) / 10
  };
};

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
  roomTooDark: false,
  lastWarningTime: 0,
  pCheat: 0.05,
  bayesianScore: 95.0,

  fireWarning: (type, metadata = {}, bypassImmunity = false) => {
    // If it's a log-only type, divert to logEvent
    if (['SHORTCUT_ATTEMPT', 'CLOSE_ATTEMPT', 'DEVTOOLS_SUSPECTED'].includes(type)) {
      get().logEvent(type, metadata);
      return;
    }

    const state = get();
    
    // Paused State Immunity
    if (!bypassImmunity) {
      if (state.isConnectionLost || state.isScreenShareEnded || state.isFullscreenExited) return;
      
      const isCVWarning = ['GAZE_DEVIATION', 'FACE_ABSENT', 'MULTIPLE_FACES', 'HEAD_POSE_VIOLATION'].includes(type);
      if (state.faceViolationActive && isCVWarning) return;
    }

    // 1-Second Cascade Cooldown
    const now = Date.now();
    if (!bypassImmunity && (now - state.lastWarningTime < 1000)) {
      return;
    }

    const newCount = state.warningCount + 1;
    const entry = { type, timestamp: new Date().toISOString(), count: newCount };
    const newWarningLog = [...state.warningLog, entry];

    const { pCheat, bayesianScore } = calculateBayesianScore(
      newWarningLog,
      state.shortcutAttemptLog,
      state.bluetoothDeviceDetected
    );

    const disqualified = pCheat > 0.85;

    set({ 
      warningCount: newCount, 
      warningLog: newWarningLog, 
      lastWarningTime: now,
      pCheat,
      bayesianScore,
      disqualified
    });

    // Show toast for UI warning
    window.dispatchEvent(new CustomEvent('proctor-warning', { detail: entry }));
    window.dispatchEvent(new CustomEvent('proctor-trigger-burst'));
  },

  logEvent: (type, metadata = {}) => {
    const timestamp = new Date().toISOString();
    if (type === 'SHORTCUT_ATTEMPT') {
      const shortcut = metadata.shortcut || 'Unknown Shortcut';
      const newShortcutLog = [...get().shortcutAttemptLog, { shortcut, timestamp }];
      
      const { pCheat, bayesianScore } = calculateBayesianScore(
        get().warningLog,
        newShortcutLog,
        get().bluetoothDeviceDetected
      );
      
      const disqualified = pCheat > 0.85;
      
      set({
        shortcutAttemptLog: newShortcutLog,
        pCheat,
        bayesianScore,
        disqualified
      });
    } else {
      set(state => ({
        logOnlyEvents: [...state.logOnlyEvents, { type, timestamp, metadata }]
      }));
    }
    window.dispatchEvent(new CustomEvent('proctor-trigger-burst'));
  },

  setBluetoothDeviceDetected: (detected, devices = []) => {
    const state = get();
    const { pCheat, bayesianScore } = calculateBayesianScore(
      state.warningLog,
      state.shortcutAttemptLog,
      detected
    );
    const disqualified = pCheat > 0.85;
    set({
      bluetoothDeviceDetected: detected,
      detectedBluetoothDevices: devices,
      pCheat,
      bayesianScore,
      disqualified
    });
    window.dispatchEvent(new CustomEvent('proctor-trigger-burst'));
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
    roomTooDark: false,
    lastWarningTime: 0,
    pCheat: 0.05,
    bayesianScore: 95.0
  })
}));
