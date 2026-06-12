const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { app } = require('electron');

let pythonProcess = null;

function spawnSidecar() {
  // Check if we are running the bundled version or dev
  const isDev = !app.isPackaged;
  let sidecarPath;
  let command;
  let args = [];

  if (isDev) {
    // Dev: use global python and raw scripts
    command = 'python';
    sidecarPath = path.join(__dirname, '../../python/main.py');
    args = [sidecarPath, '--port', '8765'];
  } else {
    // Production: use PyInstaller bundled executable
    // In electron-builder, we configured extraResources to copy to 'python-sidecar'
    const platformStr = os.platform() === 'win32' ? 'main.exe' : 'main';
    command = path.join(process.resourcesPath, 'python-sidecar', platformStr);
    args = ['--port', '8765'];

    if (!fs.existsSync(command)) {
      console.error("Sidecar executable not found at:", command);
      return;
    }
  }

  console.log(`Spawning sidecar: ${command} ${args.join(' ')}`);
  
  pythonProcess = spawn(command, args, {
    // Hide window on Windows
    windowsHide: true,
    cwd: isDev ? path.join(__dirname, '../../python') : path.join(process.resourcesPath, 'python-sidecar')
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Sidecar]: ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Sidecar Error]: ${data.toString().trim()}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python sidecar exited with code ${code}`);
    pythonProcess = null;
  });
}

function killSidecar() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

module.exports = { spawnSidecar, killSidecar };
