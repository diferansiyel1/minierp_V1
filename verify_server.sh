#!/bin/bash

# Ensure we are in the project root
if [ ! -d "backend" ]; then
    echo "Error: Please run this script from the project root directory (minierp/)."
    exit 1
fi

export PYTHONPATH=$(pwd)
echo "==========================================="
echo "Running Server Compliance & Setup Tests"
echo "==========================================="
# Run verbose to show individual tests
pytest -v backend/tests/test_server_setup.py

SETUP_EXIT_CODE=$?

echo ""
echo "==========================================="
echo "Running Critical Functionality Flow Tests"
echo "==========================================="
pytest -v backend/tests/test_critical_flows.py

FLOW_EXIT_CODE=$?

echo ""
echo "==========================================="
echo "Test Summary"
echo "==========================================="

if [ $SETUP_EXIT_CODE -eq 0 ] && [ $FLOW_EXIT_CODE -eq 0 ]; then
    echo "✅ All System Checks Passed!"
    echo "The application code is functional and server-compatible."
else
    echo "❌ Some checks failed."
    echo "Please review the errors above."
fi
