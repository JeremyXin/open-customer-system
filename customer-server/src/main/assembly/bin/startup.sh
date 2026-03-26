#!/bin/bash

APP_HOME="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$APP_HOME/logs/app.pid"

if [ -n "$JAVA_HOME" ]; then
    JAVA="$JAVA_HOME/bin/java"
else
    JAVA="java"
fi

JAR_FILE=$(ls "$APP_HOME"/lib/open-customer-system-*.jar 2>/dev/null | head -n 1)
if [ -z "$JAR_FILE" ]; then
    echo "Error: No application JAR found in $APP_HOME/lib/"
    exit 1
fi

JVM_ARGS="${JVM_ARGS:--Xms256m -Xmx512m -XX:+UseG1GC}"

mkdir -p "$APP_HOME/logs"
mkdir -p "$APP_HOME/temp"

echo "Starting Open Customer System..."
echo "  APP_HOME: $APP_HOME"
echo "  JAVA: $JAVA"
echo "  JAR: $(basename "$JAR_FILE")"
echo "  JVM_ARGS: $JVM_ARGS"

nohup "$JAVA" $JVM_ARGS \
    -jar "$JAR_FILE" \
    --spring.config.additional-location="$APP_HOME/conf/" \
    > "$APP_HOME/logs/stdout.log" 2>&1 &

PID=$!
echo $PID > "$PID_FILE"

echo ""
echo "Application started with PID: $PID"
echo "PID file: $PID_FILE"
echo "Log file: $APP_HOME/logs/stdout.log"
