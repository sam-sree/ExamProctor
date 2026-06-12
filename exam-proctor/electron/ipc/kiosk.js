function registerKioskHandlers(ipcMain, win, onStateChange) {
  ipcMain.handle('exam:start-kiosk', () => {
    win.setKiosk(true);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);
    onStateChange(true);
    return true;
  });

  ipcMain.handle('exam:end-kiosk', () => {
    win.setKiosk(false);
    win.setAlwaysOnTop(false);
    onStateChange(false);
    return true;
  });
}

module.exports = { registerKioskHandlers };
