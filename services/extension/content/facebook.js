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
      collectFacebookPage()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'COLLECT_ALL') {
      collectAllPosts(message.maxPosts || 100)
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
      collectAllPosts(message.options?.maxPosts || 50)
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

  // ── Send doc directly to Facebook API endpoint ───────────────────────────────
  function sendToFacebookApi(doc) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'SEND_TO_FACEBOOK_API', payload: doc }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
        if (response?.error) return reject(new Error(response.error))
        resolve(response)
      })
    })
  }

  // ── Page scraper ─────────────────────────────────────────────────────────────
  async function collectFacebookPage() {
    const url = window.location.href

    // Check if a modal/dialog is open (post opened in modal on feed page)
    const isModalOpen = !!document.querySelector('[role="dialog"]')

    // Single post page — delegate to deep collector for full comment extraction
    // BUT: if a modal is open, we're still on a feed page, so skip this
    if (!isModalOpen && (url.includes('/posts/') || url.includes('story_fbid') || url.includes('/permalink/') || url.includes('?fbid='))) {
      scraperState.isRunning = true
      scraperState.postsCollected = 0
      scraperState.commentsCollected = 0
      scraperState.errors = 0
      scraperState.state = 'running'
      const result = await collectSinglePostDeep()
      scraperState.isRunning = false
      scraperState.state = 'done'
      return result
    }

    // Title / headline
    const headlineEl =
      document.querySelector('[role="main"] h1') ||
      document.querySelector('[role="main"] h2') ||
      document.querySelector('h1')
    const title = (headlineEl?.textContent?.trim() || document.title).slice(0, 200)

    // Main post body text — Facebook uses several structures across versions
    const bodySelectors = [
      '[data-ad-comet-preview="message"]',
      '[data-ad-preview="message"]',
      '[role="main"] [dir="auto"]'
    ]
    const bodyTexts = []
    for (const sel of bodySelectors) {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent?.trim()
        if (t && t.length > 10) bodyTexts.push(t)
      })
      if (bodyTexts.length) break
    }
    const content = bodyTexts.join('\n') || title

    // Author
    const authorEl =
      document.querySelector('[role="main"] h3 a') ||
      document.querySelector('[role="main"] strong a')
    const author = authorEl?.textContent?.trim() || ''

    // Likes / reactions
    let likesCount = 0
    const reactionEl = document.querySelector(
      '[aria-label*="reaction"], [aria-label*="like"], [data-testid="reactions"]'
    )
    if (reactionEl) {
      likesCount = window.PoliticaCollector.parseCount(reactionEl.textContent)
    }

    // Comments
    const comments = []
    const seen = new Set()

    // Facebook comment nodes
    const commentSelectors = [
      '[aria-label*="Comment"] [dir="auto"]',
      '[role="article"] ul [dir="auto"]',
      '.x193iq5w span[dir="auto"]'
    ]
    for (const sel of commentSelectors) {
      document.querySelectorAll(sel).forEach(el => {
        const text = el.textContent?.trim()
        if (!text || text.length < 3 || seen.has(text)) return

        // Try to find the commenter's name via a parent link
        const link = el.closest('[role="article"], li')?.querySelector('a[href*="/profile"], a[href*="facebook.com"]')
        const author = link?.textContent?.trim() || ''

        seen.add(text)
        comments.push({ author, content: text, likes_count: 0 })
      })
      if (comments.length) break
    }

    const doc = {
      title,
      text: content,
      platform_url: url,
      platform: 'facebook',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: likesCount,
      comments_count: comments.length,
      metadata: { comments }
    }

    try {
      const result = await sendToFacebookApi(doc)
      window.PoliticaCollector.showNotification(
        `Saved "${title.slice(0, 40)}" (${comments.length} comments)`,
        'success'
      )
      return { success: true, id: result?.id, comments: comments.length }
    } catch (err) {
      window.PoliticaCollector.showNotification(err.message, 'error')
      return { error: err.message }
    }
  }

  // ── Feed auto-scroll collector (simplified - extract from visible posts) ────
  async function collectAllPosts(maxPosts) {
    const url = window.location.href
    
    // Check if a modal/dialog is open (post opened in modal on feed page)
    const isModalOpen = !!document.querySelector('[role="dialog"]')

    // If on a single post page (not in a modal), collect that post with all comments
    if (!isModalOpen && (url.includes('/posts/') || url.includes('story_fbid') || url.includes('/permalink/') || url.includes('?fbid='))) {
      return await collectSinglePostDeep()
    }

    // Otherwise, scroll through feed and collect posts
    const seen = new Set()
    let total = 0
    let noNewStreak = 0
    let saved = 0

    // Close any open modal first (including reels, videos, etc.)
    let modalClosed = false
    for (let attempt = 0; attempt < 3; attempt++) {
      const closeBtn = document.querySelector('[aria-label="Close"], [data-testid="dialog-close"], [role="dialog"] [aria-label="Close"], button[aria-label="Close"]')
      if (closeBtn) {
        try {
          closeBtn.click()
          await new Promise(r => setTimeout(r, 500))
          modalClosed = true
        } catch (e) {
          console.error('Error closing modal:', e)
        }
      }
      
      // Also try pressing Escape key to close any modal
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 })
      document.dispatchEvent(escapeEvent)
      await new Promise(r => setTimeout(r, 300))
      
      // Check if modal is still open
      if (!document.querySelector('[role="dialog"]')) {
        break
      }
    }

    window.PoliticaCollector.showNotification('Starting feed collection...', 'info')

    while (total < maxPosts && noNewStreak < 5 && scraperState.isRunning) {
      clickFacebookLoadMore()
      await new Promise(r => setTimeout(r, 1000))

      // Close any modal that may have opened (reels, videos, posts, etc.)
      let modalOpen = document.querySelector('[role="dialog"]')
      if (modalOpen) {
        // Try multiple close methods
        const closeBtn = modalOpen.querySelector('[aria-label="Close"], button[aria-label="Close"]')
        if (closeBtn) {
          try {
            closeBtn.click()
            await new Promise(r => setTimeout(r, 300))
          } catch (e) {}
        }
        
        // Try Escape key
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27 })
        document.dispatchEvent(escapeEvent)
        await new Promise(r => setTimeout(r, 300))
        
        // If still open, try clicking outside the modal
        if (document.querySelector('[role="dialog"]')) {
          const backdrop = document.querySelector('[role="presentation"]')
          if (backdrop) {
            backdrop.click()
            await new Promise(r => setTimeout(r, 300))
          }
        }
      }

      // Only get top-level feed posts, not modal/dialog articles
      const feedContainer = document.querySelector('[role="feed"], [data-pagelet*="Feed"], [role="main"]')
      const posts = (feedContainer || document).querySelectorAll('[role="article"]')
      let newFound = 0

      for (const post of posts) {
        if (!scraperState.isRunning) break
        
        // Skip posts inside dialogs/modals
        if (post.closest('[role="dialog"]')) continue

        const textEl = post.querySelector('[dir="auto"]')
        const text = textEl?.textContent?.trim()
        const key = text?.slice(0, 100)
        if (!key || seen.has(key)) continue
        seen.add(key)
        newFound++
        total++

        try {
          const postData = extractPostFromElement(post)
          if (!postData.text || postData.text.length < 5) {
            total--
            continue
          }
          await sendToFacebookApi(postData)
          saved++
          scraperState.postsCollected = saved
          scraperState.commentsCollected += (postData.metadata?.comments?.length || 0)
        } catch (err) {
          scraperState.errors++
          console.error('Error processing post:', err)
        }

        if (total >= maxPosts) break
      }

      noNewStreak = newFound === 0 ? noNewStreak + 1 : 0

      if (total % 5 === 0 && total > 0) {
        window.PoliticaCollector.showNotification(`Collected... ${saved}/${total} saved`, 'info')
      }

      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 2000))
    }

    window.PoliticaCollector.showNotification(`Collected ${saved} of ${total} Facebook posts`, 'success')
    return { success: true, count: total, saved }
  }

  // ── Deep scrape a single post page (expand all comments) ────────────────────
  async function collectSinglePostDeep() {
    window.PoliticaCollector.showNotification('Deep scraping post... expanding comments', 'info')

    // Expand all comments multiple times (FB loads in batches)
    for (let i = 0; i < 10 && scraperState.isRunning; i++) {
      const expanded = clickFacebookLoadMore()
      if (expanded === 0 && i > 2) break
      await new Promise(r => setTimeout(r, 1500))
    }

    // Scroll down to load more comments
    for (let i = 0; i < 5 && scraperState.isRunning; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(r => setTimeout(r, 1000))
      clickFacebookLoadMore()
      await new Promise(r => setTimeout(r, 1000))
    }

    // Extract post data
    const text = extractPostText()
    const title = text.slice(0, 200) || 'Facebook post'
    const author = extractPostAuthor()
    const url = window.location.href
    const likesCount = extractLikesCount()
    const comments = extractAllPageComments()

    scraperState.postsCollected = 1
    scraperState.commentsCollected = comments.length

    const doc = {
      title,
      text: text || title,
      platform_url: url,
      platform: 'facebook',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: likesCount,
      comments_count: comments.length,
      comments: comments.map(c => ({
        author: c.author,
        content: c.content,
        likes_count: c.likes_count
      }))
    }

    try {
      await sendToFacebookApi(doc)
      window.PoliticaCollector.showNotification(
        `Saved post with ${comments.length} comments`, 'success'
      )
      return { success: true, count: 1, saved: 1, comments: comments.length }
    } catch (err) {
      scraperState.errors++
      window.PoliticaCollector.showNotification(err.message, 'error')
      return { error: err.message }
    }
  }

  // ── Helper: Extract post text from single post page ─────────────────────────
  function extractPostText() {
    const selectors = [
      '[data-ad-comet-preview="message"]',
      '[data-ad-preview="message"]',
      '[role="main"] [dir="auto"]'
    ]
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        const t = el.textContent?.trim()
        if (t && t.length > 10) return t
      }
    }
    return document.title || 'Facebook post'
  }

  // ── Helper: Extract post author ─────────────────────────────────────────────
  function extractPostAuthor() {
    const el = document.querySelector('[role="main"] h3 a, [role="main"] strong a, h2 a')
    return el?.textContent?.trim() || ''
  }

  // ── Helper: Extract likes count ─────────────────────────────────────────────
  function extractLikesCount() {
    const el = document.querySelector('[aria-label*="reaction"], [aria-label*="like"]')
    return el ? window.PoliticaCollector.parseCount(el.textContent) : 0
  }

  // ── Helper: Extract ALL comments from the page ──────────────────────────────
  function extractAllPageComments() {
    const comments = []
    const seen = new Set()

    // Look for comment blocks - Facebook wraps each comment in nested divs
    const commentBlocks = document.querySelectorAll('[role="article"]')
    
    for (const block of commentBlocks) {
      const textEls = block.querySelectorAll('[dir="auto"]')
      for (const el of textEls) {
        const text = el.textContent?.trim()
        if (!text || text.length < 2 || seen.has(text)) continue
        if (text.length > 500) continue
        
        // Find commenter name
        const nameEl = block.querySelector('a[role="link"] span, a[href*="/profile"] span, a[href*="facebook.com/"] span')
        const author = nameEl?.textContent?.trim() || ''

        // Find likes on comment
        const likesEl = block.querySelector('[aria-label*="like"]')
        const likes_count = likesEl ? window.PoliticaCollector.parseCount(likesEl.textContent) : 0

        seen.add(text)
        comments.push({ author, content: text, likes_count })
      }
    }

    return comments
  }

  // ── Extract post data from visible post element ─────────────────────────────
  function extractPostFromElement(post) {
    // Post text
    const textEl = post.querySelector('[dir="auto"]')
    const text = textEl?.textContent?.trim() || ''
    const title = text.slice(0, 200) || 'Facebook post'

    // Author
    const authorEl = post.querySelector('h3 a, strong a')
    const author = authorEl?.textContent?.trim() || ''

    // Post URL
    const linkEl = post.querySelector('a[href*="/posts/"], a[href*="?story_fbid"]')
    const url = linkEl?.href || window.location.href

    // Likes
    let likesCount = 0
    const reactionEl = post.querySelector('[aria-label*="reaction"], [aria-label*="like"]')
    if (reactionEl) {
      likesCount = window.PoliticaCollector.parseCount(reactionEl.textContent)
    }

    // Comments count
    const commentsEl = post.querySelector('[aria-label*="comment"]')
    let commentsCount = 0
    if (commentsEl) {
      commentsCount = window.PoliticaCollector.parseCount(commentsEl.textContent)
    }

    // Extract visible comments from the post
    const comments = extractVisibleComments(post)

    // Ensure text is not empty
    const finalText = (text && text.length > 0) ? text : title

    return {
      title,
      text: finalText,
      platform_url: url,
      platform: 'facebook',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: likesCount,
      comments_count: comments.length || commentsCount,
      metadata: { comments }
    }
  }

  // ── Extract visible comments from post element ──────────────────────────────
  function extractVisibleComments(post) {
    const comments = []
    const seen = new Set()

    // Find comment elements within the post
    const commentEls = post.querySelectorAll('[dir="auto"]')
    
    commentEls.forEach(el => {
      const text = el.textContent?.trim()
      if (!text || text.length < 3 || seen.has(text)) return

      // Skip if it's the main post text
      if (el === post.querySelector('[dir="auto"]')) return

      // Find commenter name
      const link = el.closest('div')?.querySelector('a[href*="/profile"], a[href*="facebook.com"]')
      const author = link?.textContent?.trim() || ''

      // Find likes
      const likesEl = el.closest('div')?.querySelector('[aria-label*="like"]')
      const likes_count = likesEl ? window.PoliticaCollector.parseCount(likesEl.textContent) : 0

      seen.add(text)
      comments.push({ author, content: text, likes_count })
    })

    return comments
  }

  // ── Facebook-specific load-more helpers ─────────────────────────────────────
  function clickFacebookLoadMore() {
    var clicked = 0

    var buttons = document.querySelectorAll(
      '[role="button"], button, a[role="link"], span[role="button"]'
    )
    var patterns = [
      /see\s*more/i,
      /view\s*all\s*comments/i,
      /view\s*all\s*\d+\s*comments/i,
      /view\s*more\s*comments/i,
      /view\s*\d+\s*more\s*comments/i,
      /view\s*\d+\s*comments/i,
      /view\s*all\s*replies/i,
      /view\s*all\s*\d+\s*replies/i,
      /view\s*more\s*replies/i,
      /view\s*\d+\s*more\s*repl/i,
      /view\s*\d+\s*repl/i,
      /\d+\s*replies/i,
      /load\s*more/i,
      /show\s*more/i,
      /view\s*all/i
    ]

    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 80) continue

      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try { btn.click(); clicked++ } catch (e) { /* ignore */ }
          break
        }
      }
    }

    // Expand "See more" on post text (Facebook truncates long posts)
    var seeMoreDivs = document.querySelectorAll('[role="button"]')
    for (var j = 0; j < seeMoreDivs.length; j++) {
      var el = seeMoreDivs[j]
      var elText = (el.textContent || '').trim().toLowerCase()
      if (elText === 'see more') {
        try { el.click(); clicked++ } catch (e) { /* ignore */ }
      }
    }

    return clicked
  }

  // Expose for collector-manager
  window.PoliticaFacebook = {
    clickLoadMore: clickFacebookLoadMore,
    collectPage: collectFacebookPage
  }
})()
