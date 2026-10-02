#!/usr/bin/env node

/**
 * interweb — join request bot
 *
 * Runs in CI on join issues (opened from .github/ISSUE_TEMPLATE/join.yml).
 *  1. Reads name / URL / description from the issue form.
 *  2. Validates the would-be sites.json with scripts/validate.js.
 *  3. Opens the site in headless Chrome to confirm the ring navigation works.
 *  4. If everything passes, appends the entry to webring/sites.json
 *     (the workflow then opens a pull request for the maintainer to merge).
 *
 * Input:  ISSUE_BODY (env)
 * Output: comment markdown at $JOIN_COMMENT_FILE, and ok / name in $GITHUB_OUTPUT.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { checkSite, findChrome } = require('./check-site')

const SITES_PATH = path.join(__dirname, '..', 'webring', 'sites.json')
const VALIDATE = path.join(__dirname, 'validate.js')
const COMMENT_FILE = process.env.JOIN_COMMENT_FILE || path.join(os.tmpdir(), 'join-comment.md')

const EMBED = [
  '```html',
  '<script',
  '  src="https://v8v88v8v88.com/interweb/webring/widget.js"',
  '  data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"',
  '  data-theme="retro"',
  '  async',
  '></script>',
  '```',
].join('\n')

/** Read "### Label\n\nvalue" sections from an issue form body. */
function parseForm(body) {
  const fields = {}
  const parts = String(body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    const label = (nl === -1 ? part : part.slice(0, nl)).trim()
    let value = nl === -1 ? '' : part.slice(nl + 1).trim()
    if (value === '_No response_') value = ''
    fields[label] = value
  }
  return fields
}

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim()

function buildEntry(fields) {
  const entry = {
    name: oneLine(fields['Site name']),
    url: oneLine(fields['Site URL']).replace(/^<|>$/g, ''),
  }
  // https://example.com/ and https://example.com/blog/ → no trailing slash
  entry.url = entry.url.replace(/\/+$/, '')
  const description = oneLine(fields['Description'])
  if (description) entry.description = description
  return entry
}

/** Append an entry in the same layout as the hand-written file. */
function appendEntry(raw, entry) {
  const end = raw.lastIndexOf(']')
  const before = raw.slice(0, end).replace(/\s*$/, '')
  const block = JSON.stringify(entry, null, 2).replace(/^/gm, '  ')
  return `${before},\n\n${block}\n]\n`
}

function validate(file) {
  try {
    const out = execFileSync(process.execPath, [VALIDATE, file], { encoding: 'utf-8' })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: String(e.stdout || e.message) }
  }
}

function setOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${oneLine(value)}\n`)
}

function finish(ok, lines, entry) {
  fs.writeFileSync(COMMENT_FILE, lines.join('\n') + '\n')
  setOutput('ok', ok ? 'true' : 'false')
  setOutput('name', entry && entry.name ? entry.name : '')
  console.log(lines.join('\n'))
}

;(async () => {
  const fields = parseForm(process.env.ISSUE_BODY)
  const entry = buildEntry(fields)
  const header = '<!-- interweb-join-bot -->\n### interweb join check'
  const retry = '_Fix the issue above, then edit this issue or comment `/recheck` to run the check again._'

  if (!entry.name || !entry.url) {
    return finish(false, [header, '', '❌ The form is missing the site name or URL.', '', retry], entry)
  }

  // 1. Validate the list as it would look with this site added
  const raw = fs.readFileSync(SITES_PATH, 'utf-8')
  const candidate = appendEntry(raw, entry)
  const tmp = path.join(os.tmpdir(), `sites-candidate-${process.pid}.json`)
  fs.writeFileSync(tmp, candidate)
  const v = validate(tmp)
  fs.unlinkSync(tmp)
  if (!v.ok) {
    const errors = v.out.split('\n').filter((l) => l.startsWith('✗')).map((l) => '- ' + l.replace(/^✗\s*\[\d+\]\s*/, ''))
    return finish(false, [header, '', '❌ The entry did not pass validation:', '', ...errors, '', retry], entry)
  }

  // 2. Check the live site
  const r = await checkSite(entry.url, findChrome())
  const entryBlock = ['```json', JSON.stringify(entry, null, 2), '```']

  if (!r.ok) {
    return finish(
      false,
      [
        header,
        '',
        `❌ **${entry.url}** is not ready yet.`,
        '',
        ...r.problems.map((p) => '- ' + p),
        '',
        'Add the ring navigation to your live site, for example:',
        '',
        EMBED,
        '',
        'Or use your own links with `minimal.js` (see the [README](https://github.com/v8v88v8v88/interweb#custom-links)).',
        '',
        retry,
      ],
      entry
    )
  }

  // 3. All good: write the new list for the pull request
  fs.writeFileSync(SITES_PATH, candidate)
  finish(
    true,
    [
      header,
      '',
      `✅ **${entry.url}** passed: ${r.found.join(' + ')} is working on the live site.`,
      '',
      ...entryBlock,
      '',
      'A pull request with this entry is ready for the maintainer to review. Membership is curated, so not every request is merged.',
    ],
    entry
  )
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
