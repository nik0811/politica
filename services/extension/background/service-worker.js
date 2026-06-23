// Politica Collector - Background Service Worker
// Handles communication between content scripts and the Politica API

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Service Worker] Received message:', message.type)

  try {
    if (message.type === 'SEND_TO_API') {
      handleSendToApi(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_TO_API success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_TO_API error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'SEND_TO_INSTAGRAM_API') {
      handleSendToInstagramApi(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_TO_INSTAGRAM_API success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_TO_INSTAGRAM_API error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'SEND_TO_FACEBOOK_API') {
      handleSendToFacebookApi(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_TO_FACEBOOK_API success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_TO_FACEBOOK_API error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'SEND_TO_TWITTER_API') {
      handleSendToTwitterApi(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_TO_TWITTER_API success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_TO_TWITTER_API error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'SEND_BATCH_TO_API') {
      handleSendBatch(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_BATCH_TO_API success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_BATCH_TO_API error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'GET_CONFIG') {
      chrome.storage.sync.get(['apiUrl', 'apiToken'], (config) => {
        console.log('[Service Worker] GET_CONFIG retrieved')
        sendResponse(config)
      })
      return true
    }

    if (message.type === 'TEST_CONNECTION') {
      console.log('[Service Worker] TEST_CONNECTION starting with:', { apiUrl: message.apiUrl, hasToken: !!message.apiToken })
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

    if (message.type === 'COLLECTOR_STATUS') {
      // Store status so popup can retrieve it when opened
      chrome.storage.session.set({ collectorStatus: message.payload }).catch(() => {
        // session storage may not be available in all contexts
        chrome.storage.local.set({ collectorStatus: message.payload })
      })
      return false
    }

    if (message.type === 'INSTAGRAM_SCRAPER_STATUS') {
      // Store Instagram scraper status for popup
      chrome.storage.session.set({ instagramScraperStatus: message.payload }).catch(() => {
        chrome.storage.local.set({ instagramScraperStatus: message.payload })
      })
      return false
    }

    if (message.type === 'SEND_PAGE_HTML') {
      handleSendPageHtml(message.payload)
        .then(res => {
          console.log('[Service Worker] SEND_PAGE_HTML success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] SEND_PAGE_HTML error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'CAPTURE_SCREENSHOT') {
      handleCaptureScreenshot(message.documentId, sender.tab && sender.tab.windowId)
        .then(res => {
          console.log('[Service Worker] CAPTURE_SCREENSHOT success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] CAPTURE_SCREENSHOT error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    if (message.type === 'EXTRACT_TWEET_REPLIES') {
      handleExtractTweetReplies(message.tweetUrl, sender.tab.id)
        .then(res => {
          console.log('[Service Worker] EXTRACT_TWEET_REPLIES success')
          sendResponse(res)
        })
        .catch(err => {
          console.error('[Service Worker] EXTRACT_TWEET_REPLIES error:', err)
          sendResponse({ error: err.message })
        })
      return true
    }

    console.warn('[Service Worker] Unknown message type:', message.type)
  } catch (err) {
    console.error('[Service Worker] Unexpected error in message handler:', err)
    sendResponse({ error: 'Internal service worker error: ' + err.message })
  }
})

async function getApiConfig() {
  const config = await chrome.storage.sync.get(['apiUrl', 'apiToken'])
  const apiUrl = (config.apiUrl || 'http://localhost:8000').replace(/\/$/, '')
  const apiToken = config.apiToken || ''

  if (!apiToken) {
    throw new Error('API token not configured. Open extension settings.')
  }

  return { apiUrl, apiToken }
}

async function handleSendToApi(payload) {
  const { apiUrl, apiToken } = await getApiConfig()

  // Route to the correct ingestion endpoint based on platform
  const platform = payload.platform || 'instagram'
  const endpoint = `${apiUrl}/api/ingest/${platform}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function handleSendToInstagramApi(payload) {
  const { apiUrl, apiToken } = await getApiConfig()

  const response = await fetch(`${apiUrl}/api/ingest/instagram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Instagram API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function handleSendToFacebookApi(payload) {
  const { apiUrl, apiToken } = await getApiConfig()

  const response = await fetch(`${apiUrl}/api/ingest/facebook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Facebook API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function handleSendToTwitterApi(payload) {
  const { apiUrl, apiToken } = await getApiConfig()

  const response = await fetch(`${apiUrl}/api/ingest/twitter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Twitter API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function handleSendBatch(payload) {
  const { apiUrl, apiToken } = await getApiConfig()
  const documents = payload.documents || []

  if (documents.length === 0) {
    return { success: true, count: 0 }
  }

  // Try batch endpoint first
  try {
    const response = await fetch(`${apiUrl}/api/documents/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ documents })
    })

    if (response.ok) {
      return response.json()
    }

    // If batch endpoint doesn't exist (404), fall back to individual sends
    if (response.status === 404) {
      return await sendIndividually(documents, apiUrl, apiToken)
    }

    const text = await response.text()
    throw new Error(`Batch API error ${response.status}: ${text}`)
  } catch (err) {
    if (err.message.includes('Batch API error')) throw err
    // Network error or batch not supported — fall back
    return await sendIndividually(documents, apiUrl, apiToken)
  }
}

async function sendIndividually(documents, apiUrl, apiToken) {
  let saved = 0
  let errors = 0

  for (const doc of documents) {
    try {
      const response = await fetch(`${apiUrl}/api/documents/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify(doc)
      })
      if (response.ok) {
        saved++
      } else {
        errors++
      }
    } catch (e) {
      errors++
    }
  }

  return { success: true, count: saved, errors }
}

async function handleSendPageHtml(payload) {
  const { apiUrl, apiToken } = await getApiConfig()

  const response = await fetch(`${apiUrl}/api/ingest/page-html`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      html: payload.html,
      url: payload.url,
      platform: payload.platform,
      context: payload.context || {}
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Page HTML API error ${response.status}: ${text}`)
  }

  return response.json()
}

async function handleCaptureScreenshot(documentId, windowId) {
  const { apiUrl, apiToken } = await getApiConfig()

  const dataUrl = await new Promise((resolve, reject) => {
    const captureOpts = { format: 'jpeg', quality: 60 }
    if (windowId) {
      chrome.tabs.captureVisibleTab(windowId, captureOpts, (url) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(url)
      })
    } else {
      chrome.tabs.captureVisibleTab(null, captureOpts, (url) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(url)
      })
    }
  })

  // Strip the data URL prefix to get raw base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

  const response = await fetch(`${apiUrl}/api/ingest/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      document_id: documentId,
      image_data: base64,
      platform: 'instagram'
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Screenshot upload error ${response.status}: ${text}`)
  }

  return response.json()
}

async function testConnection(apiUrl, apiToken) {
  const url = (apiUrl || 'http://localhost:8000').replace(/\/$/, '')

  if (!apiToken) {
    throw new Error('API token is required')
  }

  try {
    // Test against the health endpoint first (no auth needed)
    console.log('[Service Worker] Testing health endpoint:', url + '/health')
    const healthResponse = await fetch(`${url}/health`)
    
    if (!healthResponse.ok) {
      throw new Error(`Server not reachable (HTTP ${healthResponse.status})`)
    }

    console.log('[Service Worker] Health check passed, testing token...')
    
    // Now test the token against the ingest test endpoint
    const tokenTestResponse = await fetch(`${url}/api/ingest/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ test: true })
    })

    // 401/403 means bad token
    if (tokenTestResponse.status === 401 || tokenTestResponse.status === 403) {
      throw new Error('Invalid API token')
    }

    // 200 or 404 (endpoint not found but auth passed) both mean success
    console.log('[Service Worker] Token test passed')
    return { success: true, status: 200 }
  } catch (err) {
    console.error('[Service Worker] testConnection failed:', err)
    throw err
  }
}

async function handleExtractTweetReplies(tweetUrl, sourceTabId) {
  console.log('[Service Worker] Opening tweet in new tab:', tweetUrl)
  
  return new Promise((resolve, reject) => {
    // Open the tweet URL in a new tab
    chrome.tabs.create({ url: tweetUrl, active: false }, (newTab) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message))
      }

      console.log('[Service Worker] New tab created:', newTab.id)
      const newTabId = newTab.id
      let timeoutId

      // Listen for messages from the new tab
      const messageListener = (message, sender) => {
        if (sender.tab?.id === newTabId && message.type === 'TWEET_REPLIES_READY') {
          console.log('[Service Worker] Received replies from new tab')
          clearTimeout(timeoutId)
          chrome.runtime.onMessage.removeListener(messageListener)
          
          // Close the new tab
          chrome.tabs.remove(newTabId, () => {
            console.log('[Service Worker] Closed new tab')
          })
          
          resolve({ replies: message.replies || [] })
        }
      }

      chrome.runtime.onMessage.addListener(messageListener)

      // Timeout after 8 seconds
      timeoutId = setTimeout(() => {
        console.log('[Service Worker] Timeout waiting for replies')
        chrome.runtime.onMessage.removeListener(messageListener)
        chrome.tabs.remove(newTabId, () => {})
        resolve({ replies: [] })
      }, 8000)
    })
  })
}
