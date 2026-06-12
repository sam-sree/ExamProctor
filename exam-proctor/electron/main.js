const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { registerKioskHandlers } = require('./ipc/kiosk');
const { registerBluetoothHandlers } = require('./ipc/bluetooth');
const { registerShortcutHandlers, unregisterShortcutHandlers } = require('./ipc/shortcuts');
const { spawnSidecar, killSidecar } = require('./ipc/sidecar');

// Keep a global reference of the window object to avoid garbage collection
let win = null;
let examActive = false;
let screenshotInterval = null;

// Determine if we are in dev mode (Vite is running)
const isDev = !app.isPackaged;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: false, // Initially false, kiosk handlers will set to true
    kiosk: false,      
    resizable: true,   // Allow resize during setup, block during kiosk
    frame: true,       // Native frame during setup
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Need this to allow WebBluetooth in renderer without user gesture prompt in some OS
      enableWebBluetooth: true,
    }
  });

  // Handle Bluetooth device selection prompt implicitly for our "scan" feature
  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      callback(deviceList[0].deviceId);
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept close events during exam
  win.on('close', (e) => {
    if (examActive) {
      e.preventDefault();
      win.webContents.send('proctor:warning', { type: 'CLOSE_ATTEMPT' });
    }
  });
  
  win.on('minimize', (e) => {
      if (examActive) {
          e.preventDefault();
          win.restore();
          win.webContents.send('proctor:warning', { type: 'WINDOW_BLUR' });
      }
  });

  win.on('blur', () => {
    if (examActive) {
        win.webContents.send('proctor:warning', { type: 'WINDOW_BLUR' });
    }
  });
}

function takeScreenshot() {
  if (win && examActive) {
    win.webContents.capturePage().then(image => {
      // Send base64 to renderer to store in session log
      win.webContents.send('exam:screenshot-captured', {
        timestamp: new Date().toISOString(),
        dataUrl: image.toDataURL()
      });
    }).catch(err => {
      console.error("Screenshot capture failed:", err);
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  // Initialize IPC Handlers
  registerKioskHandlers(ipcMain, win, (isActive) => {
    examActive = isActive;
    if (isActive) {
      registerShortcutHandlers(win);
      win.setResizable(false);
      win.setFrame(false);
      // Start 30s screenshot interval
      if (screenshotInterval) clearInterval(screenshotInterval);
      screenshotInterval = setInterval(takeScreenshot, 30000);
      takeScreenshot(); // initial screenshot
    } else {
      unregisterShortcutHandlers();
      win.setResizable(true);
      win.setFrame(true);
      if (screenshotInterval) clearInterval(screenshotInterval);
    }
  });
  
  registerBluetoothHandlers(ipcMain);
  spawnSidecar();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killSidecar();
});
