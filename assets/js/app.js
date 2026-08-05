// Shared site chrome: nav, footer, ticker helpers, small DOM utilities.
// Included on every page. Depends on window.SITE_BASE being set by the
// page itself (e.g. "" at the root, "../" for /pages/*.html,
// "../../" for /pages/broadcasts/*.html) so every relative path here
// resolves correctly no matter how deep the page lives — this repo has
// no fixed deployment root, so leading-slash "/assets/..." paths break
// as soon as the site isn't served from a domain root.

const RadioHecto = (function () {
  const BASE = typeof window.SITE_BASE === "string" ? window.SITE_BASE : "";

  function withBase(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path; // external URL, leave as-is
    return BASE + path.replace(/^\//, "");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function createEl(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) continue;
      el.setAttribute(k, String(v));
    }
    for (const child of children) {
      if (typeof child === "string") el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  }

  async function fetchJSON(path) {
    const url = withBase(path);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return res.json();
  }

  function renderNav(site, activePath) {
    const mount = $("site-nav-mount");
    if (!mount || !site) return;

    clearChildren(mount);

    const nav = createEl("nav", { class: "site-nav-inner", "aria-label": "Primary" });

    const logo = createEl("a", { class: "site-nav-logo", href: withBase("index.html") }, [
      site.siteName || "Radio Hectolitre",
    ]);
    nav.appendChild(logo);

    const links = createEl("div", { class: "site-nav-links" }, []);
    for (const item of site.nav || []) {
      const a = createEl("a", { href: withBase(item.href) }, [item.label]);
      if (activePath && item.href === activePath) a.classList.add("is-active");
      links.appendChild(a);
    }
    nav.appendChild(links);

    if (site.liveStreamUrl) {
      const live = createEl(
        "a",
        { class: "site-nav-live", href: site.liveStreamUrl, target: "_blank", rel: "noopener noreferrer" },
        [site.defaultLiveLabel || "Live stream"]
      );
      nav.appendChild(live);
    }

    mount.appendChild(nav);
  }

  function renderFooter(site) {
    const mount = $("site-footer-mount");
    if (!mount || !site?.footer) return;

    clearChildren(mount);

    const footer = createEl("footer", { class: "site-footer" }, []);
    const cols = createEl("div", { class: "footer-cols" }, []);

    const col1 = createEl("div", {}, [
      createEl("div", { class: "footer-label" }, [site.siteName || "Radio Hectolitre"]),
    ]);
    if (site.footer.aboutLine) {
      col1.appendChild(createEl("div", { class: "footer-links" }, [
        createEl("span", {}, [site.footer.aboutLine]),
      ]));
    }
    cols.appendChild(col1);

    if (site.footer.links?.length) {
      const linksWrap = createEl("div", { class: "footer-links" }, []);
      for (const l of site.footer.links) {
        const a = createEl("a", { href: l.href, target: "_blank", rel: "noopener noreferrer" }, [`↗ ${l.label}`]);
        linksWrap.appendChild(a);
      }
      const col2 = createEl("div", {}, [
        createEl("div", { class: "footer-label" }, ["Links"]),
        linksWrap,
      ]);
      cols.appendChild(col2);
    }

    footer.appendChild(cols);

    if (site.footer.credit) {
      footer.appendChild(createEl("div", { class: "footer-credit" }, [site.footer.credit]));
    }

    mount.appendChild(footer);
  }

  function renderTicker(items) {
    const track = $("ticker-track");
    if (!track || !items?.length) return;
    clearChildren(track);
    for (const item of items) {
      track.appendChild(createEl("span", { class: "ticker-item" }, [item]));
    }
  }

  async function initChrome(activePath) {
    try {
      const site = await fetchJSON("data/site.json");
      renderNav(site, activePath);
      renderFooter(site);
      return site;
    } catch (err) {
      console.error("Site chrome failed to load:", err);
      return null;
    }
  }

  return { withBase, $, clearChildren, createEl, fetchJSON, renderNav, renderFooter, renderTicker, initChrome };
})();
