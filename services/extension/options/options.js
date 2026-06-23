'use strict'

const apiUrlInput  = document.getElementById('api-url')
const apiTokenInput= document.getElementById('api-token')
const saveBtn      = document.getElementById('save-btn')
const testBtn      = document.getElementById('test-btn')
const saveResult   = document.getElementById('save-result')
const testResult   = document.getElementById('test-result')
const portalLink   = document.getElementById('portal-link')

// ── Load saved settings ───────────────────────────────────────────────────────
;(async function load() {
  const config = await chrome.storage.sync.get(['apiUrl', 'apiToken'])
  apiUrlInput.value   = config.apiUrl   || 'http://localhost:8000'
  apiTokenInput.value = config.apiToken || ''

  // Build portal link from saved API URL
  if (config.apiUrl) {
    const base = config.apiUrl.replace(/\/$/, '')
    portalLink.href = `${base}/admin`
  }
})()

// ── Save settings ─────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const apiUrl   = apiUrlInput.value.trim().replace(/\/$/, '')
  const apiToken = apiTokenInput.value.trim()

  if (!apiUrl) {
    showResult(saveResult, 'error', 'API URL is required.')
    return
  }

  try {
    new URL(apiUrl)
  } catch {
    showResult(saveResult, 'error', 'Please enter a valid URL (e.g. http://localhost:8000).')
    return
  }

  await chrome.storage.sync.set({ apiUrl, apiToken })

  // Update portal link
  portalLink.href = `${apiUrl}/admin`

  showResult(saveResult, 'success', 'Settings saved.')
})

// ── Test connection ───────────────────────────────────────────────────────────
testBtn.addEventListener('click', async () => {
  const apiUrl   = apiUrlInput.value.trim().replace(/\/$/, '')
  const apiToken = apiTokenInput.value.trim()

  if (!apiUrl || !apiToken) {
    showResult(testResult, 'error', 'Please fill in both the API URL and token before testing.')
    return
  }

  testBtn.disabled = true
  testBtn.textContent = 'Testing...'
  hideResult(testResult)

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'TEST_CONNECTION', apiUrl, apiToken },
        res => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
          if (res?.error) return reject(new Error(res.error))
          resolve(res)
        }
      )
    })
    showResult(testResult, 'success', `Connected successfully (HTTP ${result.status}).`)
  } catch (err) {
    showResult(testResult, 'error', `Connection failed: ${err.message}`)
  } finally {
    testBtn.disabled = false
    testBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Test Connection`
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function showResult(el, type, message) {
  el.textContent = message
  el.className = type
  el.style.display = 'block'
  setTimeout(() => hideResult(el), 6000)
}

function hideResult(el) {
  el.style.display = 'none'
}
