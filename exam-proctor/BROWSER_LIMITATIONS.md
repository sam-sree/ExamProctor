# Browser-Based Proctoring Capabilities & Limitations

This document lists the comparison between the legacy Electron-based proctoring and the new modern browser-based web proctoring architecture.

| Feature | Electron Behavior | Browser Behavior | Impact |
| :--- | :--- | :--- | :--- |
| **Fullscreen Lock** | True kiosk, cannot be exited by any user action. | Best-effort: exit detected and re-requested. Overlay prevents passive exits. Candidate can still exit browser. | **Medium** - Fullscreen blocker overlay mitigates passive exit. |
| **Bluetooth Disable** | OS-level disable via shell commands (`sc stop bthserv`, `blueutil`, `rfkill`). | Detection-only via `enumerateDevices()` check, showing blocking warning to prompt manual disconnection. | **Medium** - Relies on candidate disconnecting devices. |
| **Global Shortcuts** | Blocked at OS level via `globalShortcut`. | Intercepted at browser window level only; OS-level shortcut commands (like `Alt+Tab`, `Meta`, `Alt+F4`) cannot be blocked. | **Medium** - OS-level shortcuts remain functional. |
| **Screenshots** | Full desktop screen captures using `webContents.capturePage()`. | Webcam snapshots + Screen share stream (`getDisplayMedia`) capture only. | **Low** - Webcam captures candidates, shared screen captures content. |
| **Process Isolation** | Python CV runs as local spawned child process. | Python CV runs exclusively as a remote service (FastAPI WebSocket endpoint). | **Low** - Remote API introduces ~10-50ms latency. |
| **Close Prevention** | Intercepting close events and calling `preventDefault()` blocks app close. | `beforeunload` displays the browser's native leave confirmation dialog (custom messages not allowed). | **Low** - Native browser confirmation acts as a deterrent. |
| **Multi-Monitor Detection** | Native OS APIs available through Node modules. | Heuristic checks based on screen and window size constraints (`window.screen`). | **Low** - Suspected setups are logged in the admin report. |
