# Contributing to interweb

interweb is a curated webring for solid personal sites and indie pages. Anyone can submit a PR; merges are at the curator’s discretion ([Vaibhav](https://github.com/v8v88v8v88)).

## Adding your site

1. **Fork** this repository on GitHub.
2. **Edit** `webring/sites.json` in your fork and append an entry for your site:

   ```json
   {
     "name": "your site name",
     "url": "https://yoursite.com",
     "description": "optional short description"
   }
   ```

3. **Add webring navigation** on your public site before opening the pull request: either embed the **widget** or use **minimal.js** with your own markup (see `webring/minimal.js` and [README.md](README.md#custom-links)).

   ```html
   <script
     src="https://v8v88v8v88.github.io/interweb/webring/widget.js"
     data-ring="https://cdn.jsdelivr.net/gh/v8v88v8v88/interweb@main/webring/sites.json"
     data-theme="retro"
     async
   ></script>
   ```

   Use that `data-ring` URL (jsDelivr) so `fetch()` works from any origin; you do not need to host a copy of `sites.json` yourself.

4. **Open a pull request** against the upstream repository. Continuous integration validates `sites.json` and related checks.
5. **After merge**, your site is included in the ring.

## Will my site get accepted?

This isn't a free-for-all directory. The curator merges sites that fit. Sites that tend to do well:

- Personal sites, blogs, and portfolios of friends or like-minded people
- Indie projects and hacker-style pages
- Sites that show personality and original thinking

Things that won't make it:

- Commercial products, SEO farms, or spam
- Generic template sites with no personality
- Sites that don't feel aligned with the ring's vibe

## Rules

- Your site must use **HTTPS**.
- Keep your description short (under 200 characters).
- One site per person (unless you have genuinely distinct sites).
- You must add ring navigation (the widget **or** `minimal.js` with prev / random / next links).

## Widget options

| Attribute      | Default      | Description                       |
| -------------- | ------------ | --------------------------------- |
| `data-ring`    | *(default: canonical jsDelivr URL)* | URL to `sites.json` (must allow CORS; see README) |
| `data-theme`   | *(none)*     | `"retro"`, `"dark"`, or omit for light |
| `data-label`   | `"interweb"` | Custom label shown in the widget  |
| `data-hub`     | *(auto)*     | Link for the ring name            |

**minimal.js** — same `data-ring` as the widget. Mark elements with `data-interweb="prev"`, `"random"`, `"next"`, or pass `data-prev` / `data-next` / `data-random` (CSS selectors). See the main README.

## Reporting issues

Open an issue if:
- A site in the ring is broken, dead, or inappropriate
- You found a bug in the widget
- You have an idea for improvement

## Code changes

For changes to the widget, landing page, or tooling:
1. Fork and create a feature branch
2. Make your changes
3. Test locally (just open `index.html` in a browser)
4. Open a PR with a clear description

No build steps required. Everything is vanilla HTML/CSS/JS.
