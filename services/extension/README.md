# Politica Collector — Browser Extension

A Manifest V3 browser extension that scrapes posts and comments from Instagram, Facebook, and Twitter/X using your already-logged-in browser session, then sends the data directly to your Politica API server.

---

## Installation (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `services/extension/` folder inside this repository
5. The **Politica Collector** extension will appear in your toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `services/extension/manifest.json`

> **Note:** Firefox requires a re-load after each browser restart for temporary add-ons. For permanent installation, the extension would need to be signed via AMO.

---

## Configuration

1. Click the **Politica Collector** icon in the toolbar
2. Click the ⚙ settings icon (top-right of the popup)
3. Enter your settings:

| Field | Description | Default |
|---|---|---|
| **API Server URL** | Base URL of your Politica API | `http://localhost:8000` |
| **API Token** | JWT or API token from the admin portal | *(required)* |

4. Click **Save Settings**, then **Test Connection** to verify

### Getting an API Token

1. Open your Politica Admin Portal (e.g. `http://localhost:3000`)
2. Log in and go to **Profile → API Tokens**
3. Generate a new token and paste it in the extension settings

---

## Usage

### Collecting a Single Post

1. Navigate to an Instagram post (`/p/…`), a Facebook post, or a tweet (`/status/…`)
2. Click the **Politica Collector** icon
3. Click **Collect This Post** (or **Collect This Page**)
4. A green toast appears on the page confirming the save

### Collecting a Twitter Timeline / Search

1. Navigate to any Twitter/X profile, home feed, or search results page
2. Click the extension icon → **Collect Timeline Tweets**
3. All visible tweets are sent to the API in one action

### Collecting Instagram Profile Posts

1. Navigate to an Instagram profile page
2. Click **Collect Page Posts** — the extension returns a list of visible post links
3. Open each post individually and click **Collect This Post**

---

## What data is collected?

Each document sent to the API contains:

```json
{
  "title": "Post caption (first 200 chars)",
  "content": "Full text content",
  "url": "https://...",
  "platform": "instagram | facebook | twitter",
  "source_type": "social_media",
  "author": "username or handle",
  "language": "en",
  "likes_count": 1234,
  "comments_count": 56,
  "metadata": {
    "comments": [
      { "author": "user", "content": "comment text", "likes_count": 0 }
    ]
  }
}
```

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Save API URL and token across browser sessions |
| `activeTab` | Read the URL of the current tab to detect platform |
| `scripting` | Inject content scripts when triggered |
| `host_permissions` (instagram/facebook/x/twitter) | Allow content scripts to run and API calls to be made on those domains |

---

## Troubleshooting

**"API token not configured"**
→ Open the extension settings and enter your API token.

**"Not reachable" in the popup status bar**
→ Make sure your Politica API server is running and the URL is correct. If the server uses HTTPS, ensure the certificate is trusted.

**No data appears after collecting**
→ The page's DOM structure may have changed. Check the browser console for errors on the Instagram/Facebook/Twitter tab.

**Content script not responding**
→ Reload the social media tab and try again. Some pages require a full page load before the content script activates.

---

## Development

The extension is plain JavaScript — no build step required.

Edit any file, then go to `chrome://extensions` and click the **refresh icon** on the Politica Collector card.

File structure:

```
services/extension/
├── manifest.json           # Manifest V3 config
├── background/
│   └── service-worker.js   # API forwarding, config storage
├── content/
│   ├── common.js           # Shared utilities (sendToApi, showNotification, parseCount)
│   ├── instagram.js        # Instagram scraper
│   ├── facebook.js         # Facebook scraper
│   └── twitter.js          # Twitter/X scraper
├── popup/
│   ├── popup.html          # Extension popup
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── options/
│   ├── options.html        # Settings page
│   └── options.js          # Settings logic
└── icons/
    └── icon.svg            # Extension icon
```
