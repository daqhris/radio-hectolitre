// Renders a grid of broadcast cards from data/broadcasts/index.json.
// Used by root index.html (home) and pages/archive.html (full archive).
// Depends on assets/js/app.js being loaded first (RadioHecto namespace)
// and window.SITE_BASE being set by the page.

const { $, clearChildren, createEl, fetchJSON, withBase } = RadioHecto;

/**
 * @param {object} opts
 * @param {string} opts.mountId   - container element id
 * @param {"current"|"archived"|"all"} opts.filter - "current" = live/featured broadcast only,
 *   "archived" = everything except the current one, "all" = every broadcast (archive page)
 * @param {string} [opts.emptyText] - message shown when the filtered list is empty
 */
async function renderBroadcastGrid(opts) {
  const mount = $(opts.mountId);
  if (!mount) return;

  let data;
  try {
    data = await fetchJSON("data/broadcasts/index.json");
  } catch (err) {
    console.error("Failed to load broadcasts index:", err);
    mount.appendChild(createEl("div", { class: "archive-empty" }, ["Broadcasts could not be loaded."]));
    return;
  }

  let broadcasts = data.broadcasts || [];
  if (opts.filter === "current") {
    broadcasts = broadcasts.filter((b) => b.status === "current");
  } else if (opts.filter === "archived") {
    broadcasts = broadcasts.filter((b) => b.status !== "current");
  }

  clearChildren(mount);

  if (!broadcasts.length) {
    mount.appendChild(createEl("div", { class: "archive-empty" }, [opts.emptyText || "No broadcasts published yet — check back soon."]));
    return;
  }

  const grid = createEl("div", { class: "archive-grid" }, []);

  for (const b of broadcasts) {
    const card = createEl("a", { class: "archive-card", href: withBase(b.href) }, []);

    const img = createEl("div", { class: "archive-card-img" }, []);
    if (b.poster) img.style.backgroundImage = `url('${withBase(b.poster)}')`;
    if (b.status === "current") {
      img.appendChild(createEl("span", { class: "archive-card-status" }, [
        createEl("span", { class: "live-dot" }, []),
        "Current",
      ]));
    }
    card.appendChild(img);

    const body = createEl("div", { class: "archive-card-body" }, [
      createEl("div", { class: "archive-card-date" }, [b.dateLine || ""]),
      createEl("div", { class: "archive-card-title" }, [b.title || ""]),
      createEl("div", { class: "archive-card-summary" }, [b.summary || ""]),
    ]);
    card.appendChild(body);

    grid.appendChild(card);
  }

  mount.appendChild(grid);
}
