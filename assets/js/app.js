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

  /* ------------------------------------------------------ Day/night theme
     The actual first-paint decision (stored choice, else system
     prefers-color-scheme) happens in a tiny inline script in every page's
     <head>, before this file even loads — see docs/theme.md — so there's
     no flash of the wrong theme. This half just renders the nav toggle
     and keeps localStorage in sync with whatever the visitor picks from
     here on. Same storage key as the head script: keep them matched. */

  const THEME_KEY = "rh-theme";

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  // Takes the button element directly rather than looking it up by id —
  // called once from renderThemeToggle() before the button has been
  // inserted into the document (getElementById would find nothing yet).
  function updateThemeButton(btn) {
    if (!btn) return;
    const isLight = getTheme() === "light";
    btn.setAttribute("aria-pressed", isLight ? "true" : "false");
    btn.setAttribute("aria-label", isLight ? "Switch to night theme" : "Switch to day theme");
  }

  function setTheme(theme, btn) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      // Private browsing / storage disabled: theme still applies for this
      // page view, it just won't be remembered on the next one.
    }
    updateThemeButton(btn || $("theme-toggle"));
  }

  function renderThemeToggle() {
    const btn = createEl("button", {
      type: "button",
      id: "theme-toggle",
      class: "site-nav-theme",
    }, []);
    btn.innerHTML =
      '<svg class="icon-sun" viewBox="0 0 16 16" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="3.4"/>' +
        '<rect x="7.3" y="0.5" width="1.4" height="2.6" rx="0.7"/>' +
        '<rect x="7.3" y="12.9" width="1.4" height="2.6" rx="0.7"/>' +
        '<rect x="0.5" y="7.3" width="2.6" height="1.4" rx="0.7"/>' +
        '<rect x="12.9" y="7.3" width="2.6" height="1.4" rx="0.7"/>' +
        '<rect x="7.3" y="0.5" width="1.4" height="2.6" rx="0.7" transform="rotate(45 8 8)"/>' +
        '<rect x="7.3" y="12.9" width="1.4" height="2.6" rx="0.7" transform="rotate(45 8 8)"/>' +
        '<rect x="0.5" y="7.3" width="2.6" height="1.4" rx="0.7" transform="rotate(45 8 8)"/>' +
        '<rect x="12.9" y="7.3" width="2.6" height="1.4" rx="0.7" transform="rotate(45 8 8)"/>' +
      '</svg>' +
      '<svg class="icon-moon" viewBox="0 0 16 16" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="6.5"/>' +
        '<circle class="moon-cut" cx="10.6" cy="5.6" r="5.4"/>' +
      '</svg>';
    btn.addEventListener("click", () => setTheme(getTheme() === "light" ? "dark" : "light", btn));
    updateThemeButton(btn);
    return btn;
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

    nav.appendChild(renderThemeToggle());

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

  /**
   * Shared card-grid builder used by the broadcast archive, the episode
   * index, and a broadcast page's "More from the archive" section — one
   * card shape everywhere instead of three separate implementations.
   * @param {Array<{href:string, poster?:string, badge?:string, dateLine?:string, title:string, summary?:string}>} items
   */
  function buildCardGrid(items, emptyText) {
    if (!items?.length) {
      return createEl("div", { class: "archive-empty" }, [emptyText || "Nothing here yet."]);
    }
    const grid = createEl("div", { class: "archive-grid" }, []);
    for (const item of items) {
      const card = createEl("a", { class: "archive-card", href: withBase(item.href) }, []);

      const img = createEl("div", { class: "archive-card-img" }, []);
      if (item.poster) img.style.backgroundImage = `url('${/^https?:\/\//i.test(item.poster) ? item.poster : withBase(item.poster)}')`;
      if (item.badge) {
        img.appendChild(createEl("span", { class: "archive-card-status" }, [
          createEl("span", { class: "live-dot" }, []),
          item.badge,
        ]));
      }
      card.appendChild(img);

      const body = createEl("div", { class: "archive-card-body" }, [
        createEl("div", { class: "archive-card-date" }, [item.dateLine || ""]),
        createEl("div", { class: "archive-card-title" }, [item.title || ""]),
        createEl("div", { class: "archive-card-summary" }, [item.summary || ""]),
      ]);
      card.appendChild(body);

      grid.appendChild(card);
    }
    return grid;
  }

  async function initChrome(activePath) {
    try {
      const site = await fetchJSON("data/site.json");
      renderNav(site, activePath);
      renderFooter(site);
      if (typeof window.initStationPlayer === "function") window.initStationPlayer(site);
      return site;
    } catch (err) {
      console.error("Site chrome failed to load:", err);
      return null;
    }
  }

  return { withBase, $, clearChildren, createEl, fetchJSON, renderNav, renderFooter, renderTicker, buildCardGrid, initChrome };
})();
