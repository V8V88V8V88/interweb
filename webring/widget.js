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
    svg.setAttribute('viewBox', '0 0 1200 1200')
    svg.setAttribute('width', '14')
    svg.setAttribute('height', '14')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'display:inline-block;vertical-align:-2px;margin-right:4px;fill:currentColor;'
    svg.innerHTML = "<g transform="translate(0,1200) scale(0.1,-0.1)"><path d="M4052 10592 c-19 -17 -33 -44 -38 -67 -7 -41 -18 -11 170 -468 39
-93 63 -165 59 -175 -4 -9 -35 -69 -71 -132 -234 -417 -499 -768 -826 -1096
-328 -327 -679 -592 -1100 -828 l-138 -78 -62 25 c-355 149 -527 217 -546 217
-46 0 -92 -32 -112 -78 -19 -42 -19 -46 -3 -88 9 -25 27 -51 39 -59 19 -13
231 -103 498 -211 l87 -36 25 -81 c90 -291 163 -668 198 -1022 16 -168 16
-662 0 -830 -35 -354 -108 -731 -198 -1022 l-25 -81 -87 -36 c-267 -108 -479
-198 -498 -211 -12 -8 -30 -34 -39 -59 -16 -42 -16 -46 3 -88 20 -46 66 -78
112 -78 19 0 191 68 546 217 l62 25 138 -78 c701 -394 1267 -914 1705 -1564
102 -152 272 -438 292 -492 4 -10 -20 -82 -59 -175 -188 -457 -177 -427 -170
-468 5 -23 19 -50 38 -67 25 -23 39 -28 82 -28 86 0 91 8 227 335 66 159 122
291 123 292 9 9 280 85 396 111 752 171 1463 173 2214 6 133 -30 412 -107 422
-117 1 -1 57 -133 123 -292 136 -327 141 -335 227 -335 43 0 57 5 82 28 19 17
33 44 38 67 7 41 18 12 -170 468 -38 93 -62 165 -59 175 30 79 241 426 367
602 429 600 966 1081 1621 1449 71 41 139 74 150 74 11 0 147 -52 302 -116
155 -64 291 -117 302 -117 12 0 37 7 57 15 43 18 77 85 68 134 -13 62 -45 81
-346 205 -274 113 -288 121 -297 150 -113 377 -177 700 -213 1071 -16 168 -16
662 0 830 36 371 100 693 213 1071 8 28 20 36 127 79 152 62 363 151 430 181
45 20 56 30 73 70 20 44 20 48 4 90 -19 50 -46 72 -97 80 -29 5 -85 -15 -319
-112 -156 -64 -293 -117 -304 -117 -11 0 -79 33 -150 74 -574 323 -1057 731
-1446 1220 -204 257 -319 428 -479 712 l-72 128 65 157 c35 86 90 220 122 298
66 161 68 195 13 246 -25 23 -39 28 -82 28 -86 0 -91 -8 -227 -335 -66 -159
-122 -291 -123 -292 -10 -10 -289 -87 -422 -117 -751 -167 -1462 -165 -2214 6
-116 26 -387 102 -396 111 -1 1 -57 133 -123 292 -136 327 -141 335 -227 335
-43 0 -57 -5 -82 -28z m633 -921 c281 -77 665 -138 1025 -162 186 -12 554 -7
740 11 270 26 640 90 844 145 50 14 91 23 93 22 3 -4 -310 -764 -318 -771 -26
-27 -452 -116 -674 -142 -207 -25 -586 -24 -790 0 -238 28 -652 117 -676 144
-4 5 -269 641 -316 760 -6 15 -11 16 72 -7z m-242 -241 c180 -431 247 -596
247 -613 0 -44 -235 -408 -378 -583 -174 -216 -377 -415 -587 -579 -182 -142
-502 -345 -544 -345 -9 0 -53 15 -97 34 -43 18 -153 64 -244 101 -234 97 -370
153 -404 168 l-30 14 100 58 c728 427 1381 1081 1809 1810 l59 100 17 -40 c9
-22 33 -78 52 -125z m3242 63 c345 -580 803 -1090 1340 -1492 154 -116 333
-236 469 -316 68 -40 94 -60 85 -65 -8 -5 -70 -31 -139 -59 -69 -29 -145 -60
-170 -71 -185 -80 -436 -180 -451 -180 -24 0 -189 96 -344 201 -331 223 -613
491 -866 824 -114 149 -299 448 -299 482 0 17 89 236 245 608 18 44 41 99 50
123 10 23 18 42 20 42 1 0 29 -44 60 -97z m-2152 -963 c413 -53 865 -31 1309
63 l107 23 -15 -35 c-9 -20 -42 -101 -75 -181 -33 -80 -73 -176 -90 -215 -16
-38 -53 -128 -82 -200 -41 -98 -59 -133 -78 -142 -29 -14 -228 -59 -324 -73
-127 -18 -335 -23 -465 -11 -132 13 -384 62 -428 83 -20 10 -37 41 -79 143
-29 72 -66 162 -82 200 -16 39 -58 138 -92 220 -34 83 -68 164 -75 181 l-13
30 160 -32 c88 -18 233 -42 322 -54z m-639 -188 c38 -92 98 -237 134 -322 35
-85 75 -180 87 -212 l23 -56 -35 -64 c-167 -300 -435 -576 -738 -759 -125 -76
-92 -78 -335 23 -118 49 -288 119 -377 156 -90 37 -162 70 -160 74 1 3 70 51
152 107 218 145 397 293 585 481 190 189 338 369 483 588 56 83 104 152 107
152 3 0 36 -76 74 -168z m2393 16 c145 -219 293 -399 483 -588 189 -190 370
-339 585 -482 83 -55 151 -103 152 -106 2 -4 -99 -49 -225 -101 -125 -52 -270
-112 -322 -134 -52 -22 -120 -49 -151 -62 l-56 -22 -39 20 c-77 39 -291 187
-376 262 -160 138 -338 357 -441 543 l-35 64 23 56 c12 32 52 127 87 212 36
85 96 230 134 322 38 93 72 168 75 168 3 0 51 -69 106 -152z m-1617 -834 c212
-34 503 -29 733 12 48 9 91 14 94 10 3 -3 -29 -90 -72 -193 -123 -295 -185
-445 -202 -488 -8 -22 -30 -54 -48 -71 -28 -27 -42 -33 -104 -39 -101 -10
-205 2 -237 28 -15 11 -39 48 -55 82 -37 82 -270 645 -277 669 -5 17 -1 18 34
12 21 -3 82 -13 134 -22z m-252 -444 c83 -204 152 -382 152 -396 0 -65 -188
-254 -252 -254 -25 0 -55 11 -263 97 -66 28 -207 86 -312 129 -106 43 -193 82
-193 85 0 3 30 26 68 52 221 152 465 399 607 615 15 23 30 42 34 42 3 0 75
-167 159 -370z m1364 318 c144 -215 403 -475 615 -615 29 -20 53 -39 53 -42 0
-3 -46 -25 -103 -48 -56 -23 -222 -92 -369 -152 -146 -61 -278 -111 -293 -111
-33 0 -95 43 -161 112 -67 70 -94 111 -94 142 0 27 300 765 311 766 3 0 22
-24 41 -52z m-4371 -47 c52 -21 200 -83 329 -136 129 -54 259 -108 289 -120
36 -15 58 -31 64 -46 23 -62 79 -302 101 -436 44 -265 51 -349 51 -613 0 -264
-7 -348 -51 -613 -22 -134 -78 -374 -101 -436 -6 -15 -28 -31 -64 -46 -30 -12
-160 -66 -289 -120 -389 -161 -423 -175 -426 -172 -2 1 8 45 22 97 60 233 119
580 146 855 17 182 17 688 0 870 -29 305 -106 736 -168 938 -3 9 -4 17 -1 17
2 0 46 -17 98 -39z m7279 36 c0 -1 -9 -34 -19 -72 -60 -216 -125 -590 -153
-880 -16 -169 -16 -702 0 -870 29 -288 86 -624 146 -855 14 -52 24 -95 22 -97
-1 -1 -155 61 -342 138 -186 77 -359 149 -383 158 -52 21 -56 29 -101 215 -36
144 -64 297 -87 471 -23 181 -23 629 0 810 30 230 88 512 129 629 l14 38 264
109 c146 60 317 132 380 159 109 46 130 54 130 47z m-6105 -522 c72 -30 225
-93 340 -141 116 -47 215 -91 222 -96 13 -11 55 -178 80 -323 26 -157 24 -472
-6 -640 -27 -152 -58 -275 -74 -291 -7 -7 -102 -49 -212 -94 -110 -46 -279
-115 -375 -155 -96 -40 -176 -72 -177 -71 -1 1 4 26 12 56 80 309 122 803 96
1140 -17 226 -77 605 -108 686 -5 14 -1 13 33 -1 22 -9 98 -40 169 -70z m5025
48 c-16 -48 -60 -289 -82 -451 -18 -132 -21 -205 -21 -462 0 -257 3 -330 21
-462 22 -162 66 -403 82 -450 6 -19 5 -28 -2 -28 -9 0 -168 64 -425 171 -51
22 -137 57 -190 79 -155 64 -145 55 -170 150 -51 192 -67 323 -67 540 0 217
16 348 67 540 25 95 14 86 172 151 55 23 136 56 180 75 277 115 422 174 432
174 9 0 9 -8 3 -27z m-2610 -408 c52 0 122 4 155 8 l60 8 63 -79 c60 -76 179
-186 223 -206 18 -9 20 -16 15 -50 -15 -98 -18 -237 -7 -317 13 -82 12 -84
-11 -102 -108 -85 -166 -140 -220 -209 l-63 -79 -60 8 c-77 10 -233 10 -310 0
l-60 -8 -68 85 c-39 49 -104 114 -153 153 l-85 68 8 55 c4 30 8 102 8 160 0
58 -4 130 -8 160 l-8 55 85 68 c49 39 114 104 153 153 l68 85 60 -8 c33 -4
103 -8 155 -8z m-1180 -151 c241 -99 364 -155 384 -174 32 -32 45 -82 45 -180
0 -98 -13 -148 -45 -180 -20 -19 -143 -75 -387 -175 -197 -81 -360 -145 -363
-142 -3 2 2 45 10 93 49 288 46 570 -10 872 -4 17 -2 32 2 32 5 0 169 -66 364
-146z m2726 114 c-56 -302 -59 -584 -10 -872 8 -48 13 -91 10 -93 -3 -3 -103
35 -223 85 -120 50 -281 116 -358 147 -158 64 -193 90 -206 156 -22 116 -5
248 37 289 19 18 95 56 214 104 102 41 259 106 350 144 91 39 171 70 179 71
10 1 12 -8 7 -31z m-2173 -920 c91 -61 197 -187 197 -232 0 -27 -300 -765
-311 -766 -3 0 -22 24 -41 53 -137 206 -364 437 -580 590 -49 34 -88 64 -88
67 0 3 87 41 193 84 174 71 335 138 487 201 70 30 104 30 143 3z m1605 -89
c147 -60 313 -129 369 -152 57 -23 103 -45 103 -48 0 -3 -24 -22 -52 -41 -217
-144 -474 -401 -616 -615 -19 -29 -38 -53 -41 -53 -11 1 -311 739 -311 766 0
32 44 95 112 160 74 70 108 93 141 94 16 0 149 -50 295 -111z m-875 -218 c34
-6 57 -17 76 -37 19 -19 76 -145 171 -374 79 -190 145 -354 148 -364 5 -17 1
-18 -34 -12 -332 57 -587 60 -867 10 -48 -9 -91 -14 -94 -11 -5 5 97 258 255
636 47 110 75 142 134 152 60 9 154 9 211 0z m-1738 -170 c304 -183 571 -458
738 -759 l35 -64 -23 -56 c-12 -32 -52 -127 -87 -212 -36 -85 -96 -230 -134
-322 -38 -93 -72 -168 -75 -168 -3 0 -51 69 -106 153 -297 449 -714 854 -1167
1133 l-68 43 33 14 c19 8 95 39 169 70 74 30 232 96 350 145 243 101 210 99
335 23z m3595 -18 c52 -22 197 -82 322 -134 125 -52 227 -97 225 -101 -1 -4
-58 -43 -125 -88 -247 -163 -410 -297 -622 -509 -207 -208 -391 -439 -537
-675 -40 -65 -43 -68 -52 -45 -5 13 -44 107 -86 209 -82 195 -162 387 -200
482 l-23 56 35 64 c130 234 329 463 553 635 63 48 215 145 274 175 32 17 23
20 236 -69z m-4663 -419 c388 -224 735 -521 1030 -885 126 -155 363 -525 363
-566 0 -17 -137 -354 -299 -738 l-17 -40 -59 100 c-428 730 -1080 1382 -1810
1810 l-100 59 40 17 c94 39 222 93 395 164 102 42 214 89 250 105 36 15 75 29
87 29 12 1 66 -24 120 -55z m5734 -24 c107 -45 219 -91 249 -104 30 -13 113
-47 184 -77 142 -59 141 -55 46 -104 -73 -38 -365 -234 -495 -332 -539 -409
-998 -922 -1330 -1488 l-59 -100 -17 40 c-157 370 -299 721 -299 738 0 30 152
281 268 442 169 234 435 512 672 701 179 142 521 362 566 363 11 1 108 -35
215 -79z m-2746 -380 c98 -15 295 -59 324 -73 19 -9 37 -44 78 -142 29 -71 66
-161 82 -200 17 -38 57 -135 90 -215 33 -80 66 -161 75 -180 l15 -36 -132 28
c-547 114 -1061 116 -1606 4 l-160 -32 13 30 c7 17 41 99 75 181 34 83 76 182
92 220 16 39 53 129 82 200 42 102 59 133 79 143 37 18 286 69 393 81 105 11
399 6 500 -9z m80 -1000 c200 -21 492 -78 638 -124 l68 -21 160 -384 c87 -212
157 -386 156 -388 -2 -1 -35 6 -74 17 -365 101 -896 170 -1313 170 -416 0
-940 -68 -1314 -171 -38 -10 -71 -17 -73 -16 -1 2 69 176 156 387 l159 384 39
14 c136 48 475 113 683 131 69 6 141 13 160 15 60 7 450 -3 555 -14z"/></g>"
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
