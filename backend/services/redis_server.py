"""Start the local Redis server together with the backend.

The answer cache uses Redis (REDIS_URL). When that URL points at this machine
and nothing is answering yet, the backend starts Redis itself, so it no longer
has to be started by hand. Redis runs as its own background process: it keeps
running across backend reloads, and the cache survives restarts.

How Redis is started, in order:
  1. REDIS_START_COMMAND from .env, run as written (e.g. a Docker or snap command);
  2. otherwise a `redis-server` program found on the PATH (or REDIS_SERVER_BIN),
     started in the background on the port from REDIS_URL, with its data file in
     storage/redis/.
"""
import os
import shlex
import shutil
import subprocess
import time
from urllib.parse import urlparse

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", ""}
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "redis")


def _ping(url: str) -> bool:
    try:
        import redis
        redis.Redis.from_url(url, socket_timeout=1, socket_connect_timeout=1).ping()
        return True
    except Exception:
        return False


def _start_command(port: int):
    custom = os.getenv("REDIS_START_COMMAND", "").strip()
    if custom:
        return custom, True
    binary = os.getenv("REDIS_SERVER_BIN", "").strip() or shutil.which("redis-server")
    if not binary:
        return None, False
    os.makedirs(DATA_DIR, exist_ok=True)
    return [binary, "--port", str(port), "--bind", "127.0.0.1", "--daemonize", "yes",
            "--dir", os.path.abspath(DATA_DIR), "--save", "300 1",
            "--logfile", os.path.abspath(os.path.join(DATA_DIR, "redis.log"))], False


def ensure_redis_running(timeout: float = 8.0) -> bool:
    """Start the local Redis server if REDIS_URL points here and it is not running.
    Returns True when Redis is reachable."""
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return False
    if _ping(url):
        return True
    parsed = urlparse(url)
    if (parsed.hostname or "") not in LOCAL_HOSTS:
        print(f"⚠️ Redis at {parsed.hostname} is not reachable (remote server — not started automatically)")
        return False

    command, use_shell = _start_command(parsed.port or 6379)
    if command is None:
        print("⚠️ Redis is not running and no redis-server program was found. Install Redis, or set "
              "REDIS_START_COMMAND (or REDIS_SERVER_BIN) in .env so the backend can start it.")
        return False

    shown = command if use_shell else " ".join(shlex.quote(c) for c in command)
    print(f"🧰 Starting Redis: {shown}")
    try:
        subprocess.Popen(command, shell=use_shell, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    except Exception as exc:
        print(f"⚠️ Could not start Redis ({exc.__class__.__name__}: {exc})")
        return False

    deadline = time.time() + timeout
    while time.time() < deadline:
        if _ping(url):
            print("✅ Redis started")
            return True
        time.sleep(0.25)
    print(f"⚠️ Redis did not answer within {timeout:.0f}s after starting — using the in-memory cache")
    return False
