;(function () {
  'use strict'

  // ── Configuration ──────────────────────────────────────────────────────────
  var CONFIG = {
    SCROLL_DELAY: 800,
    CLICK_DELAY: 500,
    MODAL_WAIT_TIMEOUT: 5000,
    COMMENT_LOAD_TIMEOUT: 3000,
    MAX_COMMENT_EXPAND_CLICKS: 50,
    MAX_REPLY_EXPAND_CLICKS: 20,
    RATE_LIMIT_DELAY: 1000
  }

  // ── Scraper State ──────────────────────────────────────────────────────────
  var scraperState = {
    isRunning: false,
    shouldStop: false,
    postsCollected: 0,
    commentsCollected: 0,
    currentPostUrl: null,
    currentPostDate: null,
    collectedUrls: new Set(),
    errors: 0
  }

  // ── Message listener ────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'COLLECT_PAGE') {
      collectInstagramPage()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'COLLECT_POST') {
      collectInstagramPost()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'COLLECT_ALL') {
      collectAllProfilePosts(message.maxPosts || 500)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'DEEP_SCRAPE_PROFILE') {
      deepScrapeProfile(message.options || {})
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }))
      return true
    }
    if (message.type === 'STOP_DEEP_SCRAPE') {
      scraperState.shouldStop = true
      sendResponse({ success: true })
      return true
    }
    if (message.type === 'GET_SCRAPER_STATUS') {
      sendResponse({
        isRunning: scraperState.isRunning,
        postsCollected: scraperState.postsCollected,
        commentsCollected: scraperState.commentsCollected,
        currentPostUrl: scraperState.currentPostUrl,
        errors: scraperState.errors
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

  // ── Page dispatcher ──────────────────────────────────────────────────────────
  async function collectInstagramPage() {
    const url = window.location.href

    // Individual post page
    if (url.match(/instagram\.com\/p\//)) {
      return collectInstagramPost()
    }

    // Reel page
    if (url.match(/instagram\.com\/reel\//)) {
      return collectInstagramPost()
    }

    // Profile page — return list of visible post links for the popup to iterate
    if (url.match(/instagram\.com\/[^/?#]+\/?(\?.*)?$/)) {
      const postLinks = [
        ...new Set(
          Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
            .map(a => a.href)
        )
      ]
      return { type: 'profile', postLinks, count: postLinks.length }
    }

    return { type: 'unknown', url }
  }

  // ── Utility functions ────────────────────────────────────────────────────────
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms) })
  }

  function reportStatus() {
    try {
      chrome.runtime.sendMessage({
        type: 'INSTAGRAM_SCRAPER_STATUS',
        payload: {
          isRunning: scraperState.isRunning,
          postsCollected: scraperState.postsCollected,
          commentsCollected: scraperState.commentsCollected,
          currentPostUrl: scraperState.currentPostUrl,
          errors: scraperState.errors
        }
      })
    } catch (e) { /* popup may be closed */ }
  }

  // ── Post scraper (enhanced) ─────────────────────────────────────────────────
  async function collectInstagramPost(options) {
    options = options || {}
    var expandComments = options.expandComments !== false
    var url = window.location.href

    // Expand caption if truncated
    expandCaptionText()
    await sleep(200)

    // Caption / title - try multiple selectors
    var captionEl = findCaption()
    var title = (captionEl ? captionEl.textContent.trim() : document.title).slice(0, 2000)

    // Author handle and display name
    var authorInfo = extractAuthorInfo()
    var author = authorInfo.displayName
    var authorHandle = authorInfo.handle

    // Likes count
    var likesCount = extractLikesCount()

    // Comment count from header (before expansion)
    var headerCommentCount = extractHeaderCommentCount()

    // Post date
    var publishedAt = extractPostDate()

    // Media type
    var mediaType = detectMediaType()

    // Expand and collect all comments if requested
    var comments = []
    if (expandComments) {
      await expandAllComments()
      comments = scrapeAllComments()
    } else {
      comments = scrapeAllComments()
    }

    var doc = {
      text: title,
      title: title.slice(0, 200),
      platform_url: url,
      author: author,
      author_handle: authorHandle,
      language: detectLanguage(title),
      likes_count: likesCount,
      comments_count: comments.length || headerCommentCount,
      published_at: publishedAt,
      comments: comments.map(function (c) {
        return {
          author: c.displayName,
          author_handle: c.handle,
          content: c.text,
          likes_count: c.likes,
          replies_count: c.replies ? c.replies.length : 0
        }
      })
    }

    try {
      var result = await sendToInstagramEndpoint(doc)
      if (result && result.id) {
        // Capture screenshot to visually prove the post was collected
        captureScreenshot(result.id)
      }
      if (!options.silent) {
        window.PoliticaCollector.showNotification(
          'Saved "' + title.slice(0, 40) + '" (' + comments.length + ' comments)',
          'success'
        )
      }
      return { success: true, id: result && result.id, comments: comments.length }
    } catch (err) {
      if (!options.silent) {
        window.PoliticaCollector.showNotification(err.message, 'error')
      }
      return { error: err.message }
    }
  }

  function findCaption() {
    // Always scope to the modal dialog first, then fall back to article
    var root = document.querySelector('div[role="dialog"]') || document.querySelector('article')

    if (!root) return null

    // Try h1 inside the modal (Instagram puts caption in h1)
    var h1 = root.querySelector('h1')
    if (h1 && h1.textContent && h1.textContent.trim().length > 5) return h1

    // Try known caption class patterns inside the modal
    var classSelectors = [
      'span[dir="auto"]._ap3a',
      'div._a9zs span[dir="auto"]',
      'span[dir="auto"]'
    ]
    for (var i = 0; i < classSelectors.length; i++) {
      var els = root.querySelectorAll(classSelectors[i])
      for (var k = 0; k < els.length; k++) {
        var t = (els[k].textContent || '').trim()
        // Skip short strings, usernames, and time indicators
        if (t.length > 20 && !/^\d+[hdwmy]$/.test(t) && !/^(Reply|Like|Follow|Following|Edited)$/i.test(t)) {
          return els[k]
        }
      }
    }

    // Fallback: longest span inside the modal that isn't a username
    var spans = root.querySelectorAll('span[dir="auto"]')
    var longest = null
    var maxLen = 0
    for (var j = 0; j < spans.length; j++) {
      var text = spans[j].textContent || ''
      if (text.length > maxLen && text.length > 20) {
        maxLen = text.length
        longest = spans[j]
      }
    }
    return longest
  }

  function expandCaptionText() {
    var moreButtons = document.querySelectorAll('span[role="link"], button, div[role="button"]')
    for (var i = 0; i < moreButtons.length; i++) {
      var btn = moreButtons[i]
      var text = (btn.textContent || '').trim().toLowerCase()
      if (text === 'more' || text === '... more' || text === '…more') {
        try { btn.click() } catch (e) { /* ignore */ }
      }
    }
  }

  function extractAuthorInfo() {
    var result = { displayName: '', handle: '' }
    
    // Try header link first
    var headerLink = document.querySelector('header a[role="link"][href^="/"]')
    if (!headerLink) {
      headerLink = document.querySelector('article header a[href^="/"]')
    }
    if (!headerLink) {
      headerLink = document.querySelector('div[role="dialog"] header a[href^="/"]')
    }
    
    if (headerLink) {
      var href = headerLink.getAttribute('href') || ''
      result.handle = href.replace(/^\//, '').replace(/\/$/, '').split('/')[0]
      result.displayName = headerLink.textContent ? headerLink.textContent.trim() : result.handle
    }
    
    return result
  }

  function extractLikesCount() {
    var likesCount = 0
    var selectors = [
      'a[href$="/liked_by/"] span',
      'section a[href$="/liked_by/"]',
      'button span:not([class*="x"])',
      'div[role="button"] span'
    ]
    
    // Look for "X likes" pattern
    var allSpans = document.querySelectorAll('section span, article span')
    for (var i = 0; i < allSpans.length; i++) {
      var text = allSpans[i].textContent || ''
      var match = text.match(/^([\d,\.]+[KMB]?)\s*likes?$/i)
      if (match) {
        return window.PoliticaCollector.parseCount(match[1])
      }
    }
    
    // Try direct selectors
    for (var j = 0; j < selectors.length; j++) {
      var el = document.querySelector(selectors[j])
      if (el && el.textContent) {
        var parsed = window.PoliticaCollector.parseCount(el.textContent)
        if (parsed > 0) {
          return parsed
        }
      }
    }
    
    return likesCount
  }

  function extractHeaderCommentCount() {
    var allText = document.body.innerText || ''
    var match = allText.match(/View all (\d+) comments/i)
    if (match) {
      return parseInt(match[1], 10)
    }
    return 0
  }

  function extractPostDate() {
    // Scope to modal first, then fall back to article
    var root = document.querySelector('div[role="dialog"]') || document.querySelector('article')
    if (!root) return null
    
    // Look for time element within the modal/article
    var timeEl = root.querySelector('time[datetime]')
    if (timeEl) {
      return timeEl.getAttribute('datetime')
    }
    
    // Look for relative time text in the modal/article
    var timePatterns = [
      /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i,
      /(\w+)\s+(\d+),?\s*(\d{4})?/i
    ]
    var spans = root.querySelectorAll('span, a')
    for (var i = 0; i < spans.length; i++) {
      var text = (spans[i].textContent || '').trim()
      if (text.length < 30) {
        for (var p = 0; p < timePatterns.length; p++) {
          if (timePatterns[p].test(text)) {
            return text // Return the relative time text for server to parse
          }
        }
      }
    }
    return null
  }

  function detectMediaType() {
    var article = document.querySelector('article') || document.querySelector('div[role="dialog"]')
    if (!article) return 'unknown'
    
    if (article.querySelector('video')) return 'video'
    
    // Check for carousel (multiple images)
    var carouselButtons = article.querySelectorAll('button[aria-label*="Next"], button[aria-label*="Previous"]')
    if (carouselButtons.length > 0) return 'carousel'
    
    if (article.querySelector('img[src*="instagram"]')) return 'image'
    
    return 'unknown'
  }

  function detectLanguage(text) {
    if (!text) return 'unknown'
    // Simple heuristic - check for common language patterns
    if (/[\u0900-\u097F]/.test(text)) return 'hi' // Hindi
    if (/[\u0600-\u06FF]/.test(text)) return 'ar' // Arabic
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh' // Chinese
    return 'en'
  }

  // ── Comment expansion and scraping ──────────────────────────────────────────

  function findCommentScrollContainer() {
    // The right panel of an Instagram post modal contains the comments in a
    // scrollable div. We try several heuristics to find it.
    var dialog = document.querySelector('div[role="dialog"]')
    var root = dialog || document.querySelector('article') || document.body

    // Prefer the element that already has a scrollbar and contains <li> comments
    var candidates = root.querySelectorAll('div, section, ul')
    var best = null
    var bestScore = 0

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i]
      var style = window.getComputedStyle(el)
      var overflowY = style.overflowY
      var isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20
      if (!isScrollable) continue

      var liCount = el.querySelectorAll('li').length
      if (liCount > bestScore) {
        bestScore = liCount
        best = el
      }
    }

    // Fallback: any scrollable div with meaningful height
    if (!best) {
      for (var j = 0; j < candidates.length; j++) {
        var candidate = candidates[j]
        var cs = window.getComputedStyle(candidate)
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && candidate.scrollHeight > candidate.clientHeight + 20) {
          best = candidate
          break
        }
      }
    }

    return best
  }

  async function scrollCommentContainer() {
    var container = findCommentScrollContainer()
    if (!container) {
      // Fallback to window scroll
      window.scrollBy(0, 300)
      return
    }

    var prevScrollTop = container.scrollTop
    container.scrollTop += 300

    // Dispatch scroll event so Instagram's lazy loader fires
    container.dispatchEvent(new Event('scroll', { bubbles: true }))

    await sleep(500)
    return container.scrollTop !== prevScrollTop
  }

  async function expandAllComments() {
    var totalClicks = 0
    var maxClicks = CONFIG.MAX_COMMENT_EXPAND_CLICKS

    // First, click "View all X comments" button
    var viewAllClicked = await clickViewAllComments()
    if (viewAllClicked) {
      await sleep(CONFIG.COMMENT_LOAD_TIMEOUT)
    }

    var lastCommentCount = 0
    var noProgressRounds = 0

    while (totalClicks < maxClicks && noProgressRounds < 4) {
      // Scroll the comment container incrementally
      await scrollCommentContainer()

      // Click any visible "Load more" / "View more" buttons after scrolling
      var clicked = clickLoadMoreComments()
      totalClicks += clicked

      if (clicked > 0) {
        await sleep(CONFIG.CLICK_DELAY)
      }

      var newCount = document.querySelectorAll('ul li').length
      if (newCount > lastCommentCount || clicked > 0) {
        lastCommentCount = newCount
        noProgressRounds = 0

        var found = scrapeAllComments().length
        try {
          window.PoliticaCollector.showNotification(
            'Loading comments... (' + found + ' found so far)',
            'info'
          )
        } catch (e) { /* popup may be closed */ }
      } else {
        noProgressRounds++
        await sleep(500)
      }
    }

    // Expand all replies
    await expandAllReplies()

    return totalClicks
  }

  async function clickViewAllComments() {
    var patterns = [
      /view all \d+ comments/i,
      /view all comments/i,
      /load more comments/i
    ]
    
    var buttons = document.querySelectorAll('span[role="link"], button, div[role="button"], a')
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 50) continue
      
      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try {
            btn.click()
            return true
          } catch (e) { /* ignore */ }
        }
      }
    }
    return false
  }

  function clickLoadMoreComments() {
    var clicked = 0
    var patterns = [
      /load more comments/i,
      /view more comments/i,
      /view previous comments/i,
      /\+\s*\d+/
    ]
    
    var buttons = document.querySelectorAll('button, span[role="link"], div[role="button"], li > div > button')
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 60) continue
      
      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try {
            btn.click()
            clicked++
          } catch (e) { /* ignore */ }
          break
        }
      }
    }
    return clicked
  }

  async function expandAllReplies() {
    var totalClicks = 0
    var maxClicks = CONFIG.MAX_REPLY_EXPAND_CLICKS
    var noNewClicks = 0
    
    while (totalClicks < maxClicks && noNewClicks < 3) {
      var clicked = clickViewReplies()
      if (clicked > 0) {
        totalClicks += clicked
        noNewClicks = 0
        await sleep(CONFIG.CLICK_DELAY)
      } else {
        noNewClicks++
        await sleep(300)
      }
    }
    
    return totalClicks
  }

  function clickViewReplies() {
    var clicked = 0
    var patterns = [
      /view \d+ repl/i,
      /view replies/i,
      /view \d+ more repl/i,
      /hide replies/i // Don't click this one
    ]
    
    var buttons = document.querySelectorAll('span[role="link"], button, div[role="button"]')
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 40) continue
      
      // Skip "hide replies"
      if (/hide/i.test(text)) continue
      
      for (var p = 0; p < patterns.length - 1; p++) {
        if (patterns[p].test(text)) {
          try {
            btn.click()
            clicked++
          } catch (e) { /* ignore */ }
          break
        }
      }
    }
    return clicked
  }

  function scrapeAllComments() {
    var comments = []
    var seen = new Set()
    
    // Find comment container - usually a ul element
    var commentContainers = document.querySelectorAll('ul[class], div[class] > ul')
    
    for (var c = 0; c < commentContainers.length; c++) {
      var container = commentContainers[c]
      var items = container.querySelectorAll(':scope > div > li, :scope > li')
      
      for (var i = 0; i < items.length; i++) {
        var li = items[i]
        var comment = extractCommentFromElement(li)
        if (comment && comment.text) {
          var key = comment.handle + '::' + comment.text.slice(0, 80)
          if (!seen.has(key)) {
            seen.add(key)
            
            // Look for nested replies
            var replyContainer = li.querySelector('ul')
            if (replyContainer) {
              var replyItems = replyContainer.querySelectorAll(':scope > div > li, :scope > li')
              comment.replies = []
              for (var r = 0; r < replyItems.length; r++) {
                var reply = extractCommentFromElement(replyItems[r])
                if (reply && reply.text) {
                  var replyKey = reply.handle + '::' + reply.text.slice(0, 80)
                  if (!seen.has(replyKey)) {
                    seen.add(replyKey)
                    comment.replies.push(reply)
                  }
                }
              }
            }
            
            comments.push(comment)
          }
        }
      }
    }
    
    // Fallback: try article-based scraping
    if (comments.length === 0) {
      comments = scrapeCommentsFromArticle()
    }
    
    return comments
  }

  function extractCommentFromElement(element) {
    if (!element) return null

    // ── Strategy 1: Walk direct children of <li> to separate username link from text ──
    // Instagram comment structure (simplified):
    //   <li>
    //     <div>
    //       <span>
    //         <a href="/username/">username</a>    ← username link
    //         <span dir="auto">comment text</span> ← text comes AFTER the link
    //       </span>
    //       … action buttons (like, reply) …
    //     </div>
    //   </li>

    var handle = ''
    var displayName = ''
    var commentText = ''
    var likes = 0

    // Find the username link — prefer link inside the first meaningful span
    var usernameLink = (
      element.querySelector('a[href^="/"][role="link"]') ||
      element.querySelector('a[href^="/"]')
    )

    if (usernameLink) {
      var href = usernameLink.getAttribute('href') || ''
      handle = href.replace(/^\//, '').replace(/\/$/, '').split('/')[0]
      displayName = (usernameLink.textContent || '').trim() || handle
    }

    // ── Strategy 2: find the span[dir="auto"] that is NOT inside the username link ──
    // and is NOT a time stamp / short action word
    var dirSpans = element.querySelectorAll('span[dir="auto"]')
    for (var i = 0; i < dirSpans.length; i++) {
      var span = dirSpans[i]

      // Skip spans that are inside the username anchor
      if (usernameLink && usernameLink.contains(span)) continue

      var text = (span.textContent || '').trim()
      if (!text || text.length < 2) continue
      if (text === displayName || text === handle) continue
      if (/^\d+[hdwmys]$/.test(text)) continue              // time: "2h", "5d"
      if (/^(Reply|Like|Edited|Follow)$/i.test(text)) continue
      if (/^\d+\s*(like|reply|replies)/i.test(text)) continue

      commentText = text
      break
    }

    // ── Strategy 3 fallback: if still empty, grab the longest non-username text node ──
    if (!commentText) {
      var allSpans = element.querySelectorAll('span')
      var maxLen = 0
      for (var j = 0; j < allSpans.length; j++) {
        var s = allSpans[j]
        if (usernameLink && usernameLink.contains(s)) continue
        var t = (s.textContent || '').trim()
        if (t.length > maxLen && t !== displayName && t !== handle &&
            !/^\d+[hdwmys]$/.test(t) && !/^(Reply|Like|Edited|Follow)$/i.test(t)) {
          maxLen = t.length
          commentText = t
        }
      }
    }

    // ── Likes count ──────────────────────────────────────────────────────────
    // Instagram renders like counts near each comment as:
    //   <button aria-label="Like">…</button> <span>X likes</span>
    var likeButton = element.querySelector('button[aria-label*="like" i]')
    if (likeButton) {
      // The count span is usually a sibling of the button
      var parent = likeButton.parentElement
      if (parent) {
        var likeText = parent.textContent || ''
        var m = likeText.match(/(\d[\d,]*)\s*like/i)
        if (m) likes = parseInt(m[1].replace(/,/g, ''), 10)
      }
    }

    // Fallback: scan element text for "X likes"
    if (likes === 0) {
      var elText = element.textContent || ''
      var lm = elText.match(/(\d[\d,]*)\s*likes?/i)
      if (lm) likes = parseInt(lm[1].replace(/,/g, ''), 10)
    }

    if (!handle && !commentText) return null

    return {
      handle: handle,
      displayName: displayName || handle,
      text: commentText,
      likes: likes,
      replies: []
    }
  }

  function scrapeCommentsFromArticle() {
    var comments = []
    var seen = new Set()
    var article = document.querySelector('article') || document.querySelector('div[role="dialog"]')
    if (!article) return comments
    
    // Find all potential comment elements
    var elements = article.querySelectorAll('div[role="button"], li, div > div > div')
    
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i]
      var links = el.querySelectorAll('a[href^="/"]')
      if (links.length === 0) continue
      
      var usernameLink = links[0]
      var href = usernameLink.getAttribute('href') || ''
      var handle = href.replace(/^\//, '').replace(/\/$/, '').split('/')[0]
      
      if (!handle || handle.length > 30) continue
      
      var spans = el.querySelectorAll('span[dir="auto"]')
      var text = ''
      for (var j = 0; j < spans.length; j++) {
        var spanText = spans[j].textContent || ''
        if (spanText.length > 5 && spanText !== handle) {
          text = spanText.trim()
          break
        }
      }
      
      if (text) {
        var key = handle + '::' + text.slice(0, 80)
        if (!seen.has(key)) {
          seen.add(key)
          comments.push({
            handle: handle,
            displayName: usernameLink.textContent ? usernameLink.textContent.trim() : handle,
            text: text,
            likes: 0,
            replies: []
          })
        }
      }
    }
    
    return comments
  }

  // ── Deep Profile Scraper ─────────────────────────────────────────────────────
  async function deepScrapeProfile(options) {
    var maxPosts = options.maxPosts || 100
    var fromDate = options.fromDate ? new Date(options.fromDate) : null
    var toDate = options.toDate ? new Date(options.toDate) : null
    var url = window.location.href
    
    if (!url.match(/instagram\.com\/[^/?#]+\/?(\?.*)?$/)) {
      return { error: 'Not a profile page. Navigate to an Instagram profile.' }
    }
    
    // Check if logged in
    if (!isLoggedIn()) {
      return { error: 'Please log in to Instagram first.' }
    }
    
    // Reset state
    scraperState.isRunning = true
    scraperState.shouldStop = false
    scraperState.postsCollected = 0
    scraperState.commentsCollected = 0
    scraperState.currentPostUrl = null
    scraperState.currentPostDate = null
    scraperState.collectedUrls = new Set()
    scraperState.errors = 0
    
    reportStatus()
    window.PoliticaCollector.showNotification('Starting deep profile scrape...', 'info')
    
    try {
      var noNewPostsStreak = 0
      var maxNoNewStreak = 5
      var reachedDateBoundary = false
      
      while (!scraperState.shouldStop && !reachedDateBoundary && scraperState.postsCollected < maxPosts) {
        // Collect actual DOM element references for grid thumbnails
        var postElements = getVisiblePostElements()
        var newElements = postElements.filter(function (el) {
          return !scraperState.collectedUrls.has(el.href)
        })
        
        if (newElements.length === 0) {
          noNewPostsStreak++
          if (noNewPostsStreak >= maxNoNewStreak) {
            window.PoliticaCollector.showNotification('Reached end of profile posts', 'info')
            break
          }
          // Scroll to load more
          await scrollProfileGrid()
          await sleep(CONFIG.SCROLL_DELAY)
          continue
        }
        
        noNewPostsStreak = 0
        
        // Process each new post element directly
        for (var i = 0; i < newElements.length && !scraperState.shouldStop; i++) {
          if (scraperState.postsCollected >= maxPosts) break
          
          var anchorEl = newElements[i]
          var postUrl = anchorEl.href
          scraperState.currentPostUrl = postUrl
          scraperState.collectedUrls.add(postUrl)
          reportStatus()
          
          try {
            // Click the element directly to open the modal
            var opened = await openPostModal(postUrl, anchorEl)
            if (!opened) {
              // Modal didn't open — skip silently, don't count as error
              continue
            }
            
            // Wait for modal to load
            await sleep(CONFIG.RATE_LIMIT_DELAY)
            
            // Extract post date to check if it's within the date range
            var postDateStr = extractPostDate()
            scraperState.currentPostDate = postDateStr
            reportStatus()
            
            // Check if post is within date range
            if (fromDate || toDate) {
              var postDate = null
              if (postDateStr) {
                // Try to parse ISO datetime or relative time
                if (postDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                  postDate = new Date(postDateStr)
                } else {
                  // For relative times like "3 days ago", we can't filter accurately
                  // So we'll skip date filtering for relative times
                  postDate = null
                }
              }
              
              if (postDate) {
                if (fromDate && postDate < fromDate) {
                  // Post is older than fromDate - stop all scraping immediately
                  window.PoliticaCollector.showNotification('Reached posts older than date range, stopping...', 'info')
                  await closePostModal()
                  reachedDateBoundary = true
                  break
                }
                if (toDate && postDate > toDate) {
                  // Post is newer than toDate, skip it
                  await closePostModal()
                  await sleep(CONFIG.CLICK_DELAY)
                  continue
                }
              }
            }
            
            // Scrape the post with full comment expansion
            var result = await collectInstagramPost({ expandComments: true, silent: true })
            
            if (result.success) {
              scraperState.postsCollected++
              scraperState.commentsCollected += result.comments || 0
            } else {
              scraperState.errors++
            }
            
            // Close the modal
            await closePostModal()
            await sleep(CONFIG.CLICK_DELAY)
            
            reportStatus()
            
            if (scraperState.postsCollected >= maxPosts) break
            
          } catch (err) {
            scraperState.errors++
            // Try to close modal if open
            await closePostModal()
          }
        }
        
        // Scroll to load more posts
        await scrollProfileGrid()
        await sleep(CONFIG.SCROLL_DELAY)
      }
      
    } finally {
      scraperState.isRunning = false
      scraperState.currentPostUrl = null
      reportStatus()
    }
    
    var message = 'Collected ' + scraperState.postsCollected + ' posts with ' + 
                  scraperState.commentsCollected + ' comments'
    if (scraperState.errors > 0) {
      message += ' (' + scraperState.errors + ' errors)'
    }
    window.PoliticaCollector.showNotification(message, 'success')
    
    return {
      success: true,
      postsCollected: scraperState.postsCollected,
      commentsCollected: scraperState.commentsCollected,
      errors: scraperState.errors
    }
  }

  function isLoggedIn() {
    // Check for login indicators
    var profileLink = document.querySelector('a[href*="/accounts/login"]')
    if (profileLink) return false
    
    // Check for user avatar or profile menu
    var avatar = document.querySelector('img[alt*="profile picture" i]')
    var navProfile = document.querySelector('a[href^="/"][role="link"] img[alt]')
    
    return !!(avatar || navProfile)
  }

  function getVisiblePostLinks() {
    var links = []
    // Only pick up grid thumbnails: anchors inside <main> that have an <img> child.
    // This excludes nav links, sidebar suggestions, and story rings.
    var mainEl = document.querySelector('main') || document.body
    var anchors = mainEl.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')

    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i]
      // Must contain an image (grid thumbnails always do)
      if (!anchor.querySelector('img')) continue
      var href = anchor.href
      if (href && links.indexOf(href) === -1) {
        links.push(href)
      }
    }

    return links
  }

  function getVisiblePostElements() {
    // Return the actual <a> DOM elements for grid thumbnails so we can click them directly.
    var elements = []
    var mainEl = document.querySelector('main') || document.body
    var anchors = mainEl.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')

    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i]
      if (!anchor.querySelector('img')) continue
      elements.push(anchor)
    }

    return elements
  }

  async function openPostModal(postUrl, anchorEl) {
    var anchor = anchorEl || null

    // If no direct element reference, find by partial href match among grid thumbnails
    if (!anchor) {
      var pathname = new URL(postUrl).pathname.replace(/\/$/, '')
      var mainEl = document.querySelector('main') || document.body
      var candidates = mainEl.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i]
        if (!el.querySelector('img')) continue
        var elPath = el.getAttribute('href') || ''
        // Normalise: strip trailing slash, support absolute or relative href
        elPath = elPath.replace(/\/$/, '')
        if (elPath === pathname || elPath === postUrl.replace(/\/$/, '')) {
          anchor = el
          break
        }
      }
    }

    if (!anchor) {
      return false
    }

    // Prefer clicking the thumbnail image inside the link for reliability
    var img = anchor.querySelector('img')
    var target = img || anchor
    target.click()

    // Wait for modal to appear
    var modalAppeared = await window.PoliticaCollector.waitFor(function () {
      return document.querySelector('div[role="dialog"]') !== null
    }, CONFIG.MODAL_WAIT_TIMEOUT, 200)

    return modalAppeared
  }

  async function closePostModal() {
    // Try multiple methods to close the modal
    
    // Method 1: Click close button
    var closeSelectors = [
      'button[aria-label="Close"]',
      'button[aria-label="close"]',
      'div[role="dialog"] button svg[aria-label="Close"]',
      'div[role="dialog"] div[role="button"]'
    ]
    
    for (var i = 0; i < closeSelectors.length; i++) {
      var closeBtn = document.querySelector(closeSelectors[i])
      if (closeBtn) {
        // If it's an SVG, click its parent button
        if (closeBtn.tagName === 'svg') {
          closeBtn = closeBtn.closest('button') || closeBtn.closest('div[role="button"]')
        }
        if (closeBtn) {
          try {
            closeBtn.click()
            await sleep(300)
            if (!document.querySelector('div[role="dialog"]')) {
              return true
            }
          } catch (e) { /* continue */ }
        }
      }
    }
    
    // Method 2: Press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    }))
    await sleep(300)
    
    if (!document.querySelector('div[role="dialog"]')) {
      return true
    }
    
    // Method 3: Click outside the modal
    var backdrop = document.querySelector('div[role="dialog"]')
    if (backdrop && backdrop.parentElement) {
      var parent = backdrop.parentElement
      var rect = backdrop.getBoundingClientRect()
      // Click to the left of the modal
      var clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left - 50,
        clientY: rect.top + rect.height / 2
      })
      parent.dispatchEvent(clickEvent)
      await sleep(300)
    }
    
    // Method 4: Navigate back
    if (document.querySelector('div[role="dialog"]')) {
      window.history.back()
      await sleep(500)
    }
    
    return !document.querySelector('div[role="dialog"]')
  }

  async function scrollProfileGrid() {
    // Scroll the main window
    window.scrollTo(0, document.body.scrollHeight)
    
    // Also try scrolling any scrollable container
    var scrollContainers = document.querySelectorAll('main, [role="main"], article')
    for (var i = 0; i < scrollContainers.length; i++) {
      var container = scrollContainers[i]
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTop = container.scrollHeight
      }
    }
  }

  // ── API Communication ───────────────────────────────────────────────────────
  async function sendToInstagramEndpoint(doc) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({
        type: 'SEND_TO_INSTAGRAM_API',
        payload: doc
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
  }

  function captureScreenshot(documentId) {
    // Fire-and-forget: request background to capture the visible tab and upload
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT', documentId: documentId }, function () {
      // Ignore errors — screenshot is best-effort
      void chrome.runtime.lastError
    })
  }

  // ── Legacy Profile auto-scroll collector ─────────────────────────────────────
  async function collectAllProfilePosts(maxPosts) {
    const url = window.location.href
    if (!url.match(/instagram\.com\/[^/?#]+\/?(\?.*)?$/)) {
      return { error: 'Not a profile page' }
    }

    window.PoliticaCollector.showNotification('Starting profile auto-scroll...', 'info')

    const getPostLinks = () =>
      Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
        .map(a => a.href)
        .filter((v, i, arr) => arr.indexOf(v) === i)

    let lastNotified = 0
    const collected = await window.PoliticaCollector.autoScrollAndCollect({
      getPostLinks,
      maxPosts,
      scrollDelay: 1500,
      onProgress(count) {
        if (count - lastNotified >= 10) {
          lastNotified = count
          window.PoliticaCollector.showNotification(`Scrolling... found ${count} posts`, 'info')
        }
      }
    })

    // For each collected URL, extract thumbnail + caption from the grid anchor
    let saved = 0
    for (const postUrl of collected) {
      const anchor = document.querySelector(`a[href="${new URL(postUrl).pathname}"]`) ||
                     document.querySelector(`a[href="${postUrl}"]`)
      const img = anchor?.querySelector('img')
      const imgSrc = img?.src || ''
      const captionPreview = (img?.alt || '').slice(0, 200)

      const doc = {
        title: captionPreview || 'Instagram post',
        text: captionPreview,
        platform_url: postUrl,
        platform: 'instagram',
        source_type: 'social_media',
        metadata: { thumbnail: imgSrc, needs_full_extraction: true }
      }

      try {
        await window.PoliticaCollector.sendToApi(doc)
        saved++
      } catch (_) { /* continue on individual failures */ }
    }

    window.PoliticaCollector.showNotification(`Collected ${saved} of ${collected.length} posts`, 'success')
    return { success: true, count: collected.length, saved }
  }

  // ── Instagram-specific load-more helpers ────────────────────────────────────
  function clickInstagramLoadMore() {
    var clicked = 0

    // "Load more comments" buttons
    var loadMoreBtns = document.querySelectorAll(
      'button, [role="button"], a[role="link"]'
    )
    var patterns = [
      /load\s*more\s*comments/i,
      /view\s*all\s*\d+\s*comments/i,
      /view\s*more\s*comments/i,
      /view\s*\d+\s*more\s*replies/i,
      /view\s*replies/i
    ]

    for (var i = 0; i < loadMoreBtns.length; i++) {
      var btn = loadMoreBtns[i]
      var text = (btn.textContent || '').trim()
      if (text.length > 60) continue

      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].test(text)) {
          try { btn.click(); clicked++ } catch (e) { /* ignore */ }
          break
        }
      }
    }

    // "more" text expansion within post captions
    var moreSpans = document.querySelectorAll('span[role="link"], button')
    for (var j = 0; j < moreSpans.length; j++) {
      var span = moreSpans[j]
      var spanText = (span.textContent || '').trim().toLowerCase()
      if (spanText === 'more' || spanText === '... more') {
        try { span.click(); clicked++ } catch (e) { /* ignore */ }
      }
    }

    return clicked
  }

  // Expose for collector-manager
  window.PoliticaInstagram = {
    clickLoadMore: clickInstagramLoadMore,
    collectPost: collectInstagramPost,
    collectPage: collectInstagramPage,
    deepScrapeProfile: deepScrapeProfile,
    stopDeepScrape: function () { scraperState.shouldStop = true },
    getScraperStatus: function () {
      return {
        isRunning: scraperState.isRunning,
        postsCollected: scraperState.postsCollected,
        commentsCollected: scraperState.commentsCollected,
        currentPostUrl: scraperState.currentPostUrl,
        errors: scraperState.errors
      }
    }
  }
})()
