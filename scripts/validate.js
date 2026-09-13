#!/usr/bin/env node

/**
 * interweb — sites.json validator
 *
 * Runs in CI on every PR that touches webring/sites.json.
 * Checks:
 *  1. Valid JSON
 *  2. Top-level array
 *  3. Each entry has required fields (name, url)
 *  4. URLs are valid and use HTTPS
 *  5. No duplicate URLs
 *  6. No duplicate names
 *  7. Reasonable field lengths
 *  8. No trailing slashes on URLs (consistency)
 */

const fs = require('fs')
const path = require('path')

const SITES_PATH = path.join(__dirname, '..', 'webring', 'sites.json')
const MAX_NAME_LEN = 80
const MAX_DESC_LEN = 200
const MAX_URL_LEN = 300

let exitCode = 0
const errors = []
const warnings = []

function error(msg) {
  errors.push(msg)
  exitCode = 1
}

function warn(msg) {
  warnings.push(msg)
}

// ── Read & parse ──────────────────────────────────

let raw
try {
  raw = fs.readFileSync(SITES_PATH, 'utf-8')
} catch (e) {
  console.error(`✗ Cannot read ${SITES_PATH}: ${e.message}`)
  process.exit(1)
}

let sites
try {
  sites = JSON.parse(raw)
} catch (e) {
  console.error(`✗ Invalid JSON: ${e.message}`)
  process.exit(1)
}

// ── Validate structure ────────────────────────────

if (!Array.isArray(sites)) {
  console.error('✗ sites.json must be a JSON array')
  process.exit(1)
}

if (sites.length === 0) {
  error('Ring is empty — at least one site is required')
}

// ── Validate each entry ───────────────────────────

const seenUrls = new Set()
const seenNames = new Set()

sites.forEach((site, i) => {
  const prefix = `[${i}]`

  if (!site || typeof site !== 'object' || Array.isArray(site)) {
    error(`${prefix} Entry is not a valid object`)
    return
  }

  // name
  if (typeof site.name !== 'string' || site.name.trim() === '') {
    error(`${prefix} Missing or empty "name"`)
  } else if (site.name.length > MAX_NAME_LEN) {
    error(`${prefix} "name" exceeds ${MAX_NAME_LEN} characters`)
  } else {
    const normName = site.name.trim().toLowerCase()
    if (seenNames.has(normName)) {
      error(`${prefix} Duplicate name: "${site.name}"`)
    }
    seenNames.add(normName)
  }

  // url
  if (typeof site.url !== 'string' || site.url.trim() === '') {
    error(`${prefix} Missing or empty "url"`)
  } else {
    let parsed
    try {
      parsed = new URL(site.url)
    } catch {
      error(`${prefix} Invalid URL: "${site.url}"`)
      return
    }

    if (parsed.protocol !== 'https:') {
      error(`${prefix} URL must use HTTPS: "${site.url}"`)
    }

    if (site.url.length > MAX_URL_LEN) {
      error(`${prefix} URL exceeds ${MAX_URL_LEN} characters`)
    }

    if (site.url.endsWith('/') && parsed.pathname !== '/') {
      warn(`${prefix} Consider removing trailing slash from URL: "${site.url}"`)
    }

    const normUrl = parsed.host.replace(/^www\./, '') + parsed.pathname.replace(/\/+$/, '')
    if (seenUrls.has(normUrl)) {
      error(`${prefix} Duplicate URL: "${site.url}"`)
    }
    seenUrls.add(normUrl)
  }

  // aliases (optional) — same site on another URL (e.g. github.io vs custom domain)
  if (site.aliases !== undefined) {
    if (!Array.isArray(site.aliases)) {
      error(`${prefix} "aliases" must be an array`)
    } else {
      site.aliases.forEach((alias, j) => {
        if (typeof alias !== 'string' || alias.trim() === '') {
          error(`${prefix} aliases[${j}] must be a non-empty string`)
          return
        }
        let ap
        try {
          ap = new URL(alias)
        } catch {
          error(`${prefix} Invalid alias URL: "${alias}"`)
          return
        }
        if (ap.protocol !== 'https:') {
          error(`${prefix} Alias must use HTTPS: "${alias}"`)
        }
        const normAlias = ap.host.replace(/^www\./, '') + ap.pathname.replace(/\/+$/, '')
        if (seenUrls.has(normAlias)) {
          error(`${prefix} Duplicate URL (alias matches another entry): "${alias}"`)
        }
        seenUrls.add(normAlias)
      })
    }
  }

  // description (optional)
  if (site.description !== undefined) {
    if (typeof site.description !== 'string') {
      error(`${prefix} "description" must be a string`)
    } else if (site.description.length > MAX_DESC_LEN) {
      warn(`${prefix} "description" exceeds ${MAX_DESC_LEN} characters (consider shortening)`)
    }
  }

  // Warn about unknown fields
  const knownFields = new Set(['name', 'url', 'description', 'aliases'])
  Object.keys(site).forEach((key) => {
    if (!knownFields.has(key)) {
      warn(`${prefix} Unknown field: "${key}" (will be ignored)`)
    }
  })
})

// ── Report ────────────────────────────────────────

console.log('')
console.log(`interweb validator — ${sites.length} site(s)`)
console.log('─'.repeat(40))

if (warnings.length > 0) {
  warnings.forEach((w) => console.log(`⚠ ${w}`))
  console.log('')
}

if (errors.length > 0) {
  errors.forEach((e) => console.log(`✗ ${e}`))
  console.log('')
  console.log(`Validation failed with ${errors.length} error(s).`)
} else {
  console.log('✓ All checks passed.')
}

console.log('')
process.exit(exitCode)
