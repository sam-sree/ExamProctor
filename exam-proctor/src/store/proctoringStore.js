import { create } from 'zustand';

// Store for managing warnings and CV events
export const useProctoringStore = create((set, get) => ({
  warningCount: 0,
  warningLog: [],
  disqualified: false,

  fireWarning: (type, metadata = {}) => {
    const { warningCount, warningLog } = get();
    
    // Some types are logged only
    if (type === 'SHORTCUT_ATTEMPT' || type === 'CLOSE_ATTEMPT') {
        set({ 
            warningLog: [...warningLog, { type, metadata, timestamp: new Date().toISOString(), count: warningCount }] 
        });
        return;
    }

    const newCount = warningCount + 1;
    const entry = { type, metadata, timestamp: new Date().toISOString(), count: newCount };

    set({ warningCount: newCount, warningLog: [...warningLog, entry] });

    // Show toast
    window.dispatchEvent(new CustomEvent('proctor-warning', { detail: entry }));

    if (newCount >= 3) {
      set({ disqualified: true });
      // Tell electron to release kiosk early so we can show disqualified screen properly if needed
      if (window.electronAPI) {
          window.electronAPI.endKiosk();
      }
    }
  },
  
  resetProctoring: () => set({ warningCount: 0, warningLog: [], disqualified: false })
}));
