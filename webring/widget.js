/**
 * interweb — embeddable webring widget
 *
 * Usage:
 *   <script
 *     src="https://v8v88v8v88.github.io/interweb/webring/widget.js"
 *     data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"
 *     data-theme="retro"          <!-- optional: "retro" | "dark" | omit for light -->
 *     data-label="interweb"       <!-- optional: custom ring name -->
 *     async
 *   ></script>
 *
 * The script auto-injects the widget next to the <script> tag.
 * It fetches the ring data, finds the current site, and renders
 * ← prev | random | next → navigation links.
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

  const CSS_ID = 'interweb-css'
  if (!document.getElementById(CSS_ID)) {
    const cssUrl = FETCH_RING_URL.replace(/sites\.json$/i, 'widget.css')
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
  if (THEME) widget.setAttribute('data-theme', THEME)
  widget.setAttribute('data-state', 'loading')
  widget.textContent = '⟳ loading ring…'
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

  /**
   * Get a random index that is NOT the current index.
   */
  function randomIndex(len, exclude) {
    if (len <= 1) return 0
    let r
    do { r = Math.floor(Math.random() * len) } while (r === exclude)
    return r
  }

  /**
   * Create a small globe SVG icon.
   */
  function makeGlobe() {
    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '14')
    svg.setAttribute('height', '14')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'display:inline-block;vertical-align:-2px;margin-right:4px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round'
    svg.innerHTML = '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/>'
    return svg
  }

  /**
   * Create a link element.
   */
  function makeLink(href, text, title) {
    const a = document.createElement('a')
    a.href = href
    a.textContent = text
    if (title) a.title = title
    a.rel = 'noopener'
    return a
  }

  /**
   * Create a label link with globe icon.
   */
  function makeLabelLink(href, text) {
    const a = document.createElement('a')
    a.href = href
    a.appendChild(makeGlobe())
    a.appendChild(document.createTextNode(text))
    a.rel = 'noopener'
    return a
  }

  function makeSep() {
    const span = document.createElement('span')
    span.className = 'interweb-sep'
    span.textContent = '|'
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  // ── Render ─────────────────────────────────────────────────

  function render(sites) {
    widget.textContent = ''
    widget.removeAttribute('data-state')

    if (!sites || sites.length === 0) {
      widget.setAttribute('data-state', 'error')
      widget.textContent = 'ring is empty'
      return
    }

    const idx = findCurrent(sites)
    const len = sites.length

    // If current site not in ring, show a "join" state
    if (idx === -1) {
      const prevIdx = len - 1
      const nextIdx = 0
      const randIdx = randomIndex(len, -1)

      const label = document.createElement('span')
      label.className = 'interweb-label'
      label.appendChild(makeLabelLink(HUB_URL, LABEL))

      widget.appendChild(label)
      widget.appendChild(makeSep())
      widget.appendChild(makeLink(sites[prevIdx].url, '← prev', sites[prevIdx].name))
      widget.appendChild(makeSep())
      widget.appendChild(makeLink(sites[randIdx].url, 'random', 'Visit a random site'))
      widget.appendChild(makeSep())
      widget.appendChild(makeLink(sites[nextIdx].url, 'next →', sites[nextIdx].name))
      return
    }

    const prevIdx = (idx - 1 + len) % len
    const nextIdx = (idx + 1) % len
    const randIdx = randomIndex(len, idx)

    const label = document.createElement('span')
    label.className = 'interweb-label'
    label.appendChild(makeLabelLink(HUB_URL, LABEL))

    widget.appendChild(label)
    widget.appendChild(makeSep())
    widget.appendChild(makeLink(sites[prevIdx].url, '← prev', sites[prevIdx].name))
    widget.appendChild(makeSep())
    widget.appendChild(makeLink(sites[randIdx].url, 'random', 'Visit a random site'))
    widget.appendChild(makeSep())
    widget.appendChild(makeLink(sites[nextIdx].url, 'next →', sites[nextIdx].name))
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
      widget.textContent = 'ring unavailable'
    })
})()
