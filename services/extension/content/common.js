// Politica Collector - Common Utilities
// Shared across all platform content scripts

window.PoliticaCollector = {
  /**
   * Send a document to the Politica API via the background service worker.
   */
  async sendToApi(document) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SEND_TO_API', payload: document }, response => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message))
        }
        if (response?.error) {
          return reject(new Error(response.error))
        }
        resolve(response)
      })
    })
  },

  /**
   * Display a toast notification inside the current page.
   */
  showNotification(message, type = 'info') {
    const existing = document.getElementById('politica-toast')
    if (existing) existing.remove()

    const el = document.createElement('div')
    el.id = 'politica-toast'
    el.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      padding: 12px 20px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px; font-weight: 500; max-width: 320px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white; transition: opacity 0.3s ease;
    `
    el.textContent = message
    document.body.appendChild(el)

    setTimeout(() => {
      el.style.opacity = '0'
      setTimeout(() => el.remove(), 300)
    }, 4000)
  },

  /**
   * Parse engagement count strings like "1.2K", "4.5M", "12,345" into integers.
   */
  parseCount(text) {
    if (!text) return 0
    const t = text.trim().toUpperCase().replace(/,/g, '')
    if (t.endsWith('K')) return Math.round(parseFloat(t) * 1000)
    if (t.endsWith('M')) return Math.round(parseFloat(t) * 1_000_000)
    if (t.endsWith('B')) return Math.round(parseFloat(t) * 1_000_000_000)
    return parseInt(t.replace(/[^0-9]/g, ''), 10) || 0
  },

  /**
   * Detect platform from current URL.
   */
  detectPlatform(url = window.location.href) {
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('facebook.com')) return 'facebook'
    if (url.includes('x.com') || url.includes('twitter.com')) return 'twitter'
    return null
  },

  /**
   * Debounce helper — returns a function that delays invoking fn until after wait ms.
   */
  debounce(fn, wait = 300) {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), wait)
    }
  },

  /**
   * Auto-scroll a page collecting post links until maxPosts reached or no new links found.
   * Options:
   *   getPostLinks  () => string[]         - returns currently visible post URLs
   *   onProgress    (collected, seen) => void
   *   maxPosts      number (default 500)
   *   scrollDelay   number ms (default 1500)
   */
  async autoScrollAndCollect(options) {
    const {
      getPostLinks,
      onProgress,
      maxPosts = 500,
      scrollDelay = 1500
    } = options

    const seen = new Set()
    const collected = []
    let noNewStreak = 0
    const MAX_STREAK = 5

    while (collected.length < maxPosts && noNewStreak < MAX_STREAK) {
      const links = getPostLinks().filter(l => !seen.has(l))

      for (const link of links) {
        seen.add(link)
        collected.push(link)
        if (onProgress) onProgress(collected.length, seen.size)
        if (collected.length >= maxPosts) break
      }

      if (links.length === 0) {
        noNewStreak++
      } else {
        noNewStreak = 0
      }

      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, scrollDelay))

      const mainScroll = document.querySelector('main, [role="main"], div[style*="overflow"]')
      if (mainScroll) mainScroll.scrollTop += 2000
    }

    return collected
  },

  /**
   * Send the current page HTML to the backend AI extraction endpoint,
   * save the result as a document, and return the extracted data.
   */
  async extractWithAI(hint = '') {
    const html = document.documentElement.outerHTML
    const config = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, r))
    const apiUrl = (config?.apiUrl || 'http://localhost:8000').replace(/\/$/, '')
    const apiToken = config?.apiToken || ''

    window.PoliticaCollector.showNotification('Asking AI to analyze page...', 'info')

    const response = await fetch(`${apiUrl}/api/intelligence/extract-from-html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        html: html.slice(0, 50000),
        url: window.location.href,
        platform: window.location.hostname.replace('www.', '').split('.')[0],
        hint
      })
    })

    if (!response.ok) throw new Error(`AI extraction failed: ${response.status}`)
    const data = await response.json()

    if (data.title || data.content) {
      await window.PoliticaCollector.sendToApi({
        title: data.title || 'AI-extracted content',
        content: data.content || '',
        url: window.location.href,
        platform: window.location.hostname.replace('www.', '').split('.')[0],
        source_type: 'social_media',
        author: data.author || '',
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        metadata: { comments: data.comments || [], ai_extracted: true }
      })
      window.PoliticaCollector.showNotification(
        `AI extracted: "${(data.title || '').slice(0, 40)}"`,
        'success'
      )
    }

    return data
  },

  /**
   * Wait for a condition to become true, polling at the given interval.
   * Returns true if condition met, false if timeout.
   */
  async waitFor(conditionFn, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 5000
    intervalMs = intervalMs || 200
    var elapsed = 0
    while (elapsed < timeoutMs) {
      if (conditionFn()) return true
      await new Promise(function (r) { setTimeout(r, intervalMs) })
      elapsed += intervalMs
    }
    return false
  },

  /**
   * Expand truncated text by clicking "Show more" / "See more" style buttons
   * within a container element.
   */
  expandTruncatedText(container) {
    if (!container) container = document
    var patterns = [
      /see\s*more/i,
      /show\s*more/i,
      /read\s*more/i,
      /continue\s*reading/i,
      /\.\.\.\s*more/i
    ]
    var buttons = container.querySelectorAll(
      '[role="button"], button, a[role="link"], span[role="link"]'
    )
    var clicked = 0

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 30) continue

      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try { btn.click(); clicked++ } catch (e) { /* ignore */ }
          break
        }
      }
    }
    return clicked
  },

  /**
   * Detect if the page has reached the end of its feed
   * (no more content will load with further scrolling).
   */
  detectEndOfFeed() {
    var endIndicators = [
      'You\'ve seen all',
      'No more posts',
      'End of results',
      'Nothing more to show',
      'You\'re all caught up',
      'No more tweets'
    ]

    var bodyText = document.body.innerText || ''
    var lastScreenText = bodyText.slice(-2000)

    for (var i = 0; i < endIndicators.length; i++) {
      if (lastScreenText.indexOf(endIndicators[i]) !== -1) return true
    }

    // Check if scroll position hasn't changed after a scroll attempt
    var atBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 50)
    return atBottom
  },

  /**
   * Send page HTML to server for AI-assisted decision making.
   * Returns action instructions: { action, selector, reason }
   */
  async requestServerGuidance(context) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({
        type: 'SEND_PAGE_HTML',
        payload: {
          html: (document.querySelector('[role="main"]') || document.body).innerHTML.slice(0, 30000),
          url: window.location.href,
          platform: window.PoliticaCollector.detectPlatform(),
          context: context || {}
        }
      }, function (response) {
        if (chrome.runtime.lastError) {
          return resolve(null)
        }
        if (response && response.error) {
          return resolve(null)
        }
        resolve(response)
      })
    })
  },

  /**
   * Process a server guidance response and execute the suggested action.
   * Returns true if an action was taken successfully.
   */
  async executeServerAction(action) {
    if (!action || !action.action) return false

    switch (action.action) {
      case 'scroll':
        window.scrollTo(0, document.body.scrollHeight)
        return true
      case 'click':
        if (action.selector) {
          var el = document.querySelector(action.selector)
          if (el) { el.click(); return true }
        }
        return false
      case 'collect':
        return true
      case 'skip':
        return true
      case 'stop':
        return false
      default:
        return false
    }
  }
}
