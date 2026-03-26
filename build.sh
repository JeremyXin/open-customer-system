#!/bin/bash

# Open Customer System - Build Script
# Usage: ./build.sh [options]
# Options:
#   --help        Show this help
#   --skipTests   Skip running tests
#   --no-webapp   Skip frontend build
#   --no-dist     Skip distribution package

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Default flags
SKIP_TESTS="-DskipTests"
PROFILES="webapp,dist"
SHOW_HELP=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --help|-h)
            SHOW_HELP=true
            ;;
        --skipTests)
            SKIP_TESTS="-DskipTests"
            ;;
        --with-tests)
            SKIP_TESTS=""
            ;;
        --no-webapp)
            PROFILES=$(echo "$PROFILES" | sed 's/webapp,//; s/,webapp//')
            ;;
        --no-dist)
            PROFILES=$(echo "$PROFILES" | sed 's/dist,//; s/,dist//')
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

if [ "$SHOW_HELP" = true ]; then
    echo "Open Customer System - Build Script"
    echo ""
    echo "Usage: ./build.sh [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help"
    echo "  --skipTests     Skip running tests (default)"
    echo "  --with-tests    Run tests during build"
    echo "  --no-webapp     Skip frontend build"
    echo "  --no-dist       Skip distribution package"
    echo ""
    echo "Default: ./build.sh → mvnw -Pwebapp,dist -DskipTests clean install"
    exit 0
fi

# Check Java
if [ -n "$JAVA_HOME" ]; then
    JAVA="$JAVA_HOME/bin/java"
else
    JAVA="java"
fi

JAVA_VERSION=$($JAVA -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d. -f1)
if [ -z "$JAVA_VERSION" ] || [ "$JAVA_VERSION" -lt 17 ]; then
    echo "ERROR: Java 17 or higher is required. Found: $JAVA_VERSION"
    exit 1
fi

echo "========================================"
echo " Open Customer System - Build"
echo "========================================"
echo " Java:     $($JAVA -version 2>&1 | head -n 1)"
echo " Profiles: $PROFILES"
echo " Tests:    $([ -z "$SKIP_TESTS" ] && echo 'enabled' || echo 'skipped')"
echo " Started:  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

BUILD_CMD="./mvnw"
if [ -n "$PROFILES" ]; then
    BUILD_CMD="$BUILD_CMD -P$PROFILES"
fi
if [ -n "$SKIP_TESTS" ]; then
    BUILD_CMD="$BUILD_CMD $SKIP_TESTS"
fi
BUILD_CMD="$BUILD_CMD clean install"

echo "Running: $BUILD_CMD"
echo ""

eval "$BUILD_CMD"

BUILD_RESULT=$?

echo ""
echo "========================================"
if [ $BUILD_RESULT -eq 0 ]; then
    echo " BUILD SUCCESS"
    if [ -d "dist" ]; then
        echo " Distribution: $(ls dist/*.tar.gz 2>/dev/null || echo 'N/A')"
    fi
else
    echo " BUILD FAILED (exit code: $BUILD_RESULT)"
fi
echo " Finished: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

exit $BUILD_RESULT
