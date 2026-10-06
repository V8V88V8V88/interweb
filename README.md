<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
    <img src="assets/logo-light.svg" alt="interweb" width="280">
  </picture>
</p>

<p align="center">Personal websites, linked in a ring.</p>

<p align="center">
  <a href="https://v8v88v8v88.com/interweb">Visit the ring</a> ·
  <a href="https://github.com/v8v88v8v88/interweb/issues/new?template=join.yml">Join</a>
</p>

## About

Before search engines and feeds took over, people found new sites through webrings. Each site linked to the next one, and you could follow the links all the way around the circle.

interweb brings that idea back, but it isn't a retro thing. Your site can look modern or old-school. It just has to be a personal site with some personality, so we don't add company pages, products, or templates with no life.

## Add it to your site

```html
<script src="https://v8v88v8v88.com/interweb/webring/widget.js" async></script>
```

This adds a small `← interweb →` pill that takes your page's colours and font. Add `data-theme="dark"` or `"light"` to force one look.

Want your own links instead? Mark them up and load `minimal.js`:

```html
<a data-interweb="prev" href="#">←</a>
<a data-interweb="random" href="#">random</a>
<a data-interweb="next" href="#">→</a>
<script src="https://v8v88v8v88.com/interweb/webring/minimal.js" async></script>
```

## Join

Add the widget or your own links to your site, then fill out the [join form](https://github.com/v8v88v8v88/interweb/issues/new?template=join.yml). A bot checks that the links work and opens a pull request. We look at every site before adding it.

## License

[GPL-3.0](LICENSE)
