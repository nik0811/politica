;(function () {
  'use strict'

  // Global scraper state
  let scraperState = {
    isRunning: false,
    postsCollected: 0,
    commentsCollected: 0,
    errors: 0,
    state: 'idle'
  }

  // ── Message listener ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'COLLECT_PAGE') {
      collectTwitterPage()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'COLLECT_POST') {
      collectTweet()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'COLLECT_ALL') {
      collectAllTweets(message.maxPosts || 200)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'DEEP_SCRAPE_PROFILE') {
      scraperState.isRunning = true
      scraperState.postsCollected = 0
      scraperState.commentsCollected = 0
      scraperState.errors = 0
      scraperState.state = 'running'
      collectAllTweets(message.options?.maxPosts || 50)
        .then(res => {
          scraperState.isRunning = false
          scraperState.state = 'done'
          sendResponse(res)
        })
        .catch(err => {
          scraperState.isRunning = false
          scraperState.state = 'idle'
          sendResponse({ error: err.message })
        })
      return true
    }
    if (message.type === 'STOP_DEEP_SCRAPE') {
      scraperState.isRunning = false
      scraperState.state = 'idle'
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'GET_SCRAPER_STATUS') {
      sendResponse({
        isRunning: scraperState.isRunning,
        postsCollected: scraperState.postsCollected,
        commentsCollected: scraperState.commentsCollected,
        errors: scraperState.errors,
        state: scraperState.state
      })
      return true
    }
    if (message.type === 'EXTRACT_WITH_AI') {
      window.PoliticaCollector.extractWithAI(message.hint || '')
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
  })

  // ── Send doc directly to Twitter API endpoint ────────────────────────────────
  function sendToTwitterApi(doc) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SEND_TO_TWITTER_API', payload: doc }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        if (response?.error) return reject(new Error(response.error))
        resolve(response)
      })
    })
  }

  // ── Page dispatcher ──────────────────────────────────────────────────────────
  async function collectTwitterPage() {
    const url = window.location.href

    // Individual tweet / status page
    if (url.match(/\/(status|statuses)\/\d+/)) {
      return collectTweet()
    }

    // Profile / home / search timeline — collect all visible tweets
    const tweets = collectTimelineTweets()
    if (tweets.length === 0) {
      return { type: 'unknown', url, message: 'No tweets found on page' }
    }

    // Send each tweet as a separate document
    const results = []
    for (const tweet of tweets) {
      try {
        const result = await sendToTwitterApi(tweet)
        results.push({ success: true, id: result?.id })
      } catch (err) {
        results.push({ error: err.message })
      }
    }

    const saved = results.filter(r => r.success).length
    window.PoliticaCollector.showNotification(
      `Saved ${saved} of ${tweets.length} tweets`,
      saved > 0 ? 'success' : 'error'
    )
    return { type: 'timeline', total: tweets.length, saved }
  }

  // ── Single tweet scraper ─────────────────────────────────────────────────────
  async function collectTweet() {
    const url = window.location.href

    // Primary tweet article on status pages
    const primaryArticle = document.querySelector('article[data-testid="tweet"]')
    if (!primaryArticle) {
      return { error: 'No tweet found on this page' }
    }

    const tweet = extractTweetData(primaryArticle, url)

    // Replies — all subsequent article elements on the same status page
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    const replyArticles = allArticles.slice(1)
    const replies = replyArticles.map(el => {
      const d = extractTweetData(el, url)
      return { author: d.author, content: d.content, likes_count: d.likes_count }
    }).filter(r => r.content && r.content !== tweet.content)

    tweet.comments_count = replies.length
    tweet.metadata = { ...tweet.metadata, replies }

    try {
      const result = await sendToTwitterApi(tweet)
      window.PoliticaCollector.showNotification(
        `Saved tweet (${replies.length} replies)`,
        'success'
      )
      return { success: true, id: result?.id, replies: replies.length }
    } catch (err) {
      window.PoliticaCollector.showNotification(err.message, 'error')
      return { error: err.message }
    }
  }

  // ── Timeline collector (profile / home / search) ─────────────────────────────
  function collectTimelineTweets() {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    return articles.map(el => extractTweetData(el, window.location.href)).filter(t => t.content)
  }

  // ── Data extractor ───────────────────────────────────────────────────────────
  function extractTweetData(articleEl, pageUrl) {
    // Text content — Twitter uses lang attribute spans
    const textEl = articleEl.querySelector('[data-testid="tweetText"]')
    const content = textEl?.textContent?.trim() || ''
    const title = content.slice(0, 200)

    // Author handle
    const userEl = articleEl.querySelector('[data-testid="User-Name"] a[href^="/"]')
    const author = userEl?.getAttribute('href')?.replace('/', '') || ''

    // Tweet permalink (status pages have a time > a structure)
    const timeLink = articleEl.querySelector('a[href*="/status/"] time')?.closest('a')
    const tweetUrl = timeLink ? `https://x.com${timeLink.getAttribute('href')}` : pageUrl

    // Engagement counts — aria-labels on action group buttons
    const counts = { likes_count: 0, retweet_count: 0, reply_count: 0, view_count: 0 }
    articleEl.querySelectorAll('[data-testid]').forEach(el => {
      const testId = el.getAttribute('data-testid') || ''
      const spanText = el.querySelector('span[data-testid="app-text-transition-container"] span')?.textContent?.trim()
      if (!spanText) return
      const val = window.PoliticaCollector.parseCount(spanText)
      if (testId === 'like') counts.likes_count = val
      if (testId === 'retweet') counts.retweet_count = val
      if (testId === 'reply') counts.reply_count = val
    })

    // View count — rendered as separate element
    const viewEl = articleEl.querySelector('[aria-label*="View"] span, [data-testid="views"] span')
    if (viewEl) counts.view_count = window.PoliticaCollector.parseCount(viewEl.textContent)

    return {
      title,
      text: content,
      platform_url: tweetUrl,
      platform: 'twitter',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: counts.likes_count,
      comments_count: counts.reply_count,
      metadata: {
        retweet_count: counts.retweet_count,
        view_count: counts.view_count
      }
    }
  }

  // ── Timeline auto-scroll collector with deep extraction ───────────────────
  async function collectAllTweets(maxPosts) {
    const url = window.location.href

    // If on a single tweet status page, deep-scrape that tweet and its replies
    if (url.match(/\/(status|statuses)\/\d+/)) {
      const result = await collectTweetDeep()
      return result
    }

    const seen = new Set()
    let total = 0
    let noNewStreak = 0
    let saved = 0

    window.PoliticaCollector.showNotification('Starting timeline deep scrape...', 'info')

    while (total < maxPosts && noNewStreak < 5 && scraperState.isRunning) {
      // Click any "Show more" / expansion buttons
      clickTwitterLoadMore()

      const tweets = document.querySelectorAll('[data-testid="tweet"]')
      let newFound = 0

      for (const tweet of tweets) {
        if (!scraperState.isRunning) break

        const textEl = tweet.querySelector('[data-testid="tweetText"]')
        const text = textEl?.textContent?.trim()
        if (!text || seen.has(text.slice(0, 100))) continue
        seen.add(text.slice(0, 100))
        newFound++
        total++

        try {
          // Click on the tweet to open it
          const tweetLink = tweet.querySelector('a[href*="/status/"]')
          if (tweetLink) {
            tweetLink.click()
            await new Promise(r => setTimeout(r, 1500))
          }

          // Extract full tweet data with all replies
          const fullData = extractFullTweetData()
          
          // Send to API
          await sendToTwitterApi(fullData)
          saved++
          scraperState.postsCollected = saved
          scraperState.commentsCollected += (fullData.metadata?.replies?.length || 0)

          // Go back to timeline
          window.history.back()
          await new Promise(r => setTimeout(r, 1000))
        } catch (err) {
          scraperState.errors++
          console.error('Error processing tweet:', err)
          try { window.history.back() } catch (e) { /* ignore */ }
          await new Promise(r => setTimeout(r, 500))
        }

        if (total >= maxPosts) break
      }

      noNewStreak = newFound === 0 ? noNewStreak + 1 : 0

      if (saved > 0 && saved % 5 === 0) {
        window.PoliticaCollector.showNotification(`Deep scraping... ${saved}/${total} saved`, 'info')
      }

      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 2000))
    }

    window.PoliticaCollector.showNotification(`Collected ${saved} of ${total} tweets`, 'success')
    return { success: true, count: total, saved }
  }

  // ── Deep-scrape a single tweet page (expand replies then save) ──────────────
  async function collectTweetDeep() {
    window.PoliticaCollector.showNotification('Deep scraping tweet... expanding replies', 'info')

    // Expand replies a few times
    for (let i = 0; i < 5 && scraperState.isRunning; i++) {
      expandAllReplies()
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 1200))
    }

    const primaryArticle = document.querySelector('article[data-testid="tweet"]')
    if (!primaryArticle) {
      scraperState.errors++
      return { error: 'No tweet found on this page' }
    }

    const tweet = extractTweetData(primaryArticle, window.location.href)
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    const replies = allArticles.slice(1)
      .map(el => {
        const d = extractTweetData(el, window.location.href)
        return { author: d.author, content: d.text, likes_count: d.likes_count }
      })
      .filter(r => r.content && r.content !== tweet.text)

    tweet.comments_count = replies.length
    tweet.metadata = { ...tweet.metadata, replies }

    scraperState.postsCollected = 1
    scraperState.commentsCollected = replies.length

    try {
      await sendToTwitterApi(tweet)
      window.PoliticaCollector.showNotification(
        `Saved tweet with ${replies.length} replies`, 'success'
      )
      return { success: true, count: 1, saved: 1, comments: replies.length }
    } catch (err) {
      scraperState.errors++
      window.PoliticaCollector.showNotification(err.message, 'error')
      return { error: err.message }
    }
  }

  // ── Extract full tweet data with all replies ────────────────────────────────
  function extractFullTweetData() {
    // Primary tweet
    const primaryArticle = document.querySelector('article[data-testid="tweet"]')
    if (!primaryArticle) {
      return { error: 'No tweet found' }
    }

    const tweet = extractTweetData(primaryArticle, window.location.href)

    // Expand all "Show more replies" buttons
    expandAllReplies()

    // Extract all replies
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    const replyArticles = allArticles.slice(1)
    const replies = replyArticles.map(el => {
      const d = extractTweetData(el, window.location.href)
      return { author: d.author, content: d.text, likes_count: d.likes_count }
    }).filter(r => r.content && r.content !== tweet.text)

    tweet.comments_count = replies.length
    tweet.metadata = { ...tweet.metadata, replies }

    return tweet
  }

  // ── Expand all reply sections ──────────────────────────────────────────────
  function expandAllReplies() {
    let expanded = 0
    const patterns = [
      /show\s*more\s*replies/i,
      /show\s*replies/i,
      /show\s*this\s*thread/i,
      /show\s*more/i,
      /view\s*more/i
    ]

    const buttons = document.querySelectorAll('[role="button"]')
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim()
      if (text.length > 60) continue

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          try {
            btn.click()
            expanded++
          } catch (e) { /* ignore */ }
          break
        }
      }
    }

    return expanded
  }

  // ── Twitter-specific load-more helpers ──────────────────────────────────────
  function clickTwitterLoadMore() {
    var clicked = 0

    // "Show more replies" / "Show replies" / "Show" buttons
    var buttons = document.querySelectorAll(
      '[data-testid="cellInnerDiv"] [role="button"], [role="button"]'
    )
    var patterns = [
      /show\s*more\s*replies/i,
      /show\s*replies/i,
      /show\s*this\s*thread/i,
      /show\s*more/i,
      /view\s*more/i
    ]

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 50) continue

      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try { btn.click(); clicked++ } catch (e) { /* ignore */ }
          break
        }
      }
    }

    // "Show more" link for truncated tweets
    var showMoreLinks = document.querySelectorAll('a[href*="/status/"] span')
    for (var j = 0; j < showMoreLinks.length; j++) {
      var link = showMoreLinks[j]
      if (/show\s*more/i.test((link.textContent || '').trim())) {
        try { link.closest('a').click(); clicked++ } catch (e) { /* ignore */ }
      }
    }

    return clicked
  }

  // Expose for collector-manager
  window.PoliticaTwitter = {
    clickLoadMore: clickTwitterLoadMore,
    collectTweet: collectTweet,
    collectPage: collectTwitterPage
  }
})()
