# Custom domain: radio.hectolitre.space

The site is served by GitHub Pages from this repository's `main` branch, at
**https://radio.hectolitre.space/**. The `CNAME` file at the repo root names
the domain GitHub Pages serves; every absolute URL in the site (canonical
tags, Open Graph, sitemap, RSS feed, playlist, QR codes) uses it.

Page-to-page links and assets are relative, so nothing else depends on the
host. The one root-absolute path is the favicon set in `404.html` (along with
its other asset and page links), which assumes the custom-domain root.

## Previous addresses

| Address                         | Status |
|---------------------------------|--------|
| `daqhris.com/radio-hectolitre/` | First home of the site. GitHub Pages is expected to redirect project URLs to the current custom domain; test a few. |
| `radio.hectolitre.be`           | Replaced by `radio.hectolitre.space`. |

GitHub Pages accepts one custom domain per site, so it does not redirect
`radio.hectolitre.be` by itself. While `hectolitre.be` remains under the
project's control, set up an HTTP(S) redirect at the DNS or web host that
**keeps the path**, so that shared links, printed QR codes and podcast-app
subscriptions still arrive. The redirect needs its own TLS certificate for
`https://` links to work. If the old domain can't redirect, reprint QR codes,
re-share links and update the feed URL in each podcast directory.

Feed items use fixed `guid` values that don't contain the domain, so apps that
follow the feed to its new address should not list old episodes as new.

## Setting up the domain

1. **DNS (zone of `hectolitre.space`)**: one record

   | Type  | Subdomain | Target               | TTL  |
   |-------|-----------|----------------------|------|
   | CNAME | `radio`   | `daqhris.github.io.` | 3600 |

   The target is the GitHub *account* host (`<user>.github.io`), never the
   repository path. No A/AAAA records are needed for a subdomain. Check it with
   `dig radio.hectolitre.space +short` (should show `daqhris.github.io.` then
   GitHub's IPs).
2. **Optional but recommended, verify the domain** (GitHub → account Settings →
   Pages → Add a domain): add the TXT record GitHub gives you. It stops anyone
   else from claiming the subdomain if the CNAME is ever left dangling.
3. **GitHub → this repo → Settings → Pages → Custom domain**: enter
   `radio.hectolitre.space` and save. GitHub checks DNS, then issues a
   certificate. Tick **Enforce HTTPS** once it is available. If
   `hectolitre.space` has CAA records, they must allow `letsencrypt.org`.
4. **Check**: open the site, play a recording, load `feed.xml`, and paste the
   homepage into a link-preview debugger (see `docs/social-previews.md`).
   Re-scrape cached previews where needed.

## After changing the domain again

Edit `social.siteUrl` and the ticker text in `data/site.json`,
`SITE_URL` / `FEED_IMAGE` in `scripts/generate_feed.py`, the absolute URLs in
`data/station/queue.json`, the feed links in `pages/about.html`,
`sitemap.xml`, `robots.txt`, `llms.txt` and the `CNAME` file, then run:

```
python3 scripts/sync_social_meta.py      # canonical / Open Graph tags
python3 scripts/generate_feed.py         # feed.xml, station.m3u
python3 scripts/make_qr_codes.py --verify
```
