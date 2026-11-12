# Custom domain: radio.hectolitre.be

The site is served by GitHub Pages from this repository's `main` branch, at
**https://radio.hectolitre.be/** (it used to live at
`daqhris.com/radio-hectolitre/`). The `CNAME` file at the repo root is what
tells GitHub Pages which domain to serve; every absolute URL in the site
(canonical tags, Open Graph, sitemap, RSS feed, playlist, QR codes) uses it.

Page-to-page links and assets are relative, so nothing else depends on the
host. The one root-absolute path is the favicon set in `404.html`.

## Cutover order

The code in this branch points at `radio.hectolitre.be` (including the
station queue's audio URL), so **merge it only after the domain answers**.
Merging first would leave the live site referencing a host that does not
resolve yet.

1. **DNS (OVH → DNS zone of `hectolitre.be`)**: add one record

   | Type  | Subdomain | Target                  | TTL  |
   |-------|-----------|-------------------------|------|
   | CNAME | `radio`   | `daqhris.github.io.`    | 3600 |

   The target is the GitHub *account* host (`<user>.github.io`), never the
   repository path. Keep the trailing dot in OVH's zone editor. No A/AAAA
   records are needed for a subdomain. Check it with
   `dig radio.hectolitre.be +short` (should show `daqhris.github.io.` then
   GitHub's IPs).
2. **Optional but recommended, verify the domain** (GitHub → account Settings →
   Pages → Add a domain): add the TXT record GitHub gives you
   (`_github-pages-challenge-daqhris.hectolitre.be`). It stops anyone else
   from claiming the subdomain if the CNAME is ever left dangling.
3. **GitHub → this repo → Settings → Pages → Custom domain**: enter
   `radio.hectolitre.be` and save. GitHub checks DNS, then issues a
   certificate (can take a few minutes up to an hour). Tick **Enforce HTTPS**
   once it is available.
   If `hectolitre.be` has CAA records, they must allow `letsencrypt.org`.
4. **Merge this branch** into `main`.
5. **Check**: open the site, play a recording, load `feed.xml`, and paste the
   homepage into a link-preview debugger (see `docs/social-previews.md`).
   Re-scrape cached previews of old links where needed.

## Old address

Once the custom domain is set, GitHub Pages redirects the old
`daqhris.com/radio-hectolitre/...` URLs to the new host, so printed QR codes,
shared links and podcast-app subscriptions keep working. Test a few old
URLs after cutover rather than assuming it. Pages elsewhere that link to the
old address (for example on daqhris.com itself) should be updated over time.

If the feed was already submitted to podcast directories, keep
the old feed URL alive (the redirect does this) and change it in each
directory when convenient.

## After changing the domain again

Edit `social.siteUrl` in `data/site.json`, `SITE_URL` / `FEED_IMAGE` in
`scripts/generate_feed.py`, and the `CNAME` file, then run:

```
python3 scripts/sync_social_meta.py      # canonical / Open Graph tags
python3 scripts/generate_feed.py         # feed.xml, station.m3u
python3 scripts/make_qr_codes.py --verify
```

and update `sitemap.xml`, `robots.txt`, `llms.txt`, the absolute URLs in
`data/station/queue.json` and the ticker text in `data/site.json`.
