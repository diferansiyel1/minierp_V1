import subprocess
import time
import os
import signal
import sys

def main():
    # Start Backend
    print("Starting Backend...")
    backend_process = subprocess.Popen(
        ["uvicorn", "backend.main:app", "--reload", "--port", "8000"],
        cwd=os.getcwd()
    )

    # Start Frontend
    print("Starting Frontend...")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.join(os.getcwd(), "frontend")
    )

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping services...")
        backend_process.terminate()
        frontend_process.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
