"""
launcher.py -- Entry point for the bundled Cleanroom Tracker executable.
Starts the FastAPI server and opens the default browser.
"""

import threading
import webbrowser

import uvicorn

from app.main import app  # noqa: F401 — explicit import so PyInstaller bundles it


def open_browser():
    """Open the browser after a short delay to let the server start."""
    import time
    time.sleep(1.5)
    webbrowser.open("http://localhost:8000")


def main():
    print("Starting Cleanroom Tracker...")
    print("The app will open in your browser at http://localhost:8000")
    print("Close this window to stop the server.")
    print()

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":
    main()
