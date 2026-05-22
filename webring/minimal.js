/**
 * vaibring — wire prev / random / next on your own markup
 *
 * Put three links (or buttons wrapped in <a>) in your HTML, then load this
 * script after them. It fetches the ring and sets each element's href.
 *
 *   <a data-vaibring="prev" href="#">←</a>
 *   <a data-vaibring="random" href="#">?</a>
 *   <a data-vaibring="next" href="#">→</a>
 *   <script
 *     src="https://v8v88v8v88.github.io/vaibring/webring/minimal.js"
 *     data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/vaibring@main/webring/sites.json"
 *     async
 *   ></script>
 *
 * Optional: data-prev, data-next, data-random (CSS selectors).
 */

;(function () {
  'use strict'

  const SCRIPT = document.currentScript
  if (!SCRIPT) return

  const VAIBRING_RING_CDN =
    'https://cdn.jsdelivr.net/gh/v8v88v8v88/vaibring@main/webring/sites.json'
  const VAIBRING_RING_PAGES_LEGACY =
    'https://v8v88v8v88.github.io/vaibring/webring/sites.json'

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

  const SEL_PREV = SCRIPT.getAttribute('data-prev') || '[data-vaibring="prev"]'
  const SEL_NEXT = SCRIPT.getAttribute('data-next') || '[data-vaibring="next"]'
  const SEL_RANDOM =
    SCRIPT.getAttribute('data-random') || '[data-vaibring="random"]'

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

  function entryNorms(s) {
    var norms = [normalise(s.url)]
    if (Array.isArray(s.aliases)) {
      s.aliases.forEach(function (a) {
        if (typeof a === 'string' && a.trim()) norms.push(normalise(a.trim()))
      })
    }
    return norms
  }

  function findCurrent(sites) {
    const here = normalise(window.location.href)
    let idx = sites.findIndex(function (s) {
      return entryNorms(s).indexOf(here) !== -1
    })
    if (idx !== -1) return idx

    let bestIdx = -1
    let maxPathLen = -1

    try {
      const hereURL = new URL(window.location.href)
      const hereHost = hereURL.host.replace(/^www\./, '').toLowerCase()
      const herePath = hereURL.pathname.replace(/\/+$/, '') || '/'

      sites.forEach(function (s, i) {
        const urls = [s.url].concat(Array.isArray(s.aliases) ? s.aliases : [])
        urls.forEach(function (u) {
          try {
            const uURL = new URL(u)
            const uHost = uURL.host.replace(/^www\./, '').toLowerCase()
            if (uHost !== hereHost) return

            const uPath = uURL.pathname.replace(/\/+$/, '') || '/'
            const uPathSlash = uPath.length > 0 && uPath[uPath.length - 1] === '/' ? uPath : uPath + '/'

            if (herePath === uPath || (herePath + '/').indexOf(uPathSlash) === 0) {
              if (uPath.length > maxPathLen) {
                maxPathLen = uPath.length
                bestIdx = i
              }
            }
          } catch (e) {}
        })
      })
    } catch (e) {}

    return bestIdx
  }

  function randomIndex(len, exclude) {
    if (len <= 1) return 0
    let r
    do {
      r = Math.floor(Math.random() * len)
    } while (r === exclude)
    return r
  }

  function setLink(el, href, title) {
    if (!el) return
    el.setAttribute('href', href)
    el.setAttribute('rel', 'noopener')
    if (title) el.setAttribute('title', title)
  }

  function guardPlaceholderNav(e) {
    var h = e.currentTarget.getAttribute('href')
    if (!h || h === '#') e.preventDefault()
  }

  function attachPlaceholderGuards() {
    ;[SEL_PREV, SEL_NEXT, SEL_RANDOM].forEach(function (sel) {
      var el = document.querySelector(sel)
      if (el) el.addEventListener('click', guardPlaceholderNav)
    })
  }

  function apply(sites) {
    const prevEl = document.querySelector(SEL_PREV)
    const nextEl = document.querySelector(SEL_NEXT)
    const randEl = document.querySelector(SEL_RANDOM)

    if (!prevEl && !nextEl && !randEl) {
      console.warn(
        '[vaibring] minimal.js: no elements matched. Use data-vaibring="prev|next|random" or data-prev / data-next / data-random.'
      )
      return
    }

    if (!sites || sites.length === 0) return

    const idx = findCurrent(sites)
    const len = sites.length

    let prevIdx
    let nextIdx
    let randIdx

    if (idx === -1) {
      prevIdx = 0
      nextIdx = len > 1 ? 1 : 0
      randIdx = randomIndex(len, -1)
    } else {
      prevIdx = (idx - 1 + len) % len
      nextIdx = (idx + 1) % len
      randIdx = randomIndex(len, idx)
    }

    setLink(prevEl, sites[prevIdx].url, sites[prevIdx].name)
    setLink(nextEl, sites[nextIdx].url, sites[nextIdx].name)
    setLink(randEl, sites[randIdx].url, 'Visit a random site')
  }

  function run() {
    attachPlaceholderGuards()
    fetch(FETCH_RING_URL, { cache: 'no-cache', mode: 'cors' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Invalid ring data')
        const valid = data.filter(
          (s) => s && typeof s.url === 'string' && s.url.trim() !== ''
        )
        apply(valid)
      })
      .catch(function (err) {
        console.warn(
          '[vaibring] minimal.js could not load ring JSON from',
          FETCH_RING_URL,
          '— prev/next/random links stay as #. Use data-ring with the jsDelivr sites.json URL (see vaibring README); GitHub Pages JSON is often blocked by CORS for cross-origin fetch.',
          err
        )
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    run()
  }
})()
