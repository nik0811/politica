# Politica Extension Service Worker Fix

## Problem Summary

The extension was showing "Could not establish connection. Receiving end does not exist." error when trying to test the API connection. This indicated that the service worker wasn't properly responding to messages from the popup.

## Root Causes Identified

1. **Missing Error Handling**: The service worker's message listener lacked comprehensive error handling and logging
2. **Improper Response Handling**: The `GET_CONFIG` message wasn't properly wrapping the callback in a function
3. **No Logging**: Without console logs, it was impossible to debug where the connection was failing
4. **No Timeout Protection**: The popup had no timeout for service worker responses, so it could hang indefinitely

## Fixes Applied

### 1. Service Worker Message Listener (`services/extension/background/service-worker.js`)

**Added:**
- Comprehensive logging for all message types
- Try-catch wrapper around the entire message handler
- Proper error logging with context
- Explicit console.warn for unknown message types
- Better error messages with "Internal service worker error" prefix

**Key Changes:**
```javascript
// Before: Direct sendResponse without error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.apiUrl, message.apiToken)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
})

// After: Wrapped with logging and error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Service Worker] Received message:', message.type)
  try {
    if (message.type === 'TEST_CONNECTION') {
      console.log('[Service Worker] TEST_CONNECTION starting...')
      testConnection(message.apiUrl, message.apiToken)
        .then(res => {
          console.log('[Service Worker] TEST_CONNECTION success:', res)
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] TEST_CONNECTION error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }
  } catch (err) {
    console.error('[Service Worker] Unexpected error:', err)
    sendResponse({ error: 'Internal service worker error: ' + err.message })
  }
})
```

### 2. Test Connection Function (`services/extension/background/service-worker.js`)

**Added:**
- Detailed logging at each step of the connection test
- Better error messages with HTTP status codes
- Try-catch wrapper for network errors

**Key Changes:**
```javascript
// Now logs:
// - Health endpoint URL being tested
// - When health check passes
// - When token test starts
// - When token test passes
// - Any errors with full context
```

### 3. Popup Connection Check (`services/extension/popup/popup.js`)

**Added:**
- 5-second timeout for service worker responses
- Detailed logging of the entire flow
- Better error handling with specific error messages
- Null check for response object
- Timeout error message if service worker doesn't respond

**Key Changes:**
```javascript
// Before: Could hang indefinitely
chrome.runtime.sendMessage(
  { type: 'TEST_CONNECTION', ... },
  res => {
    if (chrome.runtime.lastError) return reject(...)
    if (res?.error) return reject(...)
    resolve(res)
  }
)

// After: 5-second timeout + detailed logging
const timeout = setTimeout(() => {
  reject(new Error('Service worker did not respond (timeout)'))
}, 5000)

chrome.runtime.sendMessage(
  { type: 'TEST_CONNECTION', ... },
  res => {
    clearTimeout(timeout)
    console.log('[Popup] Received response:', res)
    if (chrome.runtime.lastError) return reject(...)
    if (!res) return reject(new Error('No response from service worker'))
    if (res.error) return reject(...)
    resolve(res)
  }
)
```

## How to Test the Fix

### Step 1: Reload the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Find "Politica Collector" in the list
3. Click the **Reload** button (circular arrow icon)
4. Wait for the extension to reload (should take 1-2 seconds)

### Step 2: Open the Extension Popup

1. Click the Politica Collector extension icon in the Chrome toolbar
2. The popup should open and show the API connection status

### Step 3: Check the Connection Status

**Expected Behavior:**
- If API is running and configured: Shows "Connected" with a green dot
- If API is down: Shows "Not reachable" with a red dot
- If not configured: Shows "Not configured" with a red dot

### Step 4: Debug Using Chrome DevTools

If the connection still fails, check the service worker logs:

1. Go to `chrome://extensions`
2. Find "Politica Collector" and click **Details**
3. Scroll down and click **Inspect views** → **service worker**
4. In the DevTools console, you'll see logs like:
   ```
   [Service Worker] Received message: TEST_CONNECTION
   [Service Worker] TEST_CONNECTION starting with: {apiUrl: "http://localhost:8000", hasToken: true}
   [Service Worker] Testing health endpoint: http://localhost:8000/health
   [Service Worker] Health check passed, testing token...
   [Service Worker] Token test passed
   [Service Worker] TEST_CONNECTION success: {success: true, status: 200}
   ```

### Step 5: Check Popup Logs

1. Right-click the Politica Collector icon
2. Select **Inspect popup**
3. In the DevTools console, you'll see logs like:
   ```
   [Popup] Sending TEST_CONNECTION message to service worker
   [Popup] Received response from service worker: {success: true, status: 200}
   [Popup] Connection test successful
   ```

## Troubleshooting

### Issue: "Service worker did not respond (timeout)"

**Causes:**
- Service worker crashed or failed to load
- Extension not properly installed
- Chrome extension permissions issue

**Solution:**
1. Reload the extension again
2. Check `chrome://extensions` to ensure extension is enabled
3. Look for red error messages on the extension card
4. Check the service worker logs for errors

### Issue: "Invalid API token"

**Causes:**
- Token in extension settings is incorrect
- Token has expired
- Token doesn't have proper permissions

**Solution:**
1. Go to extension options (right-click icon → Options)
2. Verify the API token is correct
3. Generate a new token if needed
4. Save and reload the extension

### Issue: "Server not reachable"

**Causes:**
- API server is not running
- API URL is incorrect
- Network connectivity issue

**Solution:**
1. Verify API server is running: `python3 -m uvicorn main:app --host 0.0.0.0 --port 8000`
2. Check API URL in extension options
3. Verify network connectivity to the API server

## Console Logging Reference

All logs are prefixed with context:
- `[Service Worker]` - Logs from the background service worker
- `[Popup]` - Logs from the popup script

This makes it easy to trace the flow of messages and identify where issues occur.

## Files Modified

1. `services/extension/background/service-worker.js` - Added comprehensive logging and error handling
2. `services/extension/popup/popup.js` - Added timeout protection and detailed logging

## Next Steps

After confirming the fix works:
1. Test collecting content from Instagram/Facebook/Twitter
2. Verify batch uploads work correctly
3. Check auto-collect and deep scrape features
4. Monitor service worker logs for any new errors
