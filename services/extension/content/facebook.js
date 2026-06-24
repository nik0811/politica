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
      
      // Check if on reels page - use reel scraper
      const url = window.location.href
      const isReelsPage = url.includes('/reels') || url.includes('/reel/')
      
      const scrapeFunction = isReelsPage 
        ? collectAllReels(message.options?.maxPosts || 50)
        : collectAllPosts(message.options?.maxPosts || 50)
      
      scrapeFunction
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
    if (message.type === 'DEEP_SCRAPE_REELS') {
      scraperState.isRunning = true
      scraperState.postsCollected = 0
      scraperState.commentsCollected = 0
      scraperState.errors = 0
      scraperState.state = 'running'
      collectAllReels(message.options?.maxReels || 50)
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

  // ── Reel scraper - opens each reel, expands comments, extracts data ─────────
  async function collectAllReels(maxReels) {
    const url = window.location.href
    
    // Check if we're on a reels page or profile reels tab
    const isReelsPage = url.includes('/reels') || url.includes('/reel/')
    
    if (!isReelsPage) {
      window.PoliticaCollector.showNotification('Navigate to a Reels page first', 'error')
      return { error: 'Not on a reels page' }
    }

    window.PoliticaCollector.showNotification('Starting reel collection...', 'info')

    // If we're on a single reel page (/reel/123), scrape reels using keyboard navigation
    if (url.match(/\/reel\/\d+/)) {
      return await scrapeReelsWithKeyboardNav(maxReels)
    }

    // On reels GRID page (like /username/reels) - click first reel then use keyboard nav
    const gridContainer = document.querySelector('[role="main"]')
    const firstReelLink = gridContainer?.querySelector('a[href*="/reel/"]')
    
    if (firstReelLink) {
      window.PoliticaCollector.showNotification('Opening first reel...', 'info')
      firstReelLink.click()
      await new Promise(r => setTimeout(r, 3000))
      await waitForReelToLoad()
      
      return await scrapeReelsWithKeyboardNav(maxReels)
    }

    window.PoliticaCollector.showNotification('No reels found on this page', 'error')
    return { error: 'No reels found' }
  }

  // ── Scrape reels using keyboard navigation (down arrow) ─────────────────────
  async function scrapeReelsWithKeyboardNav(maxReels) {
    const seen = new Set()
    let saved = 0
    let noNewStreak = 0
    let lastUrl = ''
    let totalComments = 0
    let commentPanelOpened = false

    window.PoliticaCollector.showNotification('Starting reel collection with comments...', 'info')

    while (saved < maxReels && noNewStreak < 15 && scraperState.isRunning) {
      // Get current reel ID from URL
      const currentUrl = window.location.href
      const reelIdMatch = currentUrl.match(/\/reel\/(\d+)/)
      const reelId = reelIdMatch ? reelIdMatch[1] : null

      if (reelId && !seen.has(reelId)) {
        seen.add(reelId)
        noNewStreak = 0  // Reset streak on new reel
        
        // Wait for content to load
        await new Promise(r => setTimeout(r, 1500))

        // Start recording video audio immediately while reel is playing
        const reelVideoEl = document.querySelector('video')
        const videoRecorder = reelVideoEl ? window.PoliticaCollector.startVideoRecording(reelVideoEl) : null

        // Open comment panel only once (it stays open between reels)
        if (!commentPanelOpened) {
          await openReelCommentPanel()
          commentPanelOpened = true
          await new Promise(r => setTimeout(r, 1000))
        }
        
        // Wait for comments to load for this reel
        await new Promise(r => setTimeout(r, 800))

        // Scroll and read ALL comments — audio records during this whole time
        console.log('[FB Reel] Reading comments for reel:', reelId)
        const comments = await scrollAndReadComments()
        console.log('[FB Reel] Finished reading', comments.length, 'comments')

        // Stop recording now (before navigating away) — captures audio from THIS reel
        let capturedAudio = null
        if (videoRecorder) {
          try { capturedAudio = await videoRecorder.stop() } catch (e) { /* non-critical */ }
        }
        
        // Get reel metadata (caption, author, engagement)
        const reelData = await extractReelMetadata(comments)
        
        if (reelData) {
          delete reelData._videoEl   // don't send DOM element to API

          try {
            const apiResult = await sendToFacebookApi(reelData)
            saved++
            totalComments += comments.length
            scraperState.postsCollected = saved
            scraperState.commentsCollected = totalComments

            // Fire transcription in background after post is saved
            // — doesn't block scraper, links audio to the correct doc ID
            if (capturedAudio && apiResult && apiResult.id) {
              window.PoliticaCollector.transcribeAudio(capturedAudio, apiResult.id)
                .then(t => t && console.log(`[FB Reel] Transcription saved for ${apiResult.id}`))
                .catch(() => {})
            }

            // Show notification for each reel
            window.PoliticaCollector.showNotification(
              `Reel ${saved}/${maxReels}: ${reelData.likes_count || 0} likes, ${comments.length} comments`,
              'info'
            )
          } catch (err) {
            scraperState.errors++
            window.PoliticaCollector.showNotification(`Error saving reel: ${err.message}`, 'error')
          }
        }
        
        lastUrl = currentUrl
      } else if (reelId && seen.has(reelId)) {
        if (currentUrl === lastUrl) {
          noNewStreak++
        }
      }

      if (saved >= maxReels || !scraperState.isRunning) break

      // Navigate to next reel (comment panel stays open)
      await navigateToNextReel(currentUrl)
      
      // Check if navigation worked
      if (window.location.href === currentUrl) {
        noNewStreak++
        if (noNewStreak >= 5) {
          window.PoliticaCollector.showNotification(`Trying to load more reels... (${noNewStreak}/15)`, 'info')
        }
      } else {
        noNewStreak = 0
      }
    }

    // Final notification
    if (saved > 0) {
      window.PoliticaCollector.showNotification(`✓ Collected ${saved} reels with ${totalComments} comments`, 'success')
    } else {
      window.PoliticaCollector.showNotification('No reels could be collected', 'error')
    }
    
    return { success: true, count: saved, saved, comments: totalComments, type: 'reels' }
  }

  // ── Navigate to next reel ─────────────────────────────────────────────────────
  async function navigateToNextReel(currentUrl) {
    // Method 1: Focus video and press Down Arrow
    const video = document.querySelector('video')
    if (video) {
      video.focus()
      video.click()
      await new Promise(r => setTimeout(r, 300))
    }
    
    // Send keyboard event to document
    document.dispatchEvent(new KeyboardEvent('keydown', { 
      key: 'ArrowDown', 
      code: 'ArrowDown', 
      keyCode: 40, 
      bubbles: true,
      cancelable: true
    }))
    document.dispatchEvent(new KeyboardEvent('keyup', { 
      key: 'ArrowDown', 
      code: 'ArrowDown', 
      keyCode: 40, 
      bubbles: true
    }))
    await new Promise(r => setTimeout(r, 1500))
    
    if (window.location.href !== currentUrl) return true
    
    // Method 2: Try clicking next/down buttons
    const nextBtns = document.querySelectorAll('[aria-label*="Next"], [aria-label*="next"], [aria-label*="Down"], [aria-label*="down"]')
    for (const btn of nextBtns) {
      try {
        btn.click()
        await new Promise(r => setTimeout(r, 1200))
        if (window.location.href !== currentUrl) return true
      } catch (e) {}
    }
    
    // Method 3: Try wheel scroll on video
    const vid = document.querySelector('video')
    if (vid) {
      vid.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true }))
      await new Promise(r => setTimeout(r, 1200))
      if (window.location.href !== currentUrl) return true
    }
    
    // Method 4: Try clicking the down chevron/arrow SVG
    const svgs = document.querySelectorAll('svg')
    for (const svg of svgs) {
      const rect = svg.getBoundingClientRect()
      // Look for navigation arrows (usually on the right side, middle of screen)
      if (rect.left < window.innerWidth * 0.7) continue
      if (rect.top < window.innerHeight * 0.3 || rect.top > window.innerHeight * 0.7) continue
      
      try {
        svg.parentElement?.click()
        await new Promise(r => setTimeout(r, 1000))
        if (window.location.href !== currentUrl) return true
      } catch (e) {}
    }
    
    // Method 5: Try scrolling the main container
    const mainContainer = document.querySelector('[role="main"]')
    if (mainContainer) {
      mainContainer.scrollBy(0, window.innerHeight)
      await new Promise(r => setTimeout(r, 1000))
      if (window.location.href !== currentUrl) return true
    }
    
    // Method 6: Press j key (some sites use this for next)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true }))
    await new Promise(r => setTimeout(r, 800))
    
    return window.location.href !== currentUrl
  }

  // ── Scroll comment panel and read all comments ────────────────────────────────
  async function scrollAndReadComments() {
    const allComments = []
    const seenComments = new Set()
    
    const video = document.querySelector('video')
    const videoRect = video ? video.getBoundingClientRect() : { right: window.innerWidth * 0.5 }
    
    // Find the scrollable comment panel (right side)
    let commentPanel = null
    const allDivs = document.querySelectorAll('div')
    
    for (const div of allDivs) {
      const rect = div.getBoundingClientRect()
      if (rect.left < videoRect.right - 100) continue
      if (rect.height < 200 || rect.width < 150) continue
      if (div.scrollHeight > div.clientHeight + 20) {
        commentPanel = div
        break
      }
    }
    
    // Helper to extract ALL visible comments
    const extractAllVisibleComments = () => {
      // Get all text elements in the right panel area
      const rightPanelSpans = document.querySelectorAll('span[dir="auto"]')
      const commentTexts = []
      
      for (const span of rightPanelSpans) {
        const rect = span.getBoundingClientRect()
        // Must be in right panel
        if (rect.left < videoRect.right - 30) continue
        // Must be visible on screen
        if (rect.top < 50 || rect.bottom > window.innerHeight - 20) continue
        if (rect.width < 20) continue
        
        const t = span.textContent?.trim()
        if (!t || t.length < 2) continue
        
        // Skip UI elements
        if (/^\d+\s*(h|m|d|w|mo|y|hr|min|sec)s?$/i.test(t)) continue
        if (/^(Like|Reply|Share|See more|See less|Edited|Hide|View|Follow|Most relevant|All comments|Write a comment|Public|Friends)$/i.test(t)) continue
        if (/^[\d,.]+[KkMm]?$/.test(t)) continue
        if (t.includes('followers') || t.includes('Original audio')) continue
        if (t.includes('·') && t.length < 30) continue  // "Author · timestamp" type
        
        commentTexts.push({ text: t, rect, span })
      }
      
      // Find author-comment pairs
      // Authors are typically in links, comments follow them
      const links = document.querySelectorAll('a[role="link"]')
      
      for (const link of links) {
        const linkRect = link.getBoundingClientRect()
        // Must be in right panel
        if (linkRect.left < videoRect.right - 30) continue
        if (linkRect.top < 50 || linkRect.bottom > window.innerHeight - 20) continue
        
        const href = link.href || ''
        if (!href.includes('facebook.com/')) continue
        if (href.includes('/reel/') || href.includes('/watch/') || href.includes('/videos/')) continue
        
        const authorName = link.textContent?.trim()
        if (!authorName || authorName.length < 2 || authorName.length > 80) continue
        if (/^(Follow|Like|Reply|Share|See more|View|\d+)$/i.test(authorName)) continue
        if (/^\d+\s*(h|m|d|w)$/i.test(authorName)) continue
        
        // Find comment text near this author (below or next to)
        for (const { text, rect } of commentTexts) {
          // Comment should be near the author (within 100px vertically)
          if (Math.abs(rect.top - linkRect.top) > 100) continue
          // Comment should be to the right or below author
          if (rect.right < linkRect.left) continue
          
          // Skip if text is same as author
          if (text === authorName) continue
          if (text.length < 2) continue
          
          const key = authorName + '|||' + text.substring(0, 50)
          if (!seenComments.has(key)) {
            seenComments.add(key)
            allComments.push({
              author: authorName,
              content: text,
              likes_count: 0
            })
          }
          break  // Found comment for this author
        }
      }
    }
    
    // First, click to expand any "View more comments" or "View replies"
    for (let i = 0; i < 3; i++) {
      clickFacebookLoadMore()
      await new Promise(r => setTimeout(r, 300))
    }
    
    // Extract initial visible comments
    extractAllVisibleComments()
    console.log('[FB Reel] Initial comments:', allComments.length)
    
    // Scroll and read more comments
    if (commentPanel) {
      // First scroll to top
      commentPanel.scrollTop = 0
      await new Promise(r => setTimeout(r, 300))
      extractAllVisibleComments()
      
      let lastScrollTop = -1
      
      // Scroll down incrementally, reading at each position
      for (let i = 0; i < 50; i++) {
        // Scroll down a bit
        commentPanel.scrollTop += 250
        await new Promise(r => setTimeout(r, 400))
        
        // Click any "View more" / "View replies" buttons
        clickFacebookLoadMore()
        await new Promise(r => setTimeout(r, 200))
        
        // Extract comments at this scroll position
        extractAllVisibleComments()
        
        // Check if we've reached the bottom
        if (commentPanel.scrollTop === lastScrollTop) {
          // Try one more scroll to bottom
          commentPanel.scrollTop = commentPanel.scrollHeight
          await new Promise(r => setTimeout(r, 500))
          clickFacebookLoadMore()
          extractAllVisibleComments()
          break
        }
        
        lastScrollTop = commentPanel.scrollTop
        
        // Stop if we've scrolled past the content
        if (commentPanel.scrollTop + commentPanel.clientHeight >= commentPanel.scrollHeight - 10) {
          // At bottom, click load more and extract final comments
          clickFacebookLoadMore()
          await new Promise(r => setTimeout(r, 300))
          extractAllVisibleComments()
          break
        }
      }
      
      // Final pass - scroll back up slowly to catch any missed comments
      for (let i = 0; i < 5; i++) {
        commentPanel.scrollTop -= 500
        await new Promise(r => setTimeout(r, 200))
        extractAllVisibleComments()
      }
      
      // Scroll back to top for next reel
      commentPanel.scrollTop = 0
    } else {
      // No scrollable panel found, just extract what's visible
      console.log('[FB Reel] No scrollable panel, extracting visible comments only')
      extractAllVisibleComments()
    }
    
    console.log('[FB Reel] Total comments extracted:', allComments.length)
    return allComments
  }

  // ── Extract reel metadata (caption, author, engagement) ───────────────────────
  async function extractReelMetadata(comments) {
    const video = document.querySelector('video')
    if (!video) return null
    
    const videoRect = video.getBoundingClientRect()
    
    // Extract caption
    let text = ''
    const spans = document.querySelectorAll('span[dir="auto"]')
    for (const span of spans) {
      const rect = span.getBoundingClientRect()
      if (rect.top < 50) continue
      
      const t = span.textContent?.trim()
      if (!t || t.length < 10) continue
      if (t.includes('followers') || t.includes('following')) continue
      if (/^(Like|Reply|Share|Follow|See more|Message|Most relevant)$/i.test(t)) continue
      
      if (t.includes('#') || t.length > 30) {
        text = t
        break
      }
    }

    // Extract author (page name)
    let author = ''
    const links = document.querySelectorAll('a[role="link"]')
    for (const link of links) {
      const rect = link.getBoundingClientRect()
      if (rect.top < 50) continue
      
      const href = link.href || ''
      if (!href.includes('facebook.com/') || href.includes('/reel/')) continue
      
      const linkText = link.textContent?.trim()
      if (linkText && linkText.length > 1 && linkText.length < 50) {
        if (!/\d/.test(linkText) && !linkText.includes('Follow')) {
          author = linkText
          break
        }
      }
    }

    // Extract engagement numbers (likes, comments, shares on right side)
    let likesCount = 0, commentsCount = 0, sharesCount = 0
    const buttons = document.querySelectorAll('[role="button"]')
    const nums = []
    
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect()
      if (rect.left < videoRect.right - 30 || rect.left > videoRect.right + 100) continue
      if (rect.top < videoRect.top || rect.bottom > videoRect.bottom + 50) continue
      
      const btnSpans = btn.querySelectorAll('span')
      for (const span of btnSpans) {
        const t = span.textContent?.trim()
        if (t && /^[\d,.]+[KkMm]?$/.test(t)) {
          nums.push(window.PoliticaCollector.parseCount(t))
        }
      }
    }
    
    if (nums.length >= 1) likesCount = nums[0]
    if (nums.length >= 2) commentsCount = nums[1]
    if (nums.length >= 3) sharesCount = nums[2]

    return {
      title: (text || 'Facebook Reel').slice(0, 200),
      text: text || 'Facebook Reel',
      platform_url: window.location.href,
      platform: 'facebook',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: likesCount,
      comments_count: comments.length || commentsCount,
      shares_count: sharesCount,
      comments: comments,
      metadata: { content_type: 'reel', shares_count: sharesCount },
      _videoEl: video    // pass element reference so caller can schedule transcription
    }
  }

  // ── Extract comments with author names and content ──────────────────────────
  function extractReelCommentsWithAuthors() {
    const comments = []
    const seen = new Set()

    // Facebook uses aria-label="Comment" for comment containers
    let commentContainers = document.querySelectorAll('div[aria-label="Comment"]')
    
    console.log('[FB Reel] Found aria-label Comment containers:', commentContainers.length)
    
    // If no aria-label comments, look for the comment section on the right
    if (commentContainers.length === 0) {
      // Comments are in the right panel - look for user profile links followed by text
      const video = document.querySelector('video')
      const videoRect = video ? video.getBoundingClientRect() : { right: window.innerWidth * 0.5 }
      
      // Find all profile links in the comment area (right of video)
      const profileLinks = document.querySelectorAll('a[role="link"]')
      
      for (const link of profileLinks) {
        const rect = link.getBoundingClientRect()
        
        // Must be to the right of video (comment panel)
        if (rect.left < videoRect.right) continue
        
        // Must be on screen
        if (rect.top < 50 || rect.bottom > window.innerHeight - 50) continue
        
        const href = link.href || ''
        // Skip non-profile links
        if (!href.includes('facebook.com/') || href.includes('/reel/') || href.includes('/watch/')) continue
        
        const authorName = link.textContent?.trim()
        if (!authorName || authorName.length < 2 || authorName.length > 60) continue
        
        // Skip page name, UI elements
        if (authorName.includes('Follow') || authorName.includes('Like') || authorName.includes('Reply')) continue
        if (/^\d+\s*(h|m|d|w)$/i.test(authorName)) continue
        
        // Find the comment text - look in sibling/parent elements
        const parent = link.closest('div[class]')?.parentElement || link.parentElement?.parentElement
        if (!parent) continue
        
        // Look for text spans near this author
        const nearbySpans = parent.querySelectorAll('span[dir="auto"]')
        let commentText = ''
        
        for (const span of nearbySpans) {
          const t = span.textContent?.trim()
          if (!t || t.length < 3) continue
          
          // Skip if it's the author name
          if (t === authorName) continue
          
          // Skip timestamps
          if (/^\d+\s*(h|m|d|w|mo|y|hr|min|sec|hour|day|week)s?$/i.test(t)) continue
          
          // Skip UI text
          if (/^(Like|Reply|Share|See more|See less|Edited|Hide|View|Follow|Most relevant|All comments)$/i.test(t)) continue
          
          // Skip numbers
          if (/^[\d,.]+[KkMm]?$/.test(t)) continue
          
          // Skip page descriptions
          if (t.includes('followers') || t.includes('following') || t.includes('Original audio')) continue
          
          // This looks like comment text
          if (t.length > 3 && t.length < 1000) {
            commentText = t
            break
          }
        }
        
        if (commentText && !seen.has(commentText)) {
          seen.add(commentText)
          comments.push({
            author: authorName,
            content: commentText,
            likes_count: 0
          })
        }
      }
    } else {
      // Process aria-label="Comment" containers
      for (const container of commentContainers) {
        let authorName = ''
        const authorLink = container.querySelector('a[role="link"]')
        if (authorLink) {
          const linkText = authorLink.textContent?.trim()
          const href = authorLink.href || ''
          if (linkText && linkText.length < 60 && href.includes('facebook.com/') && !href.includes('/reel/')) {
            authorName = linkText
          }
        }
        
        let commentText = ''
        const spans = container.querySelectorAll('span[dir="auto"]')
        for (const span of spans) {
          const t = span.textContent?.trim()
          if (!t || t.length < 2) continue
          if (t === authorName) continue
          if (/^\d+\s*(h|m|d|w|mo|y|hr|min|sec|hour|day|week)s?$/i.test(t)) continue
          if (/^(Like|Reply|Share|See more|See less|Edited|Hide|View)$/i.test(t)) continue
          if (/^[\d,.]+[KkMm]?$/.test(t)) continue
          
          if (t.length > 2 && t.length < 1000) {
            commentText = t
            break
          }
        }
        
        if (commentText && !seen.has(commentText)) {
          seen.add(commentText)
          comments.push({
            author: authorName,
            content: commentText,
            likes_count: 0
          })
        }
      }
    }

    console.log('[FB Reel] Extracted', comments.length, 'comments')
    return comments
  }

  // ── Click comment button to open comment panel ────────────────────────────────
  async function openReelCommentPanel() {
    // Look for the comment button (speech bubble icon) on the right side of the video
    const video = document.querySelector('video')
    if (!video) return false
    
    const videoRect = video.getBoundingClientRect()
    
    // Find buttons/clickable elements to the right of video
    const clickables = document.querySelectorAll('[role="button"], svg, [aria-label*="comment" i], [aria-label*="Comment" i]')
    
    for (const el of clickables) {
      const rect = el.getBoundingClientRect()
      
      // Must be to the right of video (the engagement buttons column)
      if (rect.left < videoRect.right - 30) continue
      if (rect.left > videoRect.right + 100) continue
      
      // Must be vertically within video area
      if (rect.top < videoRect.top || rect.bottom > videoRect.bottom + 50) continue
      
      // Check if it's the comment button (usually has a number near it or speech bubble icon)
      const ariaLabel = el.getAttribute('aria-label') || ''
      const parentText = el.parentElement?.textContent || ''
      
      // Look for comment-related indicators
      if (ariaLabel.toLowerCase().includes('comment') || 
          el.closest('[aria-label*="comment" i]') ||
          el.closest('[aria-label*="Comment" i]')) {
        try {
          el.click()
          console.log('[FB Reel] Clicked comment button via aria-label')
          await new Promise(r => setTimeout(r, 800))
          return true
        } catch (e) {}
      }
    }
    
    // Fallback: Click the second button in the engagement column (usually comments)
    // The order is typically: Like, Comment, Share
    const engagementButtons = []
    const allButtons = document.querySelectorAll('[role="button"]')
    
    for (const btn of allButtons) {
      const rect = btn.getBoundingClientRect()
      if (rect.left < videoRect.right - 30) continue
      if (rect.left > videoRect.right + 100) continue
      if (rect.top < videoRect.top || rect.bottom > videoRect.bottom + 50) continue
      if (rect.width < 20 || rect.height < 20) continue
      
      engagementButtons.push({ btn, top: rect.top })
    }
    
    // Sort by vertical position
    engagementButtons.sort((a, b) => a.top - b.top)
    
    // Click the second button (comment button)
    if (engagementButtons.length >= 2) {
      try {
        engagementButtons[1].btn.click()
        console.log('[FB Reel] Clicked second engagement button (comment)')
        await new Promise(r => setTimeout(r, 800))
        return true
      } catch (e) {}
    }
    
    // Last resort: click any button with a number that could be comment count
    for (const { btn } of engagementButtons) {
      const text = btn.textContent?.trim()
      if (text && /^\d+$/.test(text)) {
        try {
          btn.click()
          console.log('[FB Reel] Clicked button with number:', text)
          await new Promise(r => setTimeout(r, 800))
          return true
        } catch (e) {}
      }
    }
    
    console.log('[FB Reel] Could not find comment button')
    return false
  }

  // ── Scroll comment panel to load all comments ─────────────────────────────────
  async function scrollCommentPanel() {
    const video = document.querySelector('video')
    if (!video) return []
    
    const videoRect = video.getBoundingClientRect()
    const allComments = []
    const seenComments = new Set()
    
    // Helper to extract visible comments - simplified approach
    const extractVisibleComments = () => {
      // Method 1: Look for aria-label="Comment" containers
      const commentContainers = document.querySelectorAll('div[aria-label="Comment"]')
      console.log('[FB Reel] aria-label Comment containers:', commentContainers.length)
      
      for (const container of commentContainers) {
        let authorName = ''
        const authorLink = container.querySelector('a[role="link"]')
        if (authorLink) {
          authorName = authorLink.textContent?.trim() || ''
        }
        
        let commentText = ''
        const spans = container.querySelectorAll('span[dir="auto"]')
        for (const span of spans) {
          const t = span.textContent?.trim()
          if (!t || t.length < 2 || t === authorName) continue
          if (/^\d+\s*(h|m|d|w|mo|y)s?$/i.test(t)) continue
          if (/^(Like|Reply|Share|See more|Edited)$/i.test(t)) continue
          if (/^[\d,.]+[KkMm]?$/.test(t)) continue
          
          if (t.length > 2 && t.length < 1000) {
            commentText = t
            break
          }
        }
        
        if (commentText && !seenComments.has(commentText)) {
          seenComments.add(commentText)
          allComments.push({ author: authorName, content: commentText, likes_count: 0 })
        }
      }
      
      // Method 2: Find comments by looking at the right panel structure
      // Comments typically have: profile pic, author name link, comment text, timestamp
      const rightPanelLinks = []
      const allLinks = document.querySelectorAll('a[role="link"]')
      
      for (const link of allLinks) {
        const rect = link.getBoundingClientRect()
        // Must be in the right side (comment panel area)
        if (rect.left < videoRect.right - 20) continue
        // Must be visible
        if (rect.top < 100 || rect.bottom > window.innerHeight - 50) continue
        
        const href = link.href || ''
        if (!href.includes('facebook.com/')) continue
        if (href.includes('/reel/') || href.includes('/watch/') || href.includes('/videos/')) continue
        
        const authorName = link.textContent?.trim()
        if (!authorName || authorName.length < 2 || authorName.length > 60) continue
        if (/^(Follow|Like|Reply|Share|\d+)/.test(authorName)) continue
        
        rightPanelLinks.push({ link, authorName, rect })
      }
      
      console.log('[FB Reel] Found profile links in right panel:', rightPanelLinks.length)
      
      // For each author link, find the comment text nearby
      for (const { link, authorName } of rightPanelLinks) {
        // Look in parent containers for comment text
        let parent = link.parentElement
        for (let i = 0; i < 5 && parent; i++) {
          const spans = parent.querySelectorAll('span[dir="auto"]')
          for (const span of spans) {
            const t = span.textContent?.trim()
            if (!t || t.length < 3 || t === authorName) continue
            if (/^\d+\s*(h|m|d|w|mo|y)s?$/i.test(t)) continue
            if (/^(Like|Reply|Share|See more|Edited|Follow|Most relevant|All comments|Write a comment)$/i.test(t)) continue
            if (/^[\d,.]+[KkMm]?$/.test(t)) continue
            if (t.includes('followers') || t.includes('Original audio')) continue
            
            // This looks like a comment
            if (t.length > 3 && t.length < 1000 && !seenComments.has(t)) {
              seenComments.add(t)
              allComments.push({ author: authorName, content: t, likes_count: 0 })
              break
            }
          }
          parent = parent.parentElement
        }
      }
    }
    
    // Find scrollable comment panel
    let commentPanel = null
    const allDivs = document.querySelectorAll('div')
    
    for (const div of allDivs) {
      const rect = div.getBoundingClientRect()
      // Must be to the right of video
      if (rect.left < videoRect.right - 100) continue
      // Must have reasonable size
      if (rect.height < 300 || rect.width < 200) continue
      // Must be scrollable
      if (div.scrollHeight <= div.clientHeight + 20) continue
      
      commentPanel = div
      console.log('[FB Reel] Found scrollable panel:', rect.left, rect.top, rect.width, rect.height)
      break
    }
    
    // Extract initial comments
    extractVisibleComments()
    console.log('[FB Reel] Initial comments found:', allComments.length)
    
    if (!commentPanel) {
      console.log('[FB Reel] No scrollable panel found, returning current comments')
      return allComments
    }
    
    // Scroll and read loop
    let lastHeight = 0
    let noChangeCount = 0
    
    for (let i = 0; i < 15; i++) {
      // Scroll down
      commentPanel.scrollTop += 500
      await new Promise(r => setTimeout(r, 600))
      
      // Click "View more" buttons
      clickFacebookLoadMore()
      
      // Extract newly visible comments
      const beforeCount = allComments.length
      extractVisibleComments()
      
      console.log('[FB Reel] Scroll', i + 1, '- Comments:', allComments.length)
      
      // Check if we got new comments or scrolled more
      if (allComments.length === beforeCount && commentPanel.scrollHeight === lastHeight) {
        noChangeCount++
        if (noChangeCount >= 3) break
      } else {
        noChangeCount = 0
      }
      lastHeight = commentPanel.scrollHeight
    }
    
    console.log('[FB Reel] Total comments collected:', allComments.length)
    return allComments
  }

  // ── Wait for reel content to load ───────────────────────────────────────────
  async function waitForReelToLoad() {
    for (let i = 0; i < 10; i++) {
      // Check if video or reel content is visible
      const video = document.querySelector('video')
      const reelContent = document.querySelector('[role="dialog"] video, [data-pagelet*="Reel"] video')
      if (video || reelContent) {
        await new Promise(r => setTimeout(r, 500))
        return true
      }
      await new Promise(r => setTimeout(r, 300))
    }
    return false
  }

  // ── Scrape current reel data with comments ──────────────────────────────────
  async function scrapeCurrentReel() {
    // Wait for content to fully load
    await new Promise(r => setTimeout(r, 2000))

    // Click "See more" to expand caption if truncated
    const seeMoreBtns = document.querySelectorAll('[role="button"]')
    for (const btn of seeMoreBtns) {
      const btnText = btn.textContent?.trim().toLowerCase()
      if (btnText === 'see more') {
        // Only click if it's in the main area (not sidebar)
        const rect = btn.getBoundingClientRect()
        if (rect.left < window.innerWidth * 0.6) {
          try { btn.click() } catch (e) {}
          await new Promise(r => setTimeout(r, 500))
        }
      }
    }

    // Expand all comments and replies
    for (let i = 0; i < 8 && scraperState.isRunning; i++) {
      clickFacebookLoadMore()
      await new Promise(r => setTimeout(r, 800))
    }

    // The main reel video is in the CENTER of the screen
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    
    // Find the video element to determine the reel area
    const video = document.querySelector('video')
    let reelAreaLeft = 0
    let reelAreaRight = screenWidth * 0.6
    let reelAreaTop = 0
    let reelAreaBottom = screenHeight
    
    if (video) {
      const videoRect = video.getBoundingClientRect()
      // The reel content is around the video
      reelAreaLeft = Math.max(0, videoRect.left - 100)
      reelAreaRight = Math.min(screenWidth, videoRect.right + 150)
      reelAreaTop = Math.max(0, videoRect.top - 50)
      reelAreaBottom = Math.min(screenHeight, videoRect.bottom + 200)
    }

    // Helper to check if element is in the reel area
    const isInReelArea = (el) => {
      const rect = el.getBoundingClientRect()
      return rect.left >= reelAreaLeft && 
             rect.right <= reelAreaRight + 100 &&
             rect.top >= reelAreaTop - 100 &&
             rect.bottom <= reelAreaBottom + 100
    }

    // Extract caption text - look for text near the video
    let text = ''
    
    // The caption is usually BELOW the video, look for substantial text there
    const allDivs = document.querySelectorAll('div[dir="auto"], span[dir="auto"]')
    const potentialCaptions = []
    
    for (const div of allDivs) {
      const rect = div.getBoundingClientRect()
      
      // Caption should be below or near the video
      if (video) {
        const videoRect = video.getBoundingClientRect()
        // Should be below video or overlapping bottom part
        if (rect.top < videoRect.bottom - 100) continue
        // Should be within video's horizontal range
        if (rect.left > videoRect.right + 50 || rect.right < videoRect.left - 50) continue
      }
      
      const t = div.textContent?.trim()
      if (!t || t.length < 10) continue
      
      // Skip notification/suggestion text
      if (t.includes('friend suggestion') || t.includes('suggested for you')) continue
      if (t.includes('People you may know')) continue
      
      // Skip page bio/description patterns
      if (t.includes('First Infotainment') || t.includes('NEWS AS IT')) continue
      if (t.includes('followers') || t.includes('following')) continue
      
      // Skip UI text
      if (/^(Like|Reply|Share|Follow|See more|See less|View|Hide|Most relevant|Original audio|Music|Following|Message|Send|Cancel)$/i.test(t)) continue
      
      // Score this text - prefer text with hashtags
      const hasHashtags = t.includes('#')
      const hasMentions = t.includes('@')
      const score = t.length + (hasHashtags ? 100 : 0) + (hasMentions ? 50 : 0)
      
      potentialCaptions.push({ text: t, score, rect })
    }
    
    // Sort by score and pick the best one
    potentialCaptions.sort((a, b) => b.score - a.score)
    if (potentialCaptions.length > 0) {
      text = potentialCaptions[0].text
    }
    
    console.log('[FB Reel] Found potential captions:', potentialCaptions.length, 'Best:', text?.slice(0, 50))

    // Extract author name - look near the video for profile name
    let author = ''
    const authorLinks = document.querySelectorAll('a[role="link"]')
    for (const link of authorLinks) {
      if (!isInReelArea(link)) continue
      
      const href = link.href || ''
      // Skip non-profile links
      if (!href.includes('facebook.com/') || href.includes('/reel/')) continue
      
      const spans = link.querySelectorAll('span[dir="auto"]')
      for (const span of spans) {
        const t = span.textContent?.trim()
        if (!t || t.length < 2 || t.length > 60) continue
        
        // Skip notification text
        if (t.includes('friend suggestion') || t.includes('suggested')) continue
        
        // Skip numbers, followers text, and UI elements
        if (/\d/.test(t)) continue
        if (/follow|like|share|comment|view|see|original|music/i.test(t)) continue
        
        author = t
        break
      }
      if (author) break
    }

    // Extract engagement counts - look for the buttons next to the video
    let likesCount = 0
    let commentsCount = 0
    let sharesCount = 0
    let viewCount = 0

    // The engagement buttons are typically to the RIGHT of the video
    const buttons = document.querySelectorAll('[role="button"]')
    const engagementButtons = []
    
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect()
      
      // Engagement buttons are usually to the right of video, vertically stacked
      if (video) {
        const videoRect = video.getBoundingClientRect()
        // Should be to the right of video but not too far
        if (rect.left < videoRect.right - 20 || rect.left > videoRect.right + 100) continue
        // Should be within video's vertical range
        if (rect.top < videoRect.top - 50 || rect.bottom > videoRect.bottom + 50) continue
      }
      
      // Look for buttons with numbers
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        const t = span.textContent?.trim()
        if (t && /^[\d,.]+[KkMm]?$/.test(t)) {
          const num = window.PoliticaCollector.parseCount(t)
          if (num > 0 && num < 10000000) {
            engagementButtons.push({ num, text: t, top: rect.top, btn })
          }
        }
      }
      
      // Check aria-labels
      const label = (btn.getAttribute('aria-label') || '').toLowerCase()
      if (label.includes('like') && !label.includes('unlike')) {
        const match = label.match(/(\d+[\d,KkMm.]*)/)
        if (match && likesCount === 0) likesCount = window.PoliticaCollector.parseCount(match[1])
      }
      if (label.includes('comment')) {
        const match = label.match(/(\d+[\d,KkMm.]*)/)
        if (match && commentsCount === 0) commentsCount = window.PoliticaCollector.parseCount(match[1])
      }
      if (label.includes('share')) {
        const match = label.match(/(\d+[\d,KkMm.]*)/)
        if (match && sharesCount === 0) sharesCount = window.PoliticaCollector.parseCount(match[1])
      }
    }

    // Sort by vertical position and take first 3 unique values
    engagementButtons.sort((a, b) => a.top - b.top)
    const uniqueNums = []
    for (const e of engagementButtons) {
      if (!uniqueNums.includes(e.num)) {
        uniqueNums.push(e.num)
      }
      if (uniqueNums.length >= 3) break
    }
    
    console.log('[FB Reel] Engagement numbers (near video):', uniqueNums)

    // Assign: likes (top), comments (middle), shares (bottom)
    if (uniqueNums.length >= 1 && likesCount === 0) likesCount = uniqueNums[0]
    if (uniqueNums.length >= 2 && commentsCount === 0) commentsCount = uniqueNums[1]
    if (uniqueNums.length >= 3 && sharesCount === 0) sharesCount = uniqueNums[2]

    // Extract all comments
    const comments = extractReelComments()
    
    if (comments.length > commentsCount) {
      commentsCount = comments.length
    }

    const url = window.location.href

    console.log('[FB Reel] Scraped:', { 
      text: text?.slice(0, 50), 
      author, 
      likesCount, 
      commentsCount,
      sharesCount,
      extractedComments: comments.length 
    })

    window.PoliticaCollector.showNotification(
      `Found: ${likesCount} likes, ${comments.length} comments, ${sharesCount} shares`,
      'info'
    )

    return {
      title: (text || 'Facebook Reel').slice(0, 200),
      text: text || 'Facebook Reel',
      platform_url: url,
      platform: 'facebook',
      source_type: 'social_media',
      author,
      language: 'en',
      likes_count: likesCount,
      comments_count: commentsCount,
      shares_count: sharesCount,
      comments: comments,
      metadata: {
        view_count: viewCount,
        shares_count: sharesCount,
        content_type: 'reel'
      }
    }
  }

  // ── Extract comments from reel ──────────────────────────────────────────────
  function extractReelComments() {
    const comments = []
    const seen = new Set()
    
    // Find video to determine reel area
    const video = document.querySelector('video')
    const screenWidth = window.innerWidth
    
    let maxX = screenWidth * 0.6
    if (video) {
      const videoRect = video.getBoundingClientRect()
      maxX = videoRect.right + 150
    }

    // Skip these common UI texts
    const uiTexts = new Set([
      'like', 'reply', 'share', 'see more', 'see less', 'view', 'hide',
      'most relevant', 'all comments', 'write a comment', 'original audio',
      'follow', 'following', 'message', 'in goa 24x7', 'send', 'cancel',
      'public', 'friends', 'only me', 'comment', 'comments', 'likes',
      'reels', 'photos', 'videos', 'about', 'more', 'search'
    ])

    // Find actual comment containers - they usually have a specific structure
    // Comments on FB reels are in the right panel, each with author + text + timestamp
    const commentContainers = document.querySelectorAll('[role="article"]')
    
    for (const container of commentContainers) {
      const rect = container.getBoundingClientRect()
      if (rect.left > maxX) continue  // Skip sidebar
      if (rect.width < 50 || rect.height < 20) continue  // Skip tiny elements
      
      // Get all text in this container
      const spans = container.querySelectorAll('span[dir="auto"]')
      let authorName = ''
      let commentText = ''
      
      for (const span of spans) {
        const t = span.textContent?.trim()
        if (!t || t.length < 2) continue
        
        // Skip if it's a known UI text
        if (uiTexts.has(t.toLowerCase())) continue
        
        // Skip timestamps
        if (/^\d+\s*(h|m|d|w|mo|y|hr|min|sec)$/i.test(t)) continue
        if (/^\d+\s*(hour|minute|second|day|week|month|year)s?\s*ago$/i.test(t)) continue
        
        // Skip numbers only
        if (/^[\d,.]+[KkMm]?$/.test(t)) continue
        
        // Check if this is an author name (inside a link, short text)
        const parentLink = span.closest('a')
        if (parentLink && t.length < 50 && !commentText) {
          // Verify it's a profile link
          const href = parentLink.href || ''
          if (href.includes('facebook.com/') && !href.includes('/reel/')) {
            authorName = t
            continue
          }
        }
        
        // This might be comment text if it's substantial
        if (t.length > 3 && t.length < 500) {
          // Skip if it looks like a caption (many hashtags)
          const hashtagCount = (t.match(/#/g) || []).length
          if (hashtagCount > 2) continue
          
          // Skip page names and common patterns
          if (t.includes('followers') || t.includes('following')) continue
          if (t.includes('First Infotainment') || t.includes('NEWS AS IT')) continue
          
          commentText = t
        }
      }
      
      // Only add if we have actual comment text
      if (commentText && commentText.length > 3 && !seen.has(commentText)) {
        seen.add(commentText)
        comments.push({ 
          author: authorName, 
          content: commentText, 
          likes_count: 0 
        })
      }
    }

    // If no comments found in article containers, try a different approach
    // Look for comment-like text patterns
    if (comments.length === 0) {
      console.log('[FB Reel] No comments in article containers, trying fallback...')
      
      // Comments might be in a different structure
      const allSpans = document.querySelectorAll('span[dir="auto"]')
      let potentialComments = []
      
      for (const span of allSpans) {
        const rect = span.getBoundingClientRect()
        if (rect.left > maxX) continue
        
        const t = span.textContent?.trim()
        if (!t || t.length < 5 || t.length > 300) continue
        
        // Skip UI text
        if (uiTexts.has(t.toLowerCase())) continue
        
        // Skip timestamps, numbers, hashtag-heavy text
        if (/^\d+\s*(h|m|d|w|mo|y)$/i.test(t)) continue
        if (/^[\d,.]+[KkMm]?$/.test(t)) continue
        if ((t.match(/#/g) || []).length > 2) continue
        
        // Skip known non-comment patterns
        if (t.includes('followers') || t.includes('following')) continue
        if (t.includes('friend suggestion')) continue
        
        potentialComments.push(t)
      }
      
      // Deduplicate and add
      for (const text of potentialComments) {
        if (!seen.has(text)) {
          seen.add(text)
          comments.push({ author: '', content: text, likes_count: 0 })
        }
      }
    }

    console.log('[FB Reel] Extracted comments:', comments.length, comments.slice(0, 3))
    return comments
  }

  // ── Close reel modal ────────────────────────────────────────────────────────
  async function closeReelModal() {
    // Try close button
    const closeBtn = document.querySelector('[aria-label="Close"], button[aria-label="Close"], [role="dialog"] [aria-label="Close"]')
    if (closeBtn) {
      closeBtn.click()
      await new Promise(r => setTimeout(r, 500))
      return
    }

    // Try Escape key
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
    document.dispatchEvent(escapeEvent)
    await new Promise(r => setTimeout(r, 500))

    // Try back button / history
    if (document.querySelector('[role="dialog"]')) {
      window.history.back()
      await new Promise(r => setTimeout(r, 500))
    }
  }
})()
