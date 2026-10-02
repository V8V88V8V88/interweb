# Interweb

A small webring for sites with real ball knowledge: good design, honest pages, no filler. PRs welcome; [Vaibhav](https://github.com/v8v88v8v88) curates what lands in the ring.

**[→ interweb hub](https://v8v88v8v88.com/interweb)**

---

## What is this?

[Webrings](https://en.wikipedia.org/wiki/Webring) were a way for small websites to link to each other in a loop, helping visitors discover new sites. They were everywhere in the 90s, then disappeared when search engines and social media took over.

interweb brings the idea back as a tight, curated loop:

- **No backend.** The ring is a single JSON file served from GitHub Pages.
- **No build step.** The widget is vanilla JS + CSS. Drop in one `<script>` tag.
- **No dependencies.** Zero npm packages. Zero frameworks.
- **Curated.** Anyone can open a PR; the maintainer merges sites that fit the ring.

## Quick start

### 1. Add the widget to your site

```html
<script
  src="https://v8v88v8v88.com/interweb/webring/widget.js"
  data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"
  async
></script>
```

That’s it. The widget renders inline and shows **← prev | random | next →** navigation.

### Ring JSON URL (`data-ring`)

Browsers block cross-origin `fetch()` unless the server sends CORS headers. **GitHub Pages does not add CORS** to static JSON, so embeds on other domains (or `localhost`) would fail if `data-ring` pointed only at `github.io/.../sites.json`.

**Canonical URL:** use jsDelivr (same file as in the repo, CORS-friendly):

`https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json`

You do **not** need to copy `sites.json` to your own host. Omit `data-ring` and the scripts default to that URL.

If you still use the old `https://v8v88v8v88.github.io/interweb/webring/sites.json` value for `data-ring`, the scripts **automatically** fetch that same list via jsDelivr so existing embeds keep working cross-origin.

**Forks:** `https://cdn.jsdelivr.net/gh/YOUR_USER/YOUR_REPO@main/webring/sites.json`

### 2. Join the ring

1. Add the widget or `minimal.js` navigation to your live site (step 1 above).
2. Fill out the **[join form](https://github.com/v8v88v8v88/interweb/issues/new?template=join.yml)** with your site name, URL and a short description.
3. A bot opens your site in a headless browser, checks the ring links work, and replies on your request. If something is missing it tells you what; fix it, then edit the issue or comment `/recheck`.
4. When the check passes, the bot opens a pull request with your entry. Merges are reviewed; not every submission is accepted.
5. After the pull request is merged, your site is live in the ring within a few minutes.

**Prefer a pull request?** Fork the repo, append your entry to `webring/sites.json`, and open a PR:

```json
{
  "name": "your site",
  "url": "https://yoursite.com",
  "description": "a short description"
}
```

CI validates the file and runs the same live check on new entries.

## Widget look

The widget is a small pill: **← interweb →**. By default it takes your page's text colour and font, so it fits light and dark sites (and theme toggles) without any setup.

| Theme  | Attribute             | Look                                      |
| ------ | --------------------- | ----------------------------------------- |
| Auto   | *(omit `data-theme`)* | Follows your page's text colour and font  |
| Light  | `data-theme="light"`  | Dark text on a faint grey pill            |
| Dark   | `data-theme="dark"`   | White text on a faint light pill          |

The old `data-theme="retro"` still works and shows the dark look.

## Widget options

| Attribute      | Required | Default      | Description                          |
| -------------- | -------- | ------------ | ------------------------------------ |
| `src`          | ✓        | -            | URL to `widget.js`                   |
| `data-ring`    |          | *(canonical jsDelivr URL)* | URL to `sites.json` (must allow CORS; see above) |
| `data-theme`   |          | *(auto)*     | `"light"` or `"dark"`                |
| `data-label`   |          | `"interweb"` | Custom ring name in the widget       |
| `data-hub`     |          | *(auto)*     | URL the ring name links to           |

### Custom links

Use `minimal.js` instead of the widget when you want your own HTML/CSS. Add three `<a>` tags with `data-interweb="prev"`, `"random"`, `"next"`, then load the script after them. It fills `href` from `sites.json` (same logic as `widget.js`). Optional: `data-prev`, `data-next`, `data-random` on the script for custom CSS selectors.

```html
<a data-interweb="prev" href="#">←</a>
<a data-interweb="random" href="#">random</a>
<a data-interweb="next" href="#">→</a>
<script
  src="https://v8v88v8v88.com/interweb/webring/minimal.js"
  data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"
  async
></script>
```

### Troubleshooting

- **Links stay `#` or jump to the top of the page** — `minimal.js` / `widget.js` never set `href` because `fetch()` failed. Open DevTools → Network: if `sites.json` is red/blocked, fix `data-ring` (use the jsDelivr URL above). For third-party ring files, the host must send `Access-Control-Allow-Origin` on GET.
- **Widget shows “ring unavailable”** — same fetch failure or invalid JSON.
- **Old script `src` on `v8v88v8v88.github.io/interweb/...` still works** — it redirects to `v8v88v8v88.com/interweb/...`. Switching to the `v8v88v8v88.com` URL just skips that redirect. Only the JSON request is subject to CORS; loading `widget.js` / `minimal.js` via `<script src>` is not the problem.

## Project structure

```
interweb/
├── index.html                  # Hub landing page (GitHub Pages root)
├── webring/
│   ├── sites.json              # The ring registry
│   ├── widget.js               # Embeddable widget script
│   ├── minimal.js              # Same ring logic, only sets your link hrefs
│   └── widget.css              # Widget styles (auto-loaded by widget.js)
├── scripts/
│   ├── validate.js             # CI validation for sites.json
│   ├── check-site.js           # Live check: ring navigation works on a site
│   └── join-request.js         # Join bot: issue form → checks → PR
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── join.yml            # "Join the ring" form
│   ├── workflows/
│   │   ├── validate.yml        # PR validation workflow
│   │   ├── join.yml            # Join bot workflow
│   │   └── deploy.yml          # GitHub Pages deployment + jsDelivr purge
│   └── PULL_REQUEST_TEMPLATE.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## How it works

1. **Registry** - `webring/sites.json` is a flat JSON array of `{ name, url, description }` objects. The order defines the ring.

2. **Widget or minimal** - `widget.js` and `minimal.js` are self-contained IIFEs. They `fetch()` the ring JSON from `data-ring` (default: jsDelivr CDN URL so CORS works from any origin), match the current page URL against the ring, and resolve prev / random / next as a circular loop. The widget injects CSS and UI; `minimal.js` only updates `href` on elements you mark up yourself.

3. **Hub** - `index.html` is the landing page showing the full directory, widget demos, embed instructions, and join flow. Supports light and dark mode.

4. **Validation** - On every PR touching `sites.json`, CI runs `scripts/validate.js` which checks JSON validity, required fields, HTTPS, duplicates, unsafe URL characters, and field lengths. `scripts/check-site.js` then opens each newly added site in headless Chrome and checks the ring navigation actually works.

5. **Join bot** - An issue from the join form runs `scripts/join-request.js` (`.github/workflows/join.yml`): validation, the live site check, a reply on the issue, and a pull request when everything passes. The maintainer merges.

6. **Deployment** - Push to `main` triggers GitHub Pages deployment of the entire repo, then purges the jsDelivr cache so ring changes show up right away.

## Edge cases handled

- **Site not in ring** - Widget still renders with navigation to ring members
- **Single-site ring** - Prev/next point to the same site; random works
- **Empty ring** - Shows "ring is empty" message
- **Fetch failure** - Shows "ring unavailable" (widget) or leaves `#` hrefs (minimal); usually CORS or bad `data-ring` URL
- **URL normalization** - Strips `www.`, trailing slashes, and protocol for matching

## Self-hosting

You can fork interweb and run your own ring. Update in both `widget.js` and `minimal.js`:

- `VAIBRING_RING_CDN` — your jsDelivr URL: `https://cdn.jsdelivr.net/gh/USER/REPO@main/webring/sites.json`
- `VAIBRING_RING_PAGES_LEGACY` — optional `github.io` URL for automatic rewrite to the CDN (same as upstream)

Also update embed examples in `index.html`, `README.md`, and `CONTRIBUTING.md`.

Everything runs as static files — deploy anywhere (GitHub Pages, Netlify, Cloudflare Pages, etc).

**GitHub Pages cannot set custom CORS headers** on static JSON; jsDelivr remains the simplest cross-origin-friendly default for `sites.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

**Note:** Curated collection, not an open directory.

## License

[GPLv3](LICENSE)

---

*A curated corner of the indie web. Maintained by [Vaibhav](https://github.com/v8v88v8v88).*
