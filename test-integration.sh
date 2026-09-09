#!/bin/bash
# =============================================================================
# test-integration.sh — C++ Parser Integration Test
# =============================================================================
# USAGE:  chmod +x test-integration.sh && ./test-integration.sh
#
# This script:
#   1. Compiles the C++ parser binary from scratch
#   2. Creates a fake 3-file JavaScript project
#   3. Runs the parser on it and pretty-prints the JSON output
#   4. Cleans up temp files
#
# Run this BEFORE testing the full API to isolate C++ issues from Node issues.
# =============================================================================

set -e  # Exit immediately on any error

echo ""
echo "=========================================="
echo "  C++ Parser Integration Test"
echo "=========================================="
echo ""

# -------------------------------------------------------------------------
# Step 1: Compile the C++ binary
# -------------------------------------------------------------------------
echo "📦 Step 1: Compiling C++ parser..."
cd "$(dirname "$0")/parser"

make clean && make

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ COMPILATION FAILED"
    echo "   Check that g++ is installed: g++ --version"
    echo "   Check that json.hpp exists: ls json.hpp"
    exit 1
fi

echo "✅ C++ binary compiled successfully"
echo ""

# -------------------------------------------------------------------------
# Step 2: Create temporary test files
# -------------------------------------------------------------------------
cd "$(dirname "$0")"

echo "📁 Step 2: Creating test files..."

TESTDIR="$(mktemp -d)"
mkdir -p "$TESTDIR/src"

# index.js imports App and utils
cat > "$TESTDIR/src/index.js" << 'EOF'
import App from './App';
import utils from './utils';

const app = new App();
app.start();
EOF

# App.js imports React (external, should be skipped)
cat > "$TESTDIR/src/App.js" << 'EOF'
import React from 'react';

export default class App {
    start() { console.log('Started'); }
}
EOF

# utils.js has no local imports
cat > "$TESTDIR/src/utils.js" << 'EOF'
export const helper = () => {};
export const formatDate = (d) => d.toISOString();
EOF

echo "   Created 3 test files in $TESTDIR"
echo ""

# -------------------------------------------------------------------------
# Step 3: Run the parser
# -------------------------------------------------------------------------
echo "🔍 Step 3: Running C++ parser on test files..."
echo ""

OUTPUT=$(./parser/parser "$TESTDIR")

echo "$OUTPUT" | python3 -m json.tool

echo ""

# -------------------------------------------------------------------------
# Step 4: Validate output
# -------------------------------------------------------------------------
NODE_COUNT=$(echo "$OUTPUT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['nodes']))")
LINK_COUNT=$(echo "$OUTPUT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['links']))")

echo "📊 Results: $NODE_COUNT nodes, $LINK_COUNT links"

if [ "$NODE_COUNT" -ge 3 ] && [ "$LINK_COUNT" -ge 1 ]; then
    echo "✅ Parser integration test PASSED"
else
    echo "❌ Parser integration test FAILED"
    echo "   Expected at least 3 nodes and 1 link"
    exit 1
fi

# -------------------------------------------------------------------------
# Step 5: Cleanup
# -------------------------------------------------------------------------
rm -rf "$TESTDIR"
echo "🧹 Test files cleaned up"
echo ""
echo "=========================================="
echo "  All tests passed! Ready for API testing."
echo "=========================================="
echo ""
