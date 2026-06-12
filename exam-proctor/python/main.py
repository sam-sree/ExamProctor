import asyncio
import websockets
import json
import argparse
import threading
from cv_pipeline import cv_main_loop
from audio_monitor import audio_main_loop
import sys
import os

# Globals for thread control
cv_thread = None
audio_thread = None
cv_stop_event = threading.Event()
audio_stop_event = threading.Event()
clients = set()
main_loop = None

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

async def handle_client(websocket, path):
    global cv_thread, audio_thread
    
    clients.add(websocket)
    print(f"Client connected. Total clients: {len(clients)}")
    
    try:
        # Send ready
        await websocket.send(json.dumps({
            "type": "SYSTEM",
            "event": "READY",
            "message": "Python sidecar connected and ready."
        }))

        # Start threads if not already running
        if not cv_thread or not cv_thread.is_alive():
            cv_stop_event.clear()
            cv_thread = threading.Thread(target=cv_main_loop, args=(broadcast_event, cv_stop_event))
            cv_thread.start()
            
        if not audio_thread or not audio_thread.is_alive():
            audio_stop_event.clear()
            audio_thread = threading.Thread(target=audio_main_loop, args=(broadcast_event, audio_stop_event))
            audio_thread.start()

        # Keep connection open and wait for messages (though we don't expect many from renderer)
        async for message in websocket:
            print(f"Received from renderer: {message}")
            
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        clients.remove(websocket)
        print(f"Client disconnected. Total clients: {len(clients)}")
        if len(clients) == 0:
            print("No clients connected. Stopping CV and Audio threads.")
            cv_stop_event.set()
            audio_stop_event.set()

def broadcast_event(event_dict):
    """Called by background threads to send events to all connected clients"""
    if not clients:
        return
        
    message = json.dumps(event_dict)
    
    async def _send():
        tasks = [asyncio.create_task(client.send(message)) for client in clients.copy()]
        if tasks:
            await asyncio.wait(tasks)
            
    # Schedule the coroutine in the main asyncio loop
    try:
        if main_loop and main_loop.is_running():
             asyncio.run_coroutine_threadsafe(_send(), main_loop)
    except Exception as e:
        print(f"Failed to broadcast: {e}")


async def main():
    global main_loop
    main_loop = asyncio.get_running_loop()
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()

    print(f"Starting WebSocket server on ws://localhost:{args.port}")
    server = await websockets.serve(handle_client, "localhost", args.port)
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Shutting down sidecar.")
        cv_stop_event.set()
        audio_stop_event.set()
