const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startKiosk:       () => ipcRenderer.invoke('exam:start-kiosk'),
  endKiosk:         () => ipcRenderer.invoke('exam:end-kiosk'),
  disableBluetooth: () => ipcRenderer.invoke('bluetooth:disable'),
  enableBluetooth:  () => ipcRenderer.invoke('bluetooth:enable'),
  getBluetoothStatus: () => ipcRenderer.invoke('bluetooth:status'),
  onWarning:        (cb) => ipcRenderer.on('proctor:warning', (_, data) => cb(data)),
  onCloseAttempt:   (cb) => ipcRenderer.on('exam:close-blocked', (_, data) => cb(data)),
  onScreenshot:     (cb) => ipcRenderer.on('exam:screenshot-captured', (_, data) => cb(data)),
  removeListeners:  (channel) => ipcRenderer.removeAllListeners(channel),
});
