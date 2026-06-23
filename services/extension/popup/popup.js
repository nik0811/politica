'use strict'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const apiDot          = document.getElementById('api-dot')
const apiStatusText   = document.getElementById('api-status-text')
const platformBadge   = document.getElementById('platform-badge')
const platformName    = document.getElementById('platform-name')
const actionsArea     = document.getElementById('actions-area')
const collectPageBtn  = document.getElementById('collect-page-btn')
const collectPageLabel= document.getElementById('collect-page-label')
const collectPostBtn  = document.getElementById('collect-post-btn')
const unsupportedMsg  = document.getElementById('unsupported-msg')
const spinner         = document.getElementById('spinner')
const resultArea      = document.getElementById('result-area')
const resultIcon      = document.getElementById('result-icon')
const resultText      = document.getElementById('result-text')
const lastCollection  = document.getElementById('last-collection')
const lastTime        = document.getElementById('last-time')
const settingsLink    = document.getElementById('settings-link')

// Auto-collect refs
const autoCollectPanel     = document.getElementById('auto-collect-panel')
const autoCollectToggle    = document.getElementById('auto-collect-toggle')
const autoCollectLabel     = document.getElementById('auto-collect-toggle-label')
const autoCollectMaxPosts  = document.getElementById('auto-collect-max-posts')
const acState              = document.getElementById('ac-state')
const acPosts              = document.getElementById('ac-posts')
const acScrolls            = document.getElementById('ac-scrolls')
const acErrors             = document.getElementById('ac-errors')
const acProgressBar        = document.getElementById('ac-progress-bar')

// Deep scrape refs
const deepScrapePanel      = document.getElementById('deep-scrape-panel')
const deepScrapeToggle     = document.getElementById('deep-scrape-toggle')
const deepScrapeLabel      = document.getElementById('deep-scrape-toggle-label')
const deepScrapeMaxPosts   = document.getElementById('deep-scrape-max-posts')
const dsState              = document.getElementById('ds-state')
const dsPosts              = document.getElementById('ds-posts')
const dsComments           = document.getElementById('ds-comments')
const dsErrors             = document.getElementById('ds-errors')
const dsCurrent            = document.getElementById('ds-current')
const dsCurrentRow         = document.getElementById('ds-current-row')
const dsProgressBar        = document.getElementById('ds-progress-bar')

let autoCollectRunning = false
let deepScrapeRunning = false
let statusPollInterval = null
let deepScrapePollInterval = null

// ── Init ──────────────────────────────────────────────────────────────────────
;(async function init() {
  settingsLink.addEventListener('click', e => {
    e.preventDefault()
    chrome.runtime.openOptionsPage()
  })

  // Restore last collection time
  const stored = await chrome.storage.local.get(['lastCollectionTime', 'lastCollectionLabel'])
  if (stored.lastCollectionTime) {
    lastCollection.style.display = 'flex'
    lastTime.textContent = formatRelativeTime(stored.lastCollectionTime)
  }

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  const platform = detectPlatform(tab.url)
  renderPlatform(platform, tab.url)

  // Check API connectivity in parallel
  checkApiConnection()

  // Check if auto-collect is already running
  if (platform) {
    pollAutoCollectStatus()
  }
})()

// ── Platform detection ────────────────────────────────────────────────────────
function detectPlatform(url = '') {
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('facebook.com')) return 'facebook'
  if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter'
  return null
}

function isPostPage(url = '', platform) {
  if (platform === 'instagram') return /instagram\.com\/(p|reel)\//.test(url)
  if (platform === 'twitter')   return /\/(status|statuses)\/\d+/.test(url)
  return false
}

function renderPlatform(platform, url) {
  if (!platform) {
    platformName.textContent = 'Unsupported'
    actionsArea.style.display = 'none'
    unsupportedMsg.style.display = 'flex'
    autoCollectPanel.style.display = 'none'
    return
  }

  platformBadge.className = `platform-badge ${platform}`
  platformName.textContent = platform.charAt(0).toUpperCase() + platform.slice(1)

  collectPageBtn.disabled = false

  // Show auto-collect panel for supported platforms
  autoCollectPanel.style.display = 'block'
  autoCollectToggle.addEventListener('click', toggleAutoCollect)

  // Show deep scrape panel for all platforms (Instagram profiles, Facebook feeds, Twitter timelines)
  if ((platform === 'instagram' && !isPostPage(url, platform)) || 
      platform === 'facebook' || 
      (platform === 'twitter' && !isPostPage(url, platform))) {
    deepScrapePanel.style.display = 'block'
    deepScrapeToggle.addEventListener('click', toggleDeepScrape)
    pollDeepScrapeStatus()
  }

  if (platform === 'instagram') {
    if (/instagram\.com\/(p|reel)\//.test(url)) {
      collectPageLabel.textContent = 'Collect This Post'
      collectPostBtn.style.display = 'none'
    } else {
      collectPageLabel.textContent = 'Collect Page Posts'
      collectPostBtn.style.display = 'flex'
    }
  } else if (platform === 'twitter') {
    if (/\/(status|statuses)\/\d+/.test(url)) {
      collectPageLabel.textContent = 'Collect This Tweet'
      collectPostBtn.style.display = 'none'
      // For Twitter, recommend using Deep Scrape instead
      const note = document.createElement('p')
      note.style.cssText = 'font-size: 11px; color: #999; margin-top: 8px; font-style: italic;'
      note.textContent = 'Tip: Use "Deep Scrape Profile" to collect tweets with all replies'
      collectPageBtn.parentElement.appendChild(note)
    } else {
      collectPageLabel.textContent = 'Collect Timeline Tweets'
    }
  } else {
    collectPageLabel.textContent = 'Collect This Page'
  }

  collectPageBtn.addEventListener('click', () => runCollect('COLLECT_PAGE'))
  collectPostBtn.addEventListener('click', () => runCollect('COLLECT_POST'))
}

// ── Auto-Collect Toggle ───────────────────────────────────────────────────────
async function toggleAutoCollect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  if (autoCollectRunning) {
    chrome.tabs.sendMessage(tab.id, { type: 'AUTO_COLLECT_STOP' }, () => {})
    autoCollectRunning = false
    updateToggleUI(false)
    stopStatusPolling()
  } else {
    const maxPosts = parseInt(autoCollectMaxPosts?.value, 10) || 100
    chrome.tabs.sendMessage(tab.id, { type: 'AUTO_COLLECT_START', options: { maxPosts, scrollDelay: 1500 } }, (res) => {
      if (res && res.success) {
        autoCollectRunning = true
        updateToggleUI(true)
        startStatusPolling()
      }
    })
  }
}

function updateToggleUI(running) {
  if (running) {
    autoCollectToggle.classList.add('active')
    autoCollectLabel.textContent = 'Stop'
    autoCollectToggle.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
  } else {
    autoCollectToggle.classList.remove('active')
    autoCollectLabel.textContent = 'Start'
    autoCollectToggle.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>'
  }
}

function startStatusPolling() {
  stopStatusPolling()
  statusPollInterval = setInterval(pollAutoCollectStatus, 1000)
}

function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval)
    statusPollInterval = null
  }
}

async function pollAutoCollectStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  chrome.tabs.sendMessage(tab.id, { type: 'AUTO_COLLECT_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return
    updateAutoCollectUI(response)
  })
}

function updateAutoCollectUI(status) {
  if (!status) return

  var stateLabels = {
    idle: 'Idle',
    scrolling: 'Scrolling...',
    collecting: 'Collecting...',
    waiting: 'Waiting for content...',
    paused: 'Paused',
    done: 'Complete',
    error: 'Error'
  }

  acState.textContent = stateLabels[status.state] || status.state
  acState.className = 'progress-value state-' + status.state
  acPosts.textContent = status.postsCollected || 0
  acScrolls.textContent = status.pagesScrolled || 0
  acErrors.textContent = status.errors || 0

  // Progress bar (assume 500 max)
  var progress = Math.min((status.postsCollected || 0) / 500 * 100, 100)
  acProgressBar.style.width = progress + '%'

  // Update toggle state
  if (status.state === 'done' || status.state === 'idle' || status.state === 'error') {
    if (autoCollectRunning) {
      autoCollectRunning = false
      updateToggleUI(false)
      stopStatusPolling()
      if (status.postsCollected > 0) {
        saveLastCollection()
      }
    }
  } else {
    if (!autoCollectRunning) {
      autoCollectRunning = true
      updateToggleUI(true)
      startStatusPolling()
    }
  }
}

// ── Deep Scrape Toggle ─────────────────────────────────────────────────────────
async function toggleDeepScrape() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  if (deepScrapeRunning) {
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_DEEP_SCRAPE' }, () => {})
    deepScrapeRunning = false
    updateDeepScrapeToggleUI(false)
    stopDeepScrapePoll()
  } else {
    const maxPosts = parseInt(deepScrapeMaxPosts.value, 10) || 50
    const fromDate = document.getElementById('deep-scrape-from-date').value
    const toDate = document.getElementById('deep-scrape-to-date').value
    
    // Immediately update UI to show running state before we hear back from content script
    deepScrapeRunning = true
    updateDeepScrapeToggleUI(true)
    startDeepScrapePoll()
    chrome.tabs.sendMessage(tab.id, { 
      type: 'DEEP_SCRAPE_PROFILE', 
      options: { maxPosts, fromDate, toDate } 
    }, (res) => {
      // This callback fires when the ENTIRE scrape completes (could be minutes later)
      if (chrome.runtime.lastError || (res && res.error)) {
        deepScrapeRunning = false
        updateDeepScrapeToggleUI(false)
        stopDeepScrapePoll()
        if (res && res.error) showResult('error', res.error)
      }
      // If success, pollDeepScrapeStatus will handle UI reset via isRunning=false
    })
  }
}

function updateDeepScrapeToggleUI(running) {
  if (running) {
    deepScrapeToggle.classList.add('active')
    deepScrapeLabel.textContent = 'Stop'
    deepScrapeToggle.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    deepScrapeMaxPosts.disabled = true
    document.getElementById('deep-scrape-from-date').disabled = true
    document.getElementById('deep-scrape-to-date').disabled = true
  } else {
    deepScrapeToggle.classList.remove('active')
    deepScrapeLabel.textContent = 'Start'
    deepScrapeToggle.querySelector('svg').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>'
    deepScrapeMaxPosts.disabled = false
    document.getElementById('deep-scrape-from-date').disabled = false
    document.getElementById('deep-scrape-to-date').disabled = false
  }
}

function startDeepScrapePoll() {
  stopDeepScrapePoll()
  deepScrapePollInterval = setInterval(pollDeepScrapeStatus, 1000)
}

function stopDeepScrapePoll() {
  if (deepScrapePollInterval) {
    clearInterval(deepScrapePollInterval)
    deepScrapePollInterval = null
  }
}

async function pollDeepScrapeStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return

  chrome.tabs.sendMessage(tab.id, { type: 'GET_SCRAPER_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return
    updateDeepScrapeUI(response)
  })
}

function updateDeepScrapeUI(status) {
  if (!status) return

  const maxPosts = parseInt(deepScrapeMaxPosts.value, 10) || 50
  const fromDate = document.getElementById('deep-scrape-from-date').value
  const toDate = document.getElementById('deep-scrape-to-date').value
  const dsDateRangeRow = document.getElementById('ds-date-range-row')
  const dsCurrentDateRow = document.getElementById('ds-current-date-row')

  if (status.isRunning) {
    dsState.textContent = 'Scraping...'
    dsState.className = 'progress-value state-collecting'
    dsCurrentRow.style.display = 'flex'
    
    // Show date range if specified
    if (fromDate || toDate) {
      dsDateRangeRow.style.display = 'flex'
      const rangeText = (fromDate || '—') + ' to ' + (toDate || '—')
      document.getElementById('ds-date-range').textContent = rangeText
    }
    
    // Show current post date if available
    if (status.currentPostDate) {
      dsCurrentDateRow.style.display = 'flex'
      document.getElementById('ds-current-date').textContent = status.currentPostDate
    }
    
    if (status.currentPostUrl) {
      const shortUrl = status.currentPostUrl.replace('https://www.instagram.com', '')
      dsCurrent.textContent = shortUrl.slice(0, 25) + (shortUrl.length > 25 ? '...' : '')
      dsCurrent.title = status.currentPostUrl
    }
  } else {
    dsState.textContent = status.postsCollected > 0 ? 'Complete' : 'Idle'
    dsState.className = 'progress-value state-' + (status.postsCollected > 0 ? 'done' : 'idle')
    dsCurrentRow.style.display = 'none'
    dsDateRangeRow.style.display = 'none'
    dsCurrentDateRow.style.display = 'none'
  }

  dsPosts.textContent = status.postsCollected || 0
  dsComments.textContent = status.commentsCollected || 0
  dsErrors.textContent = status.errors || 0

  // Progress bar
  const progress = Math.min((status.postsCollected || 0) / maxPosts * 100, 100)
  dsProgressBar.style.width = progress + '%'

  // Update toggle state
  if (!status.isRunning && deepScrapeRunning) {
    deepScrapeRunning = false
    updateDeepScrapeToggleUI(false)
    stopDeepScrapePoll()
    if (status.postsCollected > 0) {
      saveLastCollection()
    }
  } else if (status.isRunning && !deepScrapeRunning) {
    deepScrapeRunning = true
    updateDeepScrapeToggleUI(true)
    startDeepScrapePoll()
  }
}

// ── Collection runner ─────────────────────────────────────────────────────────
async function runCollect(messageType) {
  setLoading(true)
  hideResult()

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    // For Twitter single tweet pages, use deep scrape instead of collect page
    const platform = detectPlatform(tab.url)
    if (platform === 'twitter' && /\/(status|statuses)\/\d+/.test(tab.url) && messageType === 'COLLECT_PAGE') {
      messageType = 'DEEP_SCRAPE_PROFILE'
    }

    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: messageType }, res => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        resolve(res)
      })
    })

    if (response?.error) {
      showResult('error', response.error)
    } else if (response?.success) {
      const details = []
      if (response.comments != null) details.push(`${response.comments} comments`)
      if (response.replies != null)  details.push(`${response.replies} replies`)
      if (response.saved != null)    details.push(`${response.saved} saved`)
      showResult('success', 'Saved successfully' + (details.length ? ` (${details.join(', ')})` : ''))
      await saveLastCollection()
    } else if (response?.count != null) {
      showResult('success', `Found ${response.count} posts on profile — open each post and click Collect.`)
    } else if (response?.total != null) {
      showResult(
        response.saved > 0 ? 'success' : 'error',
        `Saved ${response.saved} of ${response.total} tweets`
      )
      if (response.saved > 0) await saveLastCollection()
    } else {
      showResult('error', 'Unexpected response from page.')
    }
  } catch (err) {
    showResult('error', err.message)
  } finally {
    setLoading(false)
  }
}

// ── API connection check ──────────────────────────────────────────────────────
async function checkApiConnection() {
  apiDot.className = 'dot checking'
  apiStatusText.textContent = 'Checking...'

  const config = await chrome.storage.sync.get(['apiUrl', 'apiToken'])
  if (!config.apiToken) {
    apiDot.className = 'dot error'
    apiStatusText.textContent = 'Not configured'
    return
  }

  try {
    console.log('[Popup] Sending TEST_CONNECTION message to service worker')
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service worker did not respond (timeout)'))
      }, 5000)

      chrome.runtime.sendMessage(
        { type: 'TEST_CONNECTION', apiUrl: config.apiUrl, apiToken: config.apiToken },
        res => {
          clearTimeout(timeout)
          console.log('[Popup] Received response from service worker:', res)
          
          if (chrome.runtime.lastError) {
            console.error('[Popup] Chrome runtime error:', chrome.runtime.lastError)
            return reject(new Error(chrome.runtime.lastError.message))
          }
          
          if (!res) {
            console.error('[Popup] No response from service worker')
            return reject(new Error('No response from service worker'))
          }
          
          if (res.error) {
            console.error('[Popup] Service worker returned error:', res.error)
            return reject(new Error(res.error))
          }
          
          console.log('[Popup] Connection test successful')
          resolve(res)
        }
      )
    })
    apiDot.className = 'dot connected'
    apiStatusText.textContent = 'Connected'
  } catch (err) {
    console.error('[Popup] Connection check failed:', err.message)
    apiDot.className = 'dot error'
    apiStatusText.textContent = 'Not reachable'
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setLoading(loading) {
  spinner.style.display = loading ? 'flex' : 'none'
  collectPageBtn.disabled = loading
  collectPostBtn.disabled = loading
}

function showResult(type, message) {
  resultArea.className = `result ${type}`
  resultIcon.textContent = type === 'success' ? '✓' : '✗'
  resultText.textContent = message
  resultArea.style.display = 'flex'
}

function hideResult() {
  resultArea.style.display = 'none'
}

async function saveLastCollection() {
  const now = Date.now()
  await chrome.storage.local.set({ lastCollectionTime: now })
  lastCollection.style.display = 'flex'
  lastTime.textContent = formatRelativeTime(now)
}

function formatRelativeTime(ts) {
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  return `${Math.round(diffSec / 3600)}h ago`
}
