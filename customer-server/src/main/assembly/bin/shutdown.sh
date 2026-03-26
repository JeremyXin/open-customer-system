#!/bin/bash

APP_HOME="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$APP_HOME/logs/app.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "PID file not found: $PID_FILE"
    echo "Application may not be running."
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
    echo "Process $PID is not running."
    rm -f "$PID_FILE"
    exit 1
fi

echo "Stopping Open Customer System (PID: $PID)..."

kill "$PID"

WAIT_COUNT=0
MAX_WAIT=30

while kill -0 "$PID" 2>/dev/null; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo "Process did not stop gracefully after ${MAX_WAIT}s, forcing..."
        kill -9 "$PID" 2>/dev/null
        break
    fi
    echo "Waiting for process to stop... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
done

rm -f "$PID_FILE"

echo "Application stopped."
