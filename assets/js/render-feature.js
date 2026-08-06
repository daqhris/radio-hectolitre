// Generic "feature" page renderer: one episode, or one standalone work
// (e.g. the Venice piece). Expects window.FEATURE_DATA (a data/ path) and
// window.SITE_BASE to be set by the page, with assets/js/app.js loaded first.

const { $, clearChildren, createEl, fetchJSON, withBase } = RadioHecto;

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? "";
}

function resolveMedia(src) {
  if (!src) return src;
  return /^https?:\/\//i.test(src) ? src : withBase(src);
}

function renderEmbed(embed) {
  const wrap = $("feature-embed");
  if (!wrap) return;
  clearChildren(wrap);

  if (!embed) {
    wrap.appendChild(createEl("div", { class: "no-embed" }, ["No recording linked yet."]));
    return;
  }

  if (embed.type === "soundcloud") {
    const iframe = createEl("iframe", {
      title: embed.label || "Audio player",
      loading: "lazy",
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
      referrerpolicy: "no-referrer-when-downgrade",
    });
    iframe.src = embed.embedUrl;
    iframe.allowFullscreen = true;
    wrap.appendChild(iframe);
  } else if (embed.type === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = resolveMedia(embed.src);
    wrap.appendChild(audio);
    if (embed.label) wrap.appendChild(createEl("div", { class: "embed-caption" }, [embed.label]));
  } else if (embed.type === "link") {
    wrap.appendChild(
      createEl("a", { class: "strip-btn", href: embed.href, target: "_blank", rel: "noopener noreferrer" }, [
        embed.label || "Listen ↗",
      ])
    );
  } else {
    wrap.appendChild(createEl("div", { class: "no-embed" }, ["No recording linked yet."]));
  }
}

function renderLines(id, lines) {
  const el = $(id);
  if (!el) return;
  clearChildren(el);
  for (const line of lines || []) {
    el.appendChild(createEl("div", { class: "feature-credit-line" }, [line]));
  }
}

function renderLinks(id, links) {
  const el = $(id);
  if (!el) return;
  clearChildren(el);
  for (const l of links || []) {
    el.appendChild(createEl("a", { href: l.href, target: "_blank", rel: "noopener noreferrer" }, [l.label || l.href]));
  }
}

function renderFeature(f) {
  setText("feature-eyebrow", f.eyebrow);
  setText("feature-title", f.title);
  setText("feature-subtitle", f.subtitle);
  setText("feature-dateline", f.dateLine);
  document.title = f.title ? `Radio Hectolitre — ${f.title}` : document.title;

  const bg = $("feature-bg");
  if (bg && f.coverImage) bg.style.backgroundImage = `url('${resolveMedia(f.coverImage)}')`;

  const synopsis = $("feature-synopsis");
  if (synopsis) {
    clearChildren(synopsis);
    for (const p of f.synopsis || []) synopsis.appendChild(createEl("p", {}, [p]));
  }

  renderEmbed(f.embed);
  renderLines("feature-credits", f.credits);
  renderLinks("feature-links", f.links);

  const back = $("feature-back");
  if (back && f.backLink) {
    back.setAttribute("href", withBase(f.backLink.href));
    back.textContent = f.backLink.label || "← Back";
  }
}

async function initFeaturePage() {
  const dataPath = window.FEATURE_DATA;
  if (!dataPath) throw new Error("Missing window.FEATURE_DATA in page.");

  await RadioHecto.initChrome();

  let feature;
  try {
    feature = await fetchJSON(dataPath);
  } catch (err) {
    console.error("Failed to load feature data:", err);
    return;
  }
  renderFeature(feature);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFeaturePage);
} else {
  initFeaturePage();
}
