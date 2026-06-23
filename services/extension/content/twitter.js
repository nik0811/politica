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

  // ── Window message listener for cross-tab communication ──────────────────────
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'EXTRACT_REPLIES') {
      // Extract replies from current tweet page
      const replies = []
      const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
      
      // Skip the first one (main tweet), extract the rest (replies)
      for (let i = 1; i < allArticles.length; i++) {
        const replyEl = allArticles[i]
        const textEl = replyEl.querySelector('[data-testid="tweetText"]')
        const text = textEl?.textContent?.trim()
        if (!text) continue
        
        const authorEl = replyEl.querySelector('[data-testid="User-Name"]')
        const author = authorEl?.textContent?.trim() || 'unknown'
        
        const likeBtn = replyEl.querySelector('[data-testid="like"]')
        const likeText = likeBtn?.textContent?.trim() || '0'
        const likes = window.PoliticaCollector?.parseCount?.(likeText) || 0
        
        replies.push({
          author,
          text,
          likes
        })
      }
      
      // Send back to parent window
      window.opener?.postMessage({
        type: 'REPLIES_EXTRACTED',
        replies
      }, '*')
    }
  })

  // ── Send replies to service worker when page loads ──────────────────────────
  // Check if this is a tweet page opened by the scraper
  if (window.location.href.match(/\/(status|statuses)\/\d+/)) {
    // Wait for page to load and replies to render
    setTimeout(async () => {
      console.log('[Twitter Scraper] Extracting replies from tweet page')
      
      // Scroll down to load more replies
      for (let i = 0; i < 3; i++) {
        window.scrollTo(0, document.body.scrollHeight)
        await new Promise(r => setTimeout(r, 1000))
      }
      
      const replies = []
      const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
      
      console.log(`[Twitter Scraper] Found ${allArticles.length} articles on tweet page`)
      
      // Skip the first one (main tweet), extract the rest (replies)
      for (let i = 1; i < allArticles.length; i++) {
        const replyEl = allArticles[i]
        const textEl = replyEl.querySelector('[data-testid="tweetText"]')
        const text = textEl?.textContent?.trim()
        if (!text) {
          console.log(`[Twitter Scraper] Skipping article ${i} - no text found`)
          continue
        }
        
        const authorEl = replyEl.querySelector('[data-testid="User-Name"]')
        const author = authorEl?.textContent?.trim() || 'unknown'
        
        const likeBtn = replyEl.querySelector('[data-testid="like"]')
        const likeText = likeBtn?.textContent?.trim() || '0'
        const likes = window.PoliticaCollector?.parseCount?.(likeText) || 0
        
        const retweetBtn = replyEl.querySelector('[data-testid="retweet"]')
        const retweetText = retweetBtn?.textContent?.trim() || '0'
        const retweets = window.PoliticaCollector?.parseCount?.(retweetText) || 0
        
        console.log(`[Twitter Scraper] ✓ Reply from ${author}`)
        console.log(`[Twitter Scraper]   Text: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`)
        console.log(`[Twitter Scraper]   ❤️ ${likes} likes | 🔄 ${retweets} retweets`)
        
        replies.push({
          author,
          text,
          likes,
          retweets
        })
      }
      
      console.log(`[Twitter Scraper] ═══════════════════════════════════════`)
      console.log(`[Twitter Scraper] Total replies extracted: ${replies.length}`)
      console.log(`[Twitter Scraper] ═══════════════════════════════════════`)
      
      // Send to service worker
      chrome.runtime.sendMessage({
        type: 'TWEET_REPLIES_READY',
        replies
      }).catch((err) => {
        console.error('[Twitter Scraper] Error sending replies:', err)
      })
    }, 4000)  // Wait 4 seconds for initial load
  }

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

    // If on a single tweet status page, deep-scrape that tweet and its replies (don't navigate)
    if (url.match(/\/(status|statuses)\/\d+/)) {
      const result = await collectTweetDeep()
      return result
    }

    // Profile/Timeline scraping - use service worker to open tweets in new tabs
    const seen = new Set()
    let total = 0
    let noNewStreak = 0
    let saved = 0

    window.PoliticaCollector.showNotification('Starting profile scrape...', 'info')

    while (total < maxPosts && noNewStreak < 5 && scraperState.isRunning) {
      console.log(`[Twitter Scraper] Loop iteration - total: ${total}, saved: ${saved}`)
      
      // Click any "Show more" / expansion buttons (but NOT "Discover more")
      clickTwitterLoadMore()

      const tweets = document.querySelectorAll('[data-testid="tweet"]')
      console.log(`[Twitter Scraper] Found ${tweets.length} tweets on page`)
      let newFound = 0

      for (const tweet of tweets) {
        if (!scraperState.isRunning) break

        const textEl = tweet.querySelector('[data-testid="tweetText"]')
        const text = textEl?.textContent?.trim()
        if (!text || seen.has(text.slice(0, 100))) continue
        
        // Skip "Discover more" and promoted tweets
        if (text.toLowerCase().includes('discover more') || 
            tweet.querySelector('[data-testid="promotedBadge"]')) {
          continue
        }
        
        seen.add(text.slice(0, 100))
        newFound++
        total++

        try {
          // Get tweet URL
          const tweetLink = tweet.querySelector('a[href*="/status/"]')
          const tweetUrl = tweetLink?.href
          
          if (tweetUrl) {
            console.log(`[Twitter Scraper] Extracting replies for: ${tweetUrl}`)
            
            // Extract tweet data from profile page (basic info)
            const tweetData = extractTweetData(tweet, url)
            
            // Get reply count from the tweet element
            const replyBtn = tweet.querySelector('[data-testid="reply"]')
            const replyText = replyBtn?.textContent?.trim() || '0'
            const replyCount = window.PoliticaCollector.parseCount(replyText)
            
            tweetData.comments_count = replyCount
            
            // Use service worker to open tweet in new tab and extract replies
            let replies = []
            try {
              const result = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                  { type: 'EXTRACT_TWEET_REPLIES', tweetUrl },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message))
                    } else if (response?.error) {
                      reject(new Error(response.error))
                    } else {
                      resolve(response)
                    }
                  }
                )
              })
              replies = result.replies || []
              console.log(`[Twitter Scraper] Got ${replies.length} replies`)
            } catch (err) {
              console.log('[Twitter Scraper] Could not extract replies:', err)
            }
            
            tweetData.metadata = { replies }
            
            // Send to API
            await sendToTwitterApi(tweetData)
            saved++
            scraperState.postsCollected = saved
            scraperState.commentsCollected += replies.length

            // Show detailed reply info in console
            if (replies.length > 0) {
              console.log(`[Twitter Scraper] ═══════════════════════════════════════`)
              console.log(`[Twitter Scraper] Post: ${text.slice(0, 80)}...`)
              console.log(`[Twitter Scraper] Replies (${replies.length}):`)
              replies.forEach((reply, idx) => {
                console.log(`[Twitter Scraper]   ${idx + 1}. @${reply.author}`)
                console.log(`[Twitter Scraper]      "${reply.text.slice(0, 80)}${reply.text.length > 80 ? '...' : ''}"`)
                console.log(`[Twitter Scraper]      ❤️ ${reply.likes} | 🔄 ${reply.retweets || 0}`)
              })
              console.log(`[Twitter Scraper] ═══════════════════════════════════════`)
            }

            // Show progress
            window.PoliticaCollector.showNotification(
              `✓ ${saved} posts, ${scraperState.commentsCollected} replies`, 
              'info'
            )
          }
        } catch (err) {
          scraperState.errors++
          console.error('[Twitter Scraper] Error processing tweet:', err)
        }

        if (total >= maxPosts) break
      }

      noNewStreak = newFound === 0 ? noNewStreak + 1 : 0

      // Scroll to load more tweets
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 2500))
    }

    console.log(`[Twitter Scraper] Scraping complete - saved: ${saved}`)
    window.PoliticaCollector.showNotification(
      `✓ Collected ${saved} posts with ${scraperState.commentsCollected} total replies`, 
      'success'
    )
    return { success: true, count: total, saved, comments: scraperState.commentsCollected }
  }

  // ── Deep-scrape a single tweet page (expand replies then save) ──────────────
  async function collectTweetDeep() {
    window.PoliticaCollector.showNotification('Deep scraping tweet... expanding replies', 'info')

    const primaryArticle = document.querySelector('article[data-testid="tweet"]')
    if (!primaryArticle) {
      scraperState.errors++
      return { error: 'No tweet found on this page' }
    }

    // Expand replies multiple times with scrolling
    for (let i = 0; i < 8 && scraperState.isRunning; i++) {
      expandAllReplies()
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 1200))
    }

    const tweet = extractTweetData(primaryArticle, window.location.href)
    
    // Extract all replies with author info
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    const replies = allArticles.slice(1)
      .map(el => {
        const d = extractTweetData(el, window.location.href)
        return { 
          author: d.author, 
          author_name: extractAuthorName(el),
          content: d.text, 
          likes_count: d.likes_count 
        }
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
      // Mark as done - don't try to navigate or scrape more
      scraperState.isRunning = false
      return { success: true, count: 1, saved: 1, comments: replies.length }
    } catch (err) {
      scraperState.errors++
      scraperState.isRunning = false
      window.PoliticaCollector.showNotification(err.message, 'error')
      return { error: err.message }
    }
  }

  // ── Extract full tweet data with all replies ────────────────────────────────
  async function extractFullTweetDataWithReplies() {
    // Primary tweet
    const primaryArticle = document.querySelector('article[data-testid="tweet"]')
    if (!primaryArticle) {
      return { error: 'No tweet found' }
    }

    const tweet = extractTweetData(primaryArticle, window.location.href)

    // Scroll down and expand all "Show more replies" buttons multiple times
    for (let i = 0; i < 8; i++) {
      expandAllReplies()
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 1000))
    }

    // Extract all replies with full author info
    const allArticles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    const replyArticles = allArticles.slice(1)
    
    const replies = replyArticles
      .map(el => {
        const d = extractTweetData(el, window.location.href)
        return { 
          author: d.author, 
          author_name: extractAuthorName(el),
          content: d.text, 
          likes_count: d.likes_count 
        }
      })
      .filter(r => r.content && r.content !== tweet.text)

    tweet.comments_count = replies.length
    tweet.metadata = { ...tweet.metadata, replies }

    return tweet
  }

  // ── Extract author name from tweet element ──────────────────────────────────
  function extractAuthorName(articleEl) {
    const nameEl = articleEl.querySelector('[data-testid="User-Name"]')
    if (!nameEl) return ''
    const text = nameEl.textContent || ''
    // Format: "Name @handle" - extract just the name part
    const parts = text.split('@')
    return parts[0]?.trim() || ''
  }

  // ── Expand all reply sections (skip "Discover more") ────────────────────────
  function expandAllReplies() {
    let expanded = 0
    const patterns = [
      /show\s*more\s*replies/i,
      /show\s*replies/i,
      /show\s*this\s*thread/i,
      /show\s*more/i,
      /view\s*more/i
    ]
    
    // Patterns to SKIP
    const skipPatterns = [
      /discover\s*more/i,
      /promoted/i,
      /ad/i
    ]

    const buttons = document.querySelectorAll('[role="button"]')
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim()
      if (text.length > 60) continue
      
      // Skip "Discover more" and ads
      let shouldSkip = false
      for (const skipPattern of skipPatterns) {
        if (skipPattern.test(text)) {
          shouldSkip = true
          break
        }
      }
      if (shouldSkip) continue

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

  // ── Twitter-specific load-more helpers (skip "Discover more") ──────────────
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
    
    // Skip patterns
    var skipPatterns = [
      /discover\s*more/i,
      /promoted/i,
      /ad/i
    ]

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 50) continue
      
      // Skip "Discover more" and ads
      var shouldSkip = false
      for (var sp = 0; sp < skipPatterns.length; sp++) {
        if (skipPatterns[sp].test(text)) {
          shouldSkip = true
          break
        }
      }
      if (shouldSkip) continue

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
