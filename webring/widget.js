/**
 * interweb — embeddable webring widget
 *
 * Usage:
 *   <script
 *     src="https://v8v88v8v88.com/interweb/webring/widget.js"
 *     data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"
 *     async
 *   ></script>
 *
 * Optional:
 *   data-theme="light" | "dark"   force a look (default: follows your page's text colour and font)
 *   data-label="interweb"         ring name shown in the middle
 *   data-hub="https://…"          where the ring name links to
 *
 * The script inserts a small pill next to the <script> tag:  ←  interweb  →
 * It fetches the ring data, finds the current site and points the arrows
 * at the previous and next sites.
 */

;(function () {
  'use strict'

  // ── Configuration ──────────────────────────────────────────

  const SCRIPT = document.currentScript
  if (!SCRIPT) return // Edge case: module context or removed script

  /**
   * Canonical ring JSON on jsDelivr — served with Access-Control-Allow-Origin so
   * fetch() works from any origin (unlike raw github.io for static JSON).
   */
  const VAIBRING_RING_CDN =
    'https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json'
  /** Legacy default; still rewritten to CDN so old embeds work cross-origin. */
  const VAIBRING_RING_PAGES_LEGACY =
    'https://v8v88v8v88.github.io/interweb/webring/sites.json'

  function resolveRingFetchUrl(requested) {
    if (!requested || !String(requested).trim()) return VAIBRING_RING_CDN
    var raw = String(requested).trim()
    try {
      var legacy = new URL(VAIBRING_RING_PAGES_LEGACY)
      var cur = new URL(raw, window.location.href)
      if (
        legacy.hostname === cur.hostname &&
        legacy.pathname.replace(/\/+$/, '') === cur.pathname.replace(/\/+$/, '')
      ) {
        return VAIBRING_RING_CDN
      }
    } catch (e) {}
    return raw
  }

  var FETCH_RING_URL = resolveRingFetchUrl(SCRIPT.getAttribute('data-ring'))

  const THEME = SCRIPT.getAttribute('data-theme') || ''
  const LABEL = SCRIPT.getAttribute('data-label') || 'interweb'
  const HUB_URL = SCRIPT.getAttribute('data-hub') || 'https://v8v88v8v88.com/interweb'

  // ── Inject CSS (once) ──────────────────────────────────────

  /**
   * widget.css sits next to sites.json in the repo, so derive it from the ring URL.
   * If the ring file has another name (or a query string), use the folder this
   * script was loaded from instead, then the canonical CDN copy.
   */
  function resolveCssUrl() {
    if (/sites\.json$/i.test(FETCH_RING_URL)) {
      return FETCH_RING_URL.replace(/sites\.json$/i, 'widget.css')
    }
    try {
      if (SCRIPT.src) return new URL('widget.css', SCRIPT.src).href
    } catch (e) {}
    return VAIBRING_RING_CDN.replace(/sites\.json$/i, 'widget.css')
  }

  const CSS_ID = 'interweb-css'
  if (!document.getElementById(CSS_ID)) {
    const cssUrl = resolveCssUrl()
    const link = document.createElement('link')
    link.id = CSS_ID
    link.rel = 'stylesheet'
    link.href = cssUrl
    document.head.appendChild(link)
  }

  // ── Build container ────────────────────────────────────────

  const widget = document.createElement('div')
  widget.className = 'interweb-widget'
  widget.setAttribute('role', 'navigation')
  widget.setAttribute('aria-label', LABEL + ' webring')
  // "retro" was an older theme name; it now maps to dark
  if (THEME) widget.setAttribute('data-theme', THEME === 'retro' ? 'dark' : THEME)
  widget.setAttribute('data-state', 'loading')

  function makeLink(className, text) {
    const a = document.createElement('a')
    a.className = className
    a.href = '#'
    a.rel = 'noopener'
    a.textContent = text
    return a
  }

  const prevLink = makeLink('interweb-arrow', '←')
  const hubLink = makeLink('interweb-hub', LABEL)
  const nextLink = makeLink('interweb-arrow', '→')
  hubLink.href = HUB_URL
  prevLink.setAttribute('aria-label', 'Previous site')
  nextLink.setAttribute('aria-label', 'Next site')
  ;[prevLink, nextLink].forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.getAttribute('href') === '#') e.preventDefault()
    })
  })
  widget.appendChild(prevLink)
  widget.appendChild(hubLink)
  widget.appendChild(nextLink)
  SCRIPT.parentNode.insertBefore(widget, SCRIPT)

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Normalise a URL for comparison: host, path without /index.html, no trailing slash,
   * lowercase (so /interweb and /interweb/ and /interweb/index.html match the ring entry).
   */
  function normalise(url) {
    try {
      const u = new URL(url)
      const host = u.host.replace(/^www\./, '').toLowerCase()
      let path = u.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '')
      return (host + path).toLowerCase()
    } catch {
      return String(url).toLowerCase().replace(/\/+$/, '')
    }
  }

  /**
   * Find the index of the current page's site in the ring.
   * Returns -1 if not found.
   */
  function entryNorms(s) {
    const norms = [normalise(s.url)]
    if (Array.isArray(s.aliases)) {
      s.aliases.forEach((a) => {
        if (typeof a === 'string' && a.trim()) norms.push(normalise(a.trim()))
      })
    }
    return norms
  }

  function findCurrent(sites) {
    const here = normalise(window.location.href)
    let idx = sites.findIndex((s) => entryNorms(s).includes(here))
    if (idx !== -1) return idx

    let bestIdx = -1
    let maxPathLen = -1

    try {
      const hereURL = new URL(window.location.href)
      const hereHost = hereURL.host.replace(/^www\./, '').toLowerCase()
      const herePath = hereURL.pathname.replace(/\/+$/, '') || '/'

      sites.forEach((s, i) => {
        const urls = [s.url, ...(Array.isArray(s.aliases) ? s.aliases : [])]
        urls.forEach((u) => {
          try {
            const uURL = new URL(u)
            const uHost = uURL.host.replace(/^www\./, '').toLowerCase()
            if (uHost !== hereHost) return

            const uPath = uURL.pathname.replace(/\/+$/, '') || '/'
            const uPathSlash = uPath.endsWith('/') ? uPath : uPath + '/'

            if (herePath === uPath || (herePath + '/').startsWith(uPathSlash)) {
              if (uPath.length > maxPathLen) {
                maxPathLen = uPath.length
                bestIdx = i
              }
            }
          } catch (e) {}
        })
      })
    } catch (e) {}

    if (bestIdx !== -1) return bestIdx

    try {
      const hereHost = new URL(window.location.href).host.replace(/^www\./, '').toLowerCase()
      const hereSub = hereHost.split('.')[0]
      if (hereSub && hereSub.length > 2) {
        const fallbackIdx = sites.findIndex((s) => {
          const sName = (s.name || '').toLowerCase()
          if (sName && (hereSub === sName || hereSub.startsWith(sName))) return true
          const urls = [s.url, ...(Array.isArray(s.aliases) ? s.aliases : [])]
          return urls.some((u) => {
            try {
              const uHost = new URL(u).host.replace(/^www\./, '').toLowerCase()
              const uSub = uHost.split('.')[0]
              return uSub && (uSub === hereSub || uSub.startsWith(hereSub))
            } catch {
              return false
            }
          })
        })
        if (fallbackIdx !== -1) return fallbackIdx
      }
    } catch (e) {}

    return -1
  }

  // ── Render ─────────────────────────────────────────────────

  function pointTo(a, site, label) {
    a.href = site.url
    a.title = site.name || site.url
    a.setAttribute('aria-label', label + ': ' + (site.name || site.url))
  }

  function render(sites) {
    if (!sites || sites.length === 0) {
      widget.setAttribute('data-state', 'error')
      return
    }

    const idx = findCurrent(sites)
    const len = sites.length
    // Not in the ring yet: arrows lead to the last and first members
    const prevIdx = idx === -1 ? len - 1 : (idx - 1 + len) % len
    const nextIdx = idx === -1 ? 0 : (idx + 1) % len

    pointTo(prevLink, sites[prevIdx], 'Previous site')
    pointTo(nextLink, sites[nextIdx], 'Next site')
    widget.removeAttribute('data-state')
  }

  // ── Fetch & go ─────────────────────────────────────────────

  fetch(FETCH_RING_URL, { cache: 'no-cache', mode: 'cors' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return res.json()
    })
    .then(function (data) {
      // Validate: must be a non-empty array of objects with url
      if (!Array.isArray(data)) throw new Error('Invalid ring data')
      const valid = data.filter(
        (s) => s && typeof s.url === 'string' && s.url.trim() !== ''
      )
      render(valid)
    })
    .catch(function (err) {
      console.warn(
        '[interweb] Could not load ring JSON from',
        FETCH_RING_URL,
        '— check Network tab (CORS or blocked request). Use data-ring with the jsDelivr URL from the interweb README, or ensure your ring file allows cross-origin GET.',
        err
      )
      widget.setAttribute('data-state', 'error')
    })
})()
