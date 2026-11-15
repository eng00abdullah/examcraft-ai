#!/usr/bin/env bash
set -e

echo "==================================================="
echo "          ExamCraft AI - Application Startup"
echo "==================================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH."
    echo "Please install Python 3.10+."
    exit 1
fi

# Create venv if needed
if [ ! -f ".venv/bin/python" ]; then
    echo "[*] Creating virtual environment..."
    python3 -m venv .venv
    echo "[*] Installing dependencies..."
    ./.venv/bin/pip install -r requirements.txt || ./.venv/bin/pip install -r requirements-base.txt
fi

echo "[*] Starting ExamCraft AI server on http://127.0.0.1:8000"
./.venv/bin/python3 -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
