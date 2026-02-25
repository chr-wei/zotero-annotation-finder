#!/bin/bash

# Configuration
PLUGIN_NAME="zotero_annotation_finder"
BUILD_DIR="build"
OUTPUT_XPI="${PLUGIN_NAME}.xpi"

echo "Building ${OUTPUT_XPI}..."

# Remove old build files
rm -f "${OUTPUT_XPI}"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Files to include
FILES=(
    "manifest.json"
    "bootstrap.js"
    "chrome.manifest"
    "content"
    "skin"
    "locale"
)

# Copy files to build directory
for file in "${FILES[@]}"; do
    if [ -e "$file" ]; then
        cp -r "$file" "${BUILD_DIR}/"
    else
        echo "Warning: $file not found, skipping."
    fi
done

# Create XPI (zip)
cd "${BUILD_DIR}"
zip -r "../${OUTPUT_XPI}" . -x "*.DS_Store"

cd ..
rm -rf "${BUILD_DIR}"

echo "Build complete: ${OUTPUT_XPI}"
