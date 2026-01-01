#!/bin/bash

# 1. Verify Jules Tools login
echo "Checking Jules session..."
jules status

# 2. Reconstruct the credentials file from Environment Variables
# This avoids checking creds.json into git
echo "$CLASP_CREDS_JSON" > creds.json

# 3. Log in using the injected credentials
echo "Authenticating clasp..."
clasp login --creds creds.json

# 4. Test the connection to your specific project
echo "Testing project connection..."
clasp status

# 5. Clean up the temporary file for security
rm creds.json
