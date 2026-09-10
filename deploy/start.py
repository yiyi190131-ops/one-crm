import os, signal, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("DATA_DIR", "/data"))
DATA.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env["PYTHONPATH"] = str(ROOT / "backend")
env.setdefault("DATABASE_URL", "sqlite:///" + str(DATA.resolve() / "crm.db"))
env.setdefault("AI_PROVIDER", "local")
port = env.get("PORT", "3000")
children = []

def stop(*_):
    for child in children:
        if child.poll() is None:
            child.terminate()

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

try:
    children.append(subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT, env=env
    ))
    children.append(subprocess.Popen(
        ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", port],
        cwd=ROOT, env=env
    ))
    while True:
        if any(child.poll() is not None for child in children):
            raise RuntimeError("A required service stopped")
        time.sleep(0.25)
finally:
    stop()
