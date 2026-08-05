// Minimal, framework-free page renderer.
// Expects the HTML page to include specific container IDs (see next section).

const state = {
  broadcast: null,
  activeTrack: null
};

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text ?? "";
}

function setAttr(id, attr, value) {
  const el = $(id);
  if (!el) return;
  el.setAttribute(attr, value);
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  for (const child of children) {
    if (typeof child === "string") el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  }
  return el;
}

/**
 * Render hero section
 */
function renderHero() {
  const b = state.broadcast;
  if (!b?.hero) return;

  setText("hero-eyebrow-left", b.hero.eyebrowLeft);
  setText("hero-eyebrow-right", b.hero.eyebrowRight);
  setText("hero-title", b.hero.title);
  setText("hero-date", b.hero.dateLine);
  setText("hero-time", b.hero.timeLine);
  setText("hero-venue", b.hero.venueLine);

  // Optional
  setText("hero-short-description", b.hero.shortDescription);
}

/**
 * Render ticker
 */
function renderTicker() {
  const b = state.broadcast;
  if (!b?.ticker) return;

  const tickerEl = $("ticker-track");
  if (!tickerEl) return;

  clearChildren(tickerEl);

  for (const item of b.ticker) {
    const span = createEl("span", { class: "ticker-item" }, [item]);
    tickerEl.appendChild(span);
  }
}

/**
 * Render photos strip + lightbox thumbnails
 */
function renderPhotos() {
  const b = state.broadcast;
  const strip = $("photo-strip");
  if (!strip) return;

  clearChildren(strip);

  if (!b?.photos?.length) {
    strip.appendChild(createEl("div", { class: "empty-state" }, ["No photos available."]));
    return;
  }

  for (const p of b.photos) {
    const item = createEl("div", { class: "strip-item" }, []);
    const img = createEl("img", { src: p.src, alt: p.alt || "", loading: "lazy" }, []);

    const captionText = p.caption || p.alt || "";
    const caption = createEl("div", { class: "strip-caption" }, [captionText]);

    img.addEventListener("click", () => openLightbox(p));
    item.appendChild(img);
    if (captionText) item.appendChild(caption);

    strip.appendChild(item);
  }
}

function openLightbox(photo) {
  const modal = $("lightbox-modal");
  const modalImg = $("lightbox-img");
  const modalCaption = $("lightbox-caption");

  if (!modal || !modalImg) return;

  modal.style.display = "block";
  modalImg.src = photo.src;
  modalImg.alt = photo.alt || "";
  if (modalCaption) modalCaption.textContent = photo.caption || "";
}

function closeLightbox() {
  const modal = $("lightbox-modal");
  if (!modal) return;
  modal.style.display = "none";
}

/**
 * Build audio library list (tracks)
 */
function renderTrackLibrary() {
  const b = state.broadcast;
  if (!b?.tracks?.length) return;

  const list = $("track-library");
  if (!list) return;

  clearChildren(list);

  const active = b.tracks.find(t => t.active) || b.tracks[0];
  state.activeTrack = active;

  for (const t of b.tracks) {
    const item = createEl("button", { type: "button", class: "track-item" }, []);
    item.dataset.trackNum = t.num || "";

    const label = createEl("div", { class: "track-label" }, []);
    const title = createEl("div", { class: "track-title" }, [`${t.num ? t.num + " · " : ""}${t.title}`]);
    const sub = createEl("div", { class: "track-sub" }, [t.sub || ""]);
    const dur = createEl("div", { class: "track-dur" }, [t.dur || ""]);

    label.appendChild(title);
    label.appendChild(sub);
    item.appendChild(label);
    item.appendChild(dur);

    if (t === active) item.classList.add("is-active");

    item.addEventListener("click", () => {
      state.activeTrack = t;
      updateActiveTrackUI();
      renderActiveTrackPlayer();
    });

    list.appendChild(item);
  }

  renderActiveTrackPlayer();
}

/**
 * Update active class in track library
 */
function updateActiveTrackUI() {
  const list = $("track-library");
  if (!list) return;

  const buttons = Array.from(list.querySelectorAll(".track-item"));
  for (const btn of buttons) {
    const num = btn.dataset.trackNum;
    btn.classList.toggle("is-active", num === (state.activeTrack?.num ?? ""));
  }

  // Optional sticky bar fields
  setText("active-track-title", state.activeTrack?.title);
  setText("active-track-sub", state.activeTrack?.sub);
}

/**
 * Render the active track embed
 */
function renderActiveTrackPlayer() {
  const t = state.activeTrack;
  if (!t?.listen) return;

  const playerWrap = $("listen-embed");
  if (!playerWrap) return;

  clearChildren(playerWrap);

  // Current stage: SoundCloud embeds.
  // Later: local files can be handled with another case.
  if (t.listen.type === "soundcloud") {
    const iframe = document.createElement("iframe");
    iframe.src = t.listen.embedUrl;
    iframe.title = t.title ? `Player: ${t.title}` : "Audio player";
    iframe.loading = "lazy";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.height = "120px";

    playerWrap.appendChild(iframe);
  } else if (t.listen.type === "file") {
    // Example placeholder for later extension:
    // Add a <audio controls> element.
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = t.listen.src;

    playerWrap.appendChild(audio);
  } else {
    playerWrap.textContent = "No player configured for this track.";
  }

  // Optional sticky bar updates
  setText("active-track-title", t.title);
  setText("active-track-sub", t.sub);
}

/**
 * Render everything for a broadcast page
 */
function renderSpokenWords() {
  const b = state.broadcast;
  if (!b?.spokenWords?.length) return;

  const el = $("spoken-words");
  if (!el) return;

  clearChildren(el);

  for (const block of b.spokenWords) {
    const blockEl = createEl("section", { class: "spoken-block" }, []);
    const attr = createEl("div", { class: "spoken-attribution" }, [block.attribution || ""]);
    const text = createEl("p", { class: "spoken-text" }, [block.text || ""]);
    blockEl.appendChild(attr);
    blockEl.appendChild(text);

    if (block.links?.length) {
      const linksWrap = createEl("div", { class: "spoken-links" }, []);
      for (const l of block.links) {
        const a = document.createElement("a");
        a.href = l.href;
        a.textContent = l.label || l.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        linksWrap.appendChild(a);
      }
      blockEl.appendChild(linksWrap);
    }

    el.appendChild(blockEl);
  }
}

function renderProgram() {
  const b = state.broadcast;
  if (!b?.program) return;

  setText("program-heading", b.program.heading);

  const container = $("program-paragraphs");
  if (container) {
    clearChildren(container);
    for (const p of b.program.paragraphs || []) {
      const pe = document.createElement("p");
      pe.textContent = p;
      container.appendChild(pe);
    }
  }

  const tags = $("program-tags");
  if (tags) {
    clearChildren(tags);
    for (const tag of b.program.tags || []) {
      const span = createEl("span", { class: "tag" }, [tag]);
      tags.appendChild(span);
    }
  }
}

function renderHeroLiveButton() {
  const b = state.broadcast;
  if (!b?.live?.liveStreamUrl) return;

  const btn = $("live-stream-button");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.open(b.live.liveStreamUrl, "_blank", "noopener,noreferrer");
  });
}

/**
 * Load JSON and render
 */
async function loadBroadcastById(broadcastId) {
  const url = `/data/broadcasts/${broadcastId}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load broadcast JSON: ${url}`);
  return await res.json();
}

export async function initBroadcastPage() {
  // Expected: the HTML page sets window.BROADCAST_ID
  const broadcastId = window.BROADCAST_ID;
  if (!broadcastId) throw new Error("Missing window.BROADCAST_ID in page.");

  // Optional: lightbox close wiring
  const modal = $("lightbox-modal");
  const closeBtn = $("lightbox-close");
  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (modal) modal.addEventListener("click", (e) => {
    if (e.target === modal) closeLightbox();
  });

  state.broadcast = await loadBroadcastById(broadcastId);

  renderHero();
  renderTicker();
  renderProgram();
  renderPhotos();
  renderSpokenWords();
  renderTrackLibrary();
  renderHeroLiveButton();
}