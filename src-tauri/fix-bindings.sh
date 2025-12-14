#!/bin/bash
# Post-process ts-rs generated bindings to fix missing imports
# This is a workaround for ts-rs not generating imports for types referenced in #[ts(type = "...")]

BINDINGS_DIR="$(dirname "$0")/bindings"

# Fix SynniaProject.ts - add Asset import if missing
SYNNIA_PROJECT="$BINDINGS_DIR/SynniaProject.ts"
if [ -f "$SYNNIA_PROJECT" ]; then
    if ! grep -q 'import type { Asset }' "$SYNNIA_PROJECT"; then
        # Insert Asset import after the first line
        sed -i.bak '1a\
import type { Asset } from "./Asset";
' "$SYNNIA_PROJECT"
        rm -f "$SYNNIA_PROJECT.bak"
        echo "[fix-bindings] Added Asset import to SynniaProject.ts"
    fi
fi

echo "[fix-bindings] Done"
