const { exec } = require('child_process');
const os = require('os');

function registerBluetoothHandlers(ipcMain) {
  ipcMain.handle('bluetooth:disable', async () => {
    return new Promise((resolve) => {
      const platform = os.platform();
      let cmd = '';

      if (platform === 'win32') {
        // May require admin
        cmd = 'netsh interface set interface name="Bluetooth Network Connection" admin=disabled && sc stop bthserv';
      } else if (platform === 'darwin') {
        cmd = 'blueutil --power 0';
      } else if (platform === 'linux') {
        cmd = 'rfkill block bluetooth';
      }

      if (!cmd) {
        resolve({ success: false, reason: 'Unsupported platform' });
        return;
      }

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Bluetooth disable error: ${error.message}`);
          resolve({ success: false, reason: 'Permission denied or command missing' });
          return;
        }
        resolve({ success: true });
      });
    });
  });

  ipcMain.handle('bluetooth:enable', async () => {
    return new Promise((resolve) => {
      const platform = os.platform();
      let cmd = '';

      if (platform === 'win32') {
        cmd = 'netsh interface set interface name="Bluetooth Network Connection" admin=enabled && sc start bthserv';
      } else if (platform === 'darwin') {
        cmd = 'blueutil --power 1';
      } else if (platform === 'linux') {
        cmd = 'rfkill unblock bluetooth';
      }

      if (!cmd) {
        resolve({ success: false });
        return;
      }

      exec(cmd, (error) => {
        if (error) resolve({ success: false });
        else resolve({ success: true });
      });
    });
  });
}

module.exports = { registerBluetoothHandlers };
