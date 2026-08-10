// Renders card grids from an index.json — broadcasts on the homepage /
// archive page, episodes on the episodes index. Shared card markup lives
// in RadioHecto.buildCardGrid (app.js).

const { $, clearChildren, fetchJSON, buildCardGrid } = RadioHecto;

/**
 * @param {object} opts
 * @param {string} opts.mountId
 * @param {"current"|"archived"|"all"} opts.filter - "current" = live/featured only,
 *   "archived" = everything except current, "all" = everything (archive page)
 * @param {string} [opts.emptyText]
 */
async function renderBroadcastGrid(opts) {
  const mount = $(opts.mountId);
  if (!mount) return;

  let data;
  try {
    data = await fetchJSON("data/broadcasts/index.json");
  } catch (err) {
    console.error("Failed to load broadcasts index:", err);
    mount.appendChild(buildCardGrid([], "Broadcasts could not be loaded."));
    return;
  }

  let broadcasts = data.broadcasts || [];
  if (opts.filter === "current") broadcasts = broadcasts.filter((b) => b.status === "current");
  else if (opts.filter === "archived") broadcasts = broadcasts.filter((b) => b.status !== "current");

  const showBadge = opts.showCurrentBadge !== false;

  const items = broadcasts.map((b) => ({
    href: b.href,
    poster: b.poster,
    badge: (showBadge && b.status === "current") ? "" : null,
    dateLine: b.dateLine,
    title: b.title,
    summary: b.summary,
  }));

  clearChildren(mount);
  mount.appendChild(buildCardGrid(items, opts.emptyText));
}

/**
 * @param {object} opts
 * @param {string} opts.mountId
 * @param {string} [opts.emptyText]
 */
async function renderEpisodeGrid(opts) {
  const mount = $(opts.mountId);
  if (!mount) return;

  let data;
  try {
    data = await fetchJSON("data/episodes/index.json");
  } catch (err) {
    console.error("Failed to load episodes index:", err);
    mount.appendChild(buildCardGrid([], "Episodes could not be loaded."));
    return;
  }

  const items = (data.episodes || []).map((e) => ({
    href: e.href,
    poster: e.poster,
    dateLine: e.dateLine,
    title: e.title,
    summary: e.summary,
  }));

  clearChildren(mount);
  mount.appendChild(buildCardGrid(items, opts.emptyText));
}

/**
 * @param {object} opts
 * @param {string} opts.mountId
 * @param {string} [opts.emptyText]
 */
async function renderWorksGrid(opts) {
  const mount = $(opts.mountId);
  if (!mount) return;

  let data;
  try {
    data = await fetchJSON("data/works/index.json");
  } catch (err) {
    console.error("Failed to load works index:", err);
    mount.appendChild(buildCardGrid([], "Works could not be loaded."));
    return;
  }

  const items = (data.works || []).map((w) => ({
    href: w.href,
    poster: w.poster,
    dateLine: w.dateLine,
    title: w.title,
    summary: w.summary,
  }));

  clearChildren(mount);
  mount.appendChild(buildCardGrid(items, opts.emptyText));
}
