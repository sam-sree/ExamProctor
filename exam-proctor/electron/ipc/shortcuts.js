const { globalShortcut } = require('electron');

const blockedShortcuts = [
  'Alt+F4', 'CommandOrControl+W', 'CommandOrControl+Q',
  'Alt+Tab', 'CommandOrControl+Tab', 'CommandOrControl+Alt+Tab',
  'CommandOrControl+D', 'Super+D', // Show desktop
  'Super+L', // Lock screen
  'CommandOrControl+Shift+I', 'F12', 'CommandOrControl+Shift+J', // DevTools
  'PrintScreen', 'CommandOrControl+Shift+S', // Screenshots
  'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
  'Escape'
];

function registerShortcutHandlers(win) {
  blockedShortcuts.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        console.log(`${shortcut} is pressed and blocked.`);
        // Send a message to renderer to log the attempt
        if (win) {
          win.webContents.send('proctor:warning', { 
            type: 'SHORTCUT_ATTEMPT', 
            metadata: { shortcut } 
          });
        }
      });
    } catch (e) {
      console.error(`Failed to register shortcut ${shortcut}: ${e.message}`);
    }
  });
}

function unregisterShortcutHandlers() {
  globalShortcut.unregisterAll();
}

module.exports = { registerShortcutHandlers, unregisterShortcutHandlers };
