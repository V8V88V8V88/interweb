#!/usr/bin/env node

/**
 * interweb — live site checker
 *
 * Opens a site in headless Chrome and checks that the ring navigation
 * actually works there (not just that a <script> tag is present):
 *  - the widget rendered (.interweb-widget with real links), or
 *  - minimal.js filled in prev / next links (href is no longer "#").
 *
 * Usage:
 *   node scripts/check-site.js https://example.com
 *   node scripts/check-site.js --new-since base-sites.json   (checks entries added vs a base file)
 *
 * Chrome is looked up from $CHROME, then google-chrome / chromium on PATH.
 * Without Chrome it falls back to the raw HTML, which misses sites that
 * render with JavaScript.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const SITES_PATH = path.join(__dirname, '..', 'webring', 'sites.json')
const FETCH_TIMEOUT_MS = 20000
const RENDER_TIMEOUT_MS = 60000

function findChrome() {
  const candidates = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  for (const c of candidates) {
    if (!c) continue
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore', timeout: 10000 })
      return c
    } catch {}
  }
  return null
}

function renderWithChrome(chrome, url) {
  return execFileSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--virtual-time-budget=15000',
      '--dump-dom',
      url,
    ],
    { encoding: 'utf-8', timeout: RENDER_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
  )
}

/** Parse the attributes of every <a> tag in an HTML string. */
function anchors(html) {
  const out = []
  const tagRe = /<a\b([^>]*)>/gi
  let m
  while ((m = tagRe.exec(html))) {
    const attrs = {}
    const attrRe = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    let a
    while ((a = attrRe.exec(m[1]))) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? ''
    }
    out.push(attrs)
  }
  return out
}

const isRealLink = (href) => typeof href === 'string' && /^https?:\/\//i.test(href.trim())

/** Look for working ring navigation in rendered HTML. */
function findRingNav(html) {
  const found = []

  // widget.js: injects <div class="interweb-widget"> with prev / random / next links
  const widgetRe = /<div\b[^>]*class="[^"]*\binterweb-widget\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  let w
  while ((w = widgetRe.exec(html))) {
    if (/data-state="error"/i.test(w[0])) continue
    const links = anchors(w[1]).filter((a) => isRealLink(a.href))
    if (links.length >= 3) found.push('widget.js')
  }

  // minimal.js: fills in href on data-interweb="prev|next|random"
  const marked = anchors(html).filter((a) => a['data-interweb'])
  const prev = marked.find((a) => a['data-interweb'] === 'prev')
  const next = marked.find((a) => a['data-interweb'] === 'next')
  if (prev && next && isRealLink(prev.href) && isRealLink(next.href)) found.push('minimal.js')

  const scriptTag = /<script\b[^>]*src="[^"]*\/webring\/(widget|minimal)\.js[^"]*"/i.test(html)
  const placeholderOnly = marked.length > 0 && !found.includes('minimal.js')

  return { found: [...new Set(found)], scriptTag, placeholderOnly }
}

async function checkSite(url, chrome) {
  const result = { url, ok: false, reachable: false, status: null, method: null, found: [], problems: [] }

  let rawHtml
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'interweb-ring-check (+https://github.com/v8v88v8v88/interweb)' },
    })
    result.status = res.status
    result.reachable = res.ok
    if (!res.ok) {
      result.problems.push(`The site answered with HTTP ${res.status}.`)
      return result
    }
    rawHtml = await res.text()
  } catch (e) {
    result.problems.push(`Could not reach the site (${e.cause?.code || e.name || e.message}).`)
    return result
  }

  let html = rawHtml
  result.method = 'raw HTML'
  if (chrome) {
    let rendered = null
    for (let attempt = 1; attempt <= 2 && rendered === null; attempt++) {
      try {
        rendered = renderWithChrome(chrome, url)
      } catch (e) {
        console.error(`[check-site] Chrome render attempt ${attempt} failed for ${url}: ${e.signal || e.status || e.message}`)
      }
    }
    if (rendered !== null) {
      html = rendered
      result.method = 'headless Chrome'
    } else {
      result.problems.push('Headless Chrome could not render the page; checked the raw HTML instead.')
    }
  }

  const nav = findRingNav(html)
  result.found = nav.found
  result.ok = nav.found.length > 0

  if (!result.ok) {
    if (nav.placeholderOnly) {
      result.problems.push(
        'Found `data-interweb` links, but they still point to `#`, so `minimal.js` did not load or could not fetch the ring. Check the script `src` and `data-ring` URLs.'
      )
    } else if (nav.scriptTag) {
      result.problems.push('Found an interweb script tag, but the ring navigation did not render.')
    } else {
      result.problems.push('No interweb ring navigation found on the page.')
    }
  }
  return result
}

function newUrlsSince(basePath) {
  const base = JSON.parse(fs.readFileSync(basePath, 'utf-8'))
  const current = JSON.parse(fs.readFileSync(SITES_PATH, 'utf-8'))
  const baseUrls = new Set(base.map((s) => s && s.url))
  return current.filter((s) => s && typeof s.url === 'string' && !baseUrls.has(s.url)).map((s) => s.url)
}

module.exports = { checkSite, findChrome, findRingNav }

if (require.main === module) {
  ;(async () => {
    const args = process.argv.slice(2)
    let urls
    if (args[0] === '--new-since') {
      urls = newUrlsSince(args[1])
      if (urls.length === 0) {
        console.log('No new sites to check.')
        return
      }
    } else if (args.length) {
      urls = args
    } else {
      console.error('Usage: node scripts/check-site.js <url>... | --new-since <base-sites.json>')
      process.exit(2)
    }

    const chrome = findChrome()
    if (!chrome) console.log('⚠ Chrome not found; checking raw HTML only.')

    let failed = 0
    for (const url of urls) {
      const r = await checkSite(url, chrome)
      if (r.ok) {
        console.log(`✓ ${url} — ${r.found.join(' + ')} working (${r.method})`)
      } else {
        failed++
        console.log(`✗ ${url}`)
        r.problems.forEach((p) => console.log(`    ${p}`))
      }
    }
    process.exit(failed ? 1 : 0)
  })()
}
