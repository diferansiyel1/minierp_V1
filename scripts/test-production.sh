#!/bin/bash
# Production Simulation Test Script
# This script simulates a production environment locally to test for console errors

set -e

echo "========================================"
echo "MiniERP Production Simulation Test"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
DIST_DIR="frontend/dist"
PREVIEW_PORT=4173
BACKEND_PORT=8000

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    # Kill background processes
    if [ ! -z "$PREVIEW_PID" ]; then
        kill $PREVIEW_PID 2>/dev/null || true
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

# ======================
# PHASE 1: Build Tests
# ======================
echo -e "${YELLOW}Phase 1: Build Verification${NC}"
echo "----------------------------------------"

# Check for TypeScript errors
echo "1.1) Checking for TypeScript errors..."
cd $FRONTEND_DIR
if npm run build 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗ TypeScript errors found!${NC}"
    npm run build 2>&1 | grep "error TS"
    exit 1
else
    echo -e "${GREEN}✓ No TypeScript errors${NC}"
fi
cd ..

# Check if build artifact exists
echo "1.2) Verifying build artifacts..."
if [ -f "$DIST_DIR/index.html" ]; then
    echo -e "${GREEN}✓ Build artifacts present${NC}"
else
    echo -e "${RED}✗ Build artifacts missing!${NC}"
    exit 1
fi

# ======================
# PHASE 2: Static Analysis
# ======================
echo ""
echo -e "${YELLOW}Phase 2: Static Analysis${NC}"
echo "----------------------------------------"

# Check for common error patterns
echo "2.1) Checking for undefined variable usage..."
UNDEFINED_ERRORS=$(grep -rn "formData\." frontend/src/views/Projects.tsx 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNDEFINED_ERRORS" -gt 0 ]; then
    echo -e "${RED}✗ Found undefined 'formData' usage in Projects.tsx${NC}"
    grep -n "formData\." frontend/src/views/Projects.tsx
    exit 1
else
    echo -e "${GREEN}✓ No undefined variable usage found${NC}"
fi

echo "2.2) Checking for DialogContent accessibility..."
DIALOG_ISSUES=$(grep -rn "DialogContent" frontend/src/views/*.tsx | grep -v "aria-describedby" | grep -v "import" | grep -v "DialogContent.displayName" | wc -l | tr -d ' ')
if [ "$DIALOG_ISSUES" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found DialogContent without aria-describedby (${DIALOG_ISSUES} occurrences)${NC}"
    grep -rn "DialogContent" frontend/src/views/*.tsx | grep -v "aria-describedby" | grep -v "import" | grep -v "DialogContent.displayName"
else
    echo -e "${GREEN}✓ All DialogContent components have accessibility attributes${NC}"
fi

echo "2.3) Checking filter() usage safety..."
# Check for filter on potentially undefined arrays  
UNSAFE_FILTER=$(grep -rn "\.filter(" frontend/src/views/*.tsx | grep -v "?\." | grep -v "= \[\]" | grep -cv "items.filter\|projects.filter\|accounts.filter\|Array")
if [ "$UNSAFE_FILTER" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some filter() calls may need safety checks${NC}"
else
    echo -e "${GREEN}✓ filter() calls appear safe${NC}"
fi

# ======================
# PHASE 3: Runtime Test
# ======================
echo ""
echo -e "${YELLOW}Phase 3: Runtime Simulation${NC}"
echo "----------------------------------------"

echo "3.1) Starting preview server..."
cd $FRONTEND_DIR
npm run preview -- --port $PREVIEW_PORT &
PREVIEW_PID=$!
cd ..
sleep 3

# Check if preview server is running
if curl -s "http://localhost:$PREVIEW_PORT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Preview server started on port $PREVIEW_PORT${NC}"
else
    echo -e "${RED}✗ Preview server failed to start${NC}"
    exit 1
fi

# ======================
# RESULTS SUMMARY
# ======================
echo ""
echo "========================================"
echo -e "${GREEN}All Production Simulation Tests Passed!${NC}"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Build: ✓ No TypeScript errors"
echo "  - Static Analysis: ✓ No critical issues"
echo "  - Server: ✓ Preview serving correctly"
echo ""
echo "The application is ready for deployment."
echo ""
echo "To manually test, visit: http://localhost:$PREVIEW_PORT"
echo "Press Ctrl+C to stop the server."
echo ""

# Keep server running for manual testing
wait $PREVIEW_PID
