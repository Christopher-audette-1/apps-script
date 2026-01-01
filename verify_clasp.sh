#!/bin/bash

# 1. Reconstruct the global config file from your Jules environment variable
# This file already contains your refresh_token and access_token
echo "$CLASPRC_JSON_CONTENT" > ~/.clasprc.json

# 2. Verify connection (non-interactive)
echo "Verifying clasp status..."
clasp status
