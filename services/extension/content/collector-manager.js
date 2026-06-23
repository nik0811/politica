;(function () {
  'use strict'

  var STATE_IDLE = 'idle'
  var STATE_SCROLLING = 'scrolling'
  var STATE_COLLECTING = 'collecting'
  var STATE_WAITING = 'waiting'
  var STATE_PAUSED = 'paused'
  var STATE_DONE = 'done'
  var STATE_ERROR = 'error'

  var BATCH_SIZE = 10
  var MAX_RETRIES = 3
  var RETRY_DELAY_MS = 2000

  window.PoliticaCollectorManager = {
    state: STATE_IDLE,
    postsCollected: 0,
    pagesScrolled: 0,
    errors: 0,
    batch: [],
    collectedIds: new Set(),
    _abortFlag: false,
    _scrollDelay: 1500,
    _maxPosts: 500,
    _observer: null,
    _newContentDetected: false,

    start: function (options) {
      options = options || {}
      this._scrollDelay = options.scrollDelay || 1500
      this._maxPosts = options.maxPosts || 500
      this._abortFlag = false
      this.postsCollected = 0
      this.pagesScrolled = 0
      this.errors = 0
      this.batch = []
      this.collectedIds = new Set()
      this.state = STATE_SCROLLING

      this._reportStatus()
      this._startMutationObserver()
      this._runLoop()
    },

    stop: function () {
      this._abortFlag = true
      this.state = STATE_DONE
      this._stopMutationObserver()
      this._flushBatch()
      this._reportStatus()
    },

    pause: function () {
      this._abortFlag = true
      this.state = STATE_PAUSED
      this._reportStatus()
    },

    resume: function () {
      if (this.state !== STATE_PAUSED) return
      this._abortFlag = false
      this.state = STATE_SCROLLING
      this._reportStatus()
      this._runLoop()
    },

    getStatus: function () {
      return {
        state: this.state,
        postsCollected: this.postsCollected,
        pagesScrolled: this.pagesScrolled,
        errors: this.errors
      }
    },

    _reportStatus: function () {
      try {
        chrome.runtime.sendMessage({
          type: 'COLLECTOR_STATUS',
          payload: this.getStatus()
        })
      } catch (e) { /* popup may be closed */ }
    },

    _startMutationObserver: function () {
      var self = this
      this._newContentDetected = false

      this._observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0) {
            self._newContentDetected = true
            break
          }
        }
      })

      var targetNode = document.querySelector('[role="main"]') || document.body
      this._observer.observe(targetNode, { childList: true, subtree: true })
    },

    _stopMutationObserver: function () {
      if (this._observer) {
        this._observer.disconnect()
        this._observer = null
      }
    },

    _runLoop: async function () {
      var noNewStreak = 0
      var MAX_NO_NEW = 5

      while (!this._abortFlag && this.postsCollected < this._maxPosts) {
        this.state = STATE_SCROLLING
        this._reportStatus()

        // Click any "load more" or "show more" buttons
        this._clickLoadMoreButtons()

        // Wait a short moment for buttons to trigger loads
        await this._sleep(500)

        // Collect visible posts via platform-specific scraper
        this.state = STATE_COLLECTING
        this._reportStatus()

        var newPosts = this._collectVisiblePosts()
        if (newPosts.length > 0) {
          noNewStreak = 0
          for (var i = 0; i < newPosts.length; i++) {
            if (this.postsCollected >= this._maxPosts) break
            this.batch.push(newPosts[i])
            this.postsCollected++

            if (this.batch.length >= BATCH_SIZE) {
              await this._flushBatch()
            }
          }
          this._reportStatus()
        } else {
          noNewStreak++
        }

        // Check if we've hit the end
        if (noNewStreak >= MAX_NO_NEW) {
          // Ask server for guidance if available
          var aiAction = await this._askServerForGuidance()
          if (aiAction && aiAction.action === 'scroll') {
            noNewStreak = 0
          } else if (aiAction && aiAction.action === 'click' && aiAction.selector) {
            var el = document.querySelector(aiAction.selector)
            if (el) {
              el.click()
              noNewStreak = 0
              await this._sleep(1500)
            }
          } else if (aiAction && aiAction.action === 'stop') {
            break
          } else {
            break
          }
        }

        // Scroll down
        this._newContentDetected = false
        this._scrollDown()
        this.pagesScrolled++

        // Wait for content to load
        this.state = STATE_WAITING
        this._reportStatus()
        await this._waitForNewContent()
      }

      // Flush remaining batch
      await this._flushBatch()

      if (!this._abortFlag) {
        this.state = STATE_DONE
        this._stopMutationObserver()
        this._reportStatus()
        window.PoliticaCollector.showNotification(
          'Auto-collect complete: ' + this.postsCollected + ' posts collected',
          'success'
        )
      }
    },

    _collectVisiblePosts: function () {
      var platform = window.PoliticaCollector.detectPlatform()
      var posts = []

      if (platform === 'twitter') {
        posts = this._collectTwitterPosts()
      } else if (platform === 'instagram') {
        posts = this._collectInstagramPosts()
      } else if (platform === 'facebook') {
        posts = this._collectFacebookPosts()
      }

      return posts
    },

    _collectTwitterPosts: function () {
      var self = this
      var posts = []
      var articles = document.querySelectorAll('article[data-testid="tweet"]')

      for (var i = 0; i < articles.length; i++) {
        var article = articles[i]
        var textEl = article.querySelector('[data-testid="tweetText"]')
        var text = textEl ? textEl.textContent.trim() : ''
        if (!text) continue

        var postId = text.slice(0, 100)
        if (self.collectedIds.has(postId)) continue
        self.collectedIds.add(postId)

        var userEl = article.querySelector('[data-testid="User-Name"] a[href^="/"]')
        var author = userEl ? userEl.getAttribute('href').replace('/', '') : ''
        var linkEl = article.querySelector('a[href*="/status/"]')
        var tweetUrl = linkEl ? 'https://x.com' + linkEl.getAttribute('href') : window.location.href

        var likesEl = article.querySelector('[data-testid="like"] span[data-testid="app-text-transition-container"] span')
        var likesCount = window.PoliticaCollector.parseCount(likesEl ? likesEl.textContent : '0')

        posts.push({
          title: text.slice(0, 200),
          content: text,
          url: tweetUrl,
          platform: 'twitter',
          source_type: 'social_media',
          author: author,
          language: 'en',
          likes_count: likesCount
        })
      }

      return posts
    },

    _collectInstagramPosts: function () {
      var self = this
      var posts = []
      var anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')

      for (var i = 0; i < anchors.length; i++) {
        var anchor = anchors[i]
        var href = anchor.href
        if (self.collectedIds.has(href)) continue
        self.collectedIds.add(href)

        var img = anchor.querySelector('img')
        var captionPreview = (img ? img.alt || '' : '').slice(0, 200)

        posts.push({
          title: captionPreview || 'Instagram post',
          content: captionPreview,
          url: href,
          platform: 'instagram',
          source_type: 'social_media',
          metadata: { thumbnail: img ? img.src : '', needs_full_extraction: true }
        })
      }

      return posts
    },

    _collectFacebookPosts: function () {
      var self = this
      var posts = []
      var elements = document.querySelectorAll('[data-pagelet*="FeedUnit"], [role="article"]')

      for (var i = 0; i < elements.length; i++) {
        var el = elements[i]
        var textEl = el.querySelector('[dir="auto"]')
        var text = textEl ? textEl.textContent.trim() : ''
        var key = text.slice(0, 100)
        if (!key || self.collectedIds.has(key)) continue
        self.collectedIds.add(key)

        var linkEl = el.querySelector('a[href*="/posts/"], a[href*="?story_fbid"]')

        posts.push({
          title: text.slice(0, 200),
          content: text,
          url: linkEl ? linkEl.href : window.location.href,
          platform: 'facebook',
          source_type: 'social_media',
          language: 'en'
        })
      }

      return posts
    },

    _clickLoadMoreButtons: function () {
      var platform = window.PoliticaCollector.detectPlatform()
      var selectors = []

      if (platform === 'twitter') {
        selectors = [
          '[data-testid="cellInnerDiv"] [role="button"]',
          'div[aria-label*="Show"] [role="button"]'
        ]
      } else if (platform === 'instagram') {
        selectors = [
          'button:not([disabled])',
          '[role="button"]'
        ]
      } else if (platform === 'facebook') {
        selectors = [
          '[role="button"]'
        ]
      }

      var loadMorePatterns = [
        /load\s*more/i,
        /show\s*more/i,
        /see\s*more/i,
        /view\s*more/i,
        /more\s*comments/i,
        /more\s*replies/i,
        /view\s*all/i,
        /show\s*all/i,
        /continue\s*reading/i,
        /read\s*more/i
      ]

      for (var s = 0; s < selectors.length; s++) {
        var buttons = document.querySelectorAll(selectors[s])
        for (var b = 0; b < buttons.length; b++) {
          var btn = buttons[b]
          var btnText = (btn.textContent || '').trim()
          if (btnText.length > 50) continue

          for (var p = 0; p < loadMorePatterns.length; p++) {
            if (loadMorePatterns[p].test(btnText)) {
              try { btn.click() } catch (e) { /* ignore */ }
              break
            }
          }
        }
      }
    },

    _scrollDown: function () {
      window.scrollTo(0, document.body.scrollHeight)

      var scrollContainer = document.querySelector(
        '[role="main"], main, [data-testid="primaryColumn"]'
      )
      if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    },

    _waitForNewContent: async function () {
      var waited = 0
      var interval = 200
      var maxWait = this._scrollDelay + 3000

      while (!this._newContentDetected && waited < maxWait && !this._abortFlag) {
        await this._sleep(interval)
        waited += interval
      }

      // Minimum delay to avoid rate limiting
      if (waited < this._scrollDelay) {
        await this._sleep(this._scrollDelay - waited)
      }
    },

    _flushBatch: async function () {
      if (this.batch.length === 0) return

      var toSend = this.batch.splice(0, this.batch.length)

      for (var attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await this._sendBatchToApi(toSend)
          return
        } catch (e) {
          this.errors++
          if (attempt < MAX_RETRIES - 1) {
            await this._sleep(RETRY_DELAY_MS * (attempt + 1))
          }
        }
      }

      // If all retries failed, try sending individually
      for (var i = 0; i < toSend.length; i++) {
        try {
          await window.PoliticaCollector.sendToApi(toSend[i])
        } catch (e) {
          this.errors++
        }
      }
    },

    _sendBatchToApi: function (documents) {
      return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({
          type: 'SEND_BATCH_TO_API',
          payload: { documents: documents }
        }, function (response) {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message))
          }
          if (response && response.error) {
            return reject(new Error(response.error))
          }
          resolve(response)
        })
      })
    },

    _askServerForGuidance: async function () {
      try {
        var config = await new Promise(function (r) {
          chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, r)
        })
        var apiUrl = ((config && config.apiUrl) || 'http://localhost:8000').replace(/\/$/, '')
        var apiToken = (config && config.apiToken) || ''
        if (!apiToken) return null

        var relevantHtml = this._getRelevantDomSection()

        var response = await fetch(apiUrl + '/api/ingest/page-html', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiToken
          },
          body: JSON.stringify({
            html: relevantHtml,
            url: window.location.href,
            platform: window.PoliticaCollector.detectPlatform(),
            context: {
              posts_collected: this.postsCollected,
              pages_scrolled: this.pagesScrolled,
              current_scroll_position: window.scrollY,
              page_height: document.body.scrollHeight
            }
          })
        })

        if (!response.ok) return null
        return await response.json()
      } catch (e) {
        return null
      }
    },

    _getRelevantDomSection: function () {
      var main = document.querySelector('[role="main"]') ||
                 document.querySelector('main') ||
                 document.querySelector('[data-testid="primaryColumn"]')

      if (main) {
        return main.innerHTML.slice(0, 30000)
      }
      return document.body.innerHTML.slice(0, 30000)
    },

    _sleep: function (ms) {
      return new Promise(function (resolve) { setTimeout(resolve, ms) })
    }
  }

  // Listen for commands from popup / background
  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (message.type === 'AUTO_COLLECT_START') {
      window.PoliticaCollectorManager.start(message.options || {})
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'AUTO_COLLECT_STOP') {
      window.PoliticaCollectorManager.stop()
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'AUTO_COLLECT_PAUSE') {
      window.PoliticaCollectorManager.pause()
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'AUTO_COLLECT_RESUME') {
      window.PoliticaCollectorManager.resume()
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'AUTO_COLLECT_STATUS') {
      sendResponse(window.PoliticaCollectorManager.getStatus())
      return true
    }
  })
})()
