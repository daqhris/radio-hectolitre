// Broadcast-page renderer. Framework-free.
// Expects the HTML page to set window.BROADCAST_ID and window.SITE_BASE,
// include assets/js/app.js first (for the RadioHecto shared helpers and
// site nav/footer), then this file.

const { $, clearChildren, createEl, fetchJSON, withBase } = RadioHecto;

const state = {
  broadcast: null,
  activeTrack: null,
  lightboxIndex: 0,
};

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text ?? "";
}

/* ---------------------------------------------------------------- Hero */

function renderHero() {
  const b = state.broadcast;
  if (!b?.hero) return;

  setText("hero-eyebrow-left", b.hero.eyebrowLeft);
  setText("hero-eyebrow-right", b.hero.eyebrowRight);
  setText("hero-title", b.hero.title);
  setText("hero-date", b.hero.dateLine);
  setText("hero-time", b.hero.timeLine);
  setText("hero-venue", b.hero.venueLine);
  setText("hero-short-description", b.hero.shortDescription);

  if (b.hero.heroImage) {
    const bg = $("hero-bg");
    if (bg) bg.style.backgroundImage = `url('${withBase(b.hero.heroImage)}')`;
  }

  document.title = b.hero.title ? `Radio Hectolitre — ${b.hero.title}` : document.title;
}

/* --------------------------------------------------------------- Ticker */

function renderTicker() {
  const b = state.broadcast;
  if (!b?.ticker?.length) return;
  RadioHecto.renderTicker(b.ticker);
}

/* --------------------------------------------------------------- Photos */

function renderPhotos() {
  const b = state.broadcast;
  if (!b?.photos?.length) return;

  const strip = $("photo-strip");
  if (!strip) return;

  clearChildren(strip);
  const STRIP_H = 320;

  b.photos.forEach((p, i) => {
    const el = createEl("div", { class: "strip-item" }, []);
    if (p.w && p.h) {
      el.style.width = Math.round(STRIP_H * (p.w / p.h)) + "px";
    }
    const img = createEl("img", { src: withBase(p.src), alt: p.alt || "", loading: "lazy" });
    el.appendChild(img);
    if (p.caption) {
      el.appendChild(createEl("div", { class: "strip-caption" }, [p.caption]));
    }
    el.addEventListener("click", () => openLightbox(i));
    strip.appendChild(el);
  });

  wireStripControls(strip);
}

function wireStripControls(strip) {
  // Drag-to-scroll
  let isDown = false, startX, scrollLeft;
  strip.addEventListener("mousedown", (e) => {
    isDown = true;
    strip.classList.add("grabbing");
    startX = e.pageX - strip.offsetLeft;
    scrollLeft = strip.scrollLeft;
  });
  strip.addEventListener("mouseleave", () => { isDown = false; strip.classList.remove("grabbing"); });
  strip.addEventListener("mouseup", () => { isDown = false; strip.classList.remove("grabbing"); });
  strip.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - strip.offsetLeft;
    strip.scrollLeft = scrollLeft - (x - startX) * 1.5;
  });

  const left = $("photo-strip-left");
  const right = $("photo-strip-right");
  const auto = $("photo-strip-auto");
  const SCROLL_AMT = 500;
  if (left) left.addEventListener("click", () => strip.scrollBy({ left: -SCROLL_AMT, behavior: "smooth" }));
  if (right) right.addEventListener("click", () => strip.scrollBy({ left: SCROLL_AMT, behavior: "smooth" }));

  if (auto) {
    let autoInt = null;
    auto.addEventListener("click", () => {
      if (autoInt) {
        clearInterval(autoInt);
        autoInt = null;
        auto.textContent = "⟳ auto-parade";
      } else {
        autoInt = setInterval(() => {
          if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2) strip.scrollLeft = 0;
          else strip.scrollBy({ left: 2, behavior: "auto" });
        }, 16);
        auto.textContent = "◼ pause";
      }
    });
  }
}

/* ------------------------------------------------------------- Lightbox */

function openLightbox(i) {
  state.lightboxIndex = i;
  updateLightbox();
  const modal = $("lightbox-modal");
  if (modal) {
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
  }
}

function closeLightbox() {
  const modal = $("lightbox-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

function updateLightbox() {
  const b = state.broadcast;
  const photo = b?.photos?.[state.lightboxIndex];
  if (!photo) return;
  const img = $("lightbox-img");
  const cap = $("lightbox-caption");
  const counter = $("lightbox-counter");
  if (img) { img.src = withBase(photo.src); img.alt = photo.alt || ""; }
  if (cap) cap.textContent = photo.caption || "";
  if (counter) counter.textContent = `${state.lightboxIndex + 1} / ${b.photos.length}`;
}

function stepLightbox(delta) {
  const total = state.broadcast?.photos?.length || 0;
  if (!total) return;
  state.lightboxIndex = (state.lightboxIndex + delta + total) % total;
  updateLightbox();
}

function wireLightbox() {
  const modal = $("lightbox-modal");
  const closeBtn = $("lightbox-close");
  const prevBtn = $("lightbox-prev");
  const nextBtn = $("lightbox-next");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", () => stepLightbox(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepLightbox(1));
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeLightbox(); });

  document.addEventListener("keydown", (e) => {
    if (!modal || modal.style.display !== "block") return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });
}

/* ---------------------------------------------------------- Track list */

function renderTrackLibrary() {
  const b = state.broadcast;
  if (!b?.tracks?.length) return;

  const list = $("track-library");
  if (!list) return;

  clearChildren(list);

  const active = b.tracks.find((t) => t.active) || b.tracks[0];
  state.activeTrack = active;

  for (const t of b.tracks) {
    const item = createEl("button", { type: "button", class: "track-item" }, []);
    item.dataset.trackNum = t.num || "";

    const label = createEl("div", { class: "track-label" }, [
      createEl("div", { class: "track-title" }, [`${t.num ? t.num + " · " : ""}${t.title}`]),
      createEl("div", { class: "track-sub" }, [t.sub || ""]),
    ]);
    const dur = createEl("div", { class: "track-dur" }, [t.dur || ""]);

    item.appendChild(label);
    item.appendChild(dur);
    if (t === active) item.classList.add("is-active");

    item.addEventListener("click", () => {
      state.activeTrack = t;
      updateActiveTrackUI();
      renderActiveTrackPlayer();
      setPlaying(false); // swapping tracks stops the ambient meter until Play is pressed again
    });

    list.appendChild(item);
  }

  renderActiveTrackPlayer();
}

function updateActiveTrackUI() {
  const list = $("track-library");
  if (!list) return;
  for (const btn of list.querySelectorAll(".track-item")) {
    btn.classList.toggle("is-active", btn.dataset.trackNum === (state.activeTrack?.num ?? ""));
  }
  setText("active-track-title", state.activeTrack?.title);
  setText("active-track-sub", state.activeTrack?.sub);
}

function renderActiveTrackPlayer() {
  const t = state.activeTrack;
  const playerWrap = $("listen-embed");
  if (!playerWrap) return;

  clearChildren(playerWrap);

  if (t?.listen?.type === "soundcloud") {
    const iframe = createEl("iframe", {
      title: t.title ? `Player: ${t.title}` : "Audio player",
      loading: "lazy",
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
      referrerpolicy: "no-referrer-when-downgrade",
    });
    iframe.src = t.listen.embedUrl;
    iframe.allowFullscreen = true;
    playerWrap.appendChild(iframe);
  } else if (t?.listen?.type === "file") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = withBase(t.listen.src);
    playerWrap.appendChild(audio);
  } else {
    playerWrap.appendChild(createEl("div", { class: "no-embed" }, ["Recording not published yet for this track."]));
  }

  setText("active-track-title", t?.title);
  setText("active-track-sub", t?.sub);
}

/* --------------------------------------------------------- Spoken words */

function renderSpokenWords() {
  const b = state.broadcast;
  if (!b?.spokenWords?.length) return;

  const el = $("spoken-words");
  if (!el) return;

  clearChildren(el);

  for (const block of b.spokenWords) {
    const classes = "spoken-block" + (block.variant === "highlight" ? " highlight" : "");
    const blockEl = createEl("section", { class: classes }, [
      createEl("div", { class: "spoken-attribution" }, [block.attribution || ""]),
      createEl("p", { class: "spoken-text" }, [block.text || ""]),
    ]);

    if (block.note) {
      blockEl.appendChild(createEl("p", { class: "spoken-note" }, [block.note]));
    }

    if (block.links?.length) {
      const linksWrap = createEl("div", { class: "spoken-links" }, []);
      for (const l of block.links) {
        const a = createEl("a", { href: l.href, target: "_blank", rel: "noopener noreferrer" }, [l.label || l.href]);
        linksWrap.appendChild(a);
      }
      blockEl.appendChild(linksWrap);
    }

    el.appendChild(blockEl);
  }
}

/* -------------------------------------------------------------- Program */

function renderProgram() {
  const b = state.broadcast;
  if (!b?.program) return;

  setText("program-heading", b.program.heading);

  const container = $("program-paragraphs");
  if (container) {
    clearChildren(container);
    for (const p of b.program.paragraphs || []) {
      container.appendChild(createEl("p", {}, [p]));
    }
  }

  const tags = $("program-tags");
  if (tags) {
    clearChildren(tags);
    for (const tag of b.program.tags || []) {
      tags.appendChild(createEl("span", { class: "tag" }, [tag]));
    }
  }
}

/* --------------------------------------------------------- Live button */

function renderHeroLiveButton() {
  const b = state.broadcast;
  const btn = $("live-stream-button");
  if (!btn || !b?.live?.liveStreamUrl) return;
  if (b.live.liveLabel) btn.textContent = `▶ ${b.live.liveLabel}`;
  btn.addEventListener("click", () => window.open(b.live.liveStreamUrl, "_blank", "noopener,noreferrer"));
}

/* ------------------------------------------------- Ambient VU + play btn
   Two things happen on Play: a decorative VU animation runs in the hero
   (kept from the original prototype — it's the site's visual signature),
   and the active track's embed is (re)loaded so Play actually starts
   audio rather than being purely cosmetic. */

let heroBars = [];
let vuInterval = null;
let playing = false;

function buildVUBars() {
  const vuHero = $("vu-hero");
  if (!vuHero) return;
  clearChildren(vuHero);
  heroBars = [];
  for (let i = 0; i < 48; i++) {
    const b = createEl("div", { class: "vu-bar" }, []);
    vuHero.appendChild(b);
    heroBars.push(b);
  }
}

function animateVU() {
  heroBars.forEach((b, i) => {
    const v = Math.abs(Math.sin(Date.now() / 700 + i * 0.35)) * 0.7 + Math.random() * 0.3;
    const h = Math.round(v * 24) + 2;
    b.style.height = h + "px";
    b.style.background = i < 36
      ? (h > 18 ? "var(--accent)" : h > 10 ? "var(--accent-dim)" : "var(--dim)")
      : (h > 18 ? "var(--red)" : "var(--dim)");
  });
}

function setPlaying(next) {
  playing = next;
  const btn = $("play-button");
  if (btn) btn.classList.toggle("playing", playing);

  if (playing) {
    vuInterval = setInterval(animateVU, 80);
  } else {
    clearInterval(vuInterval);
    heroBars.forEach((b) => { b.style.height = "2px"; b.style.background = "var(--dim)"; });
  }
}

function wirePlayButton() {
  const btn = $("play-button");
  if (!btn) return;
  buildVUBars();
  btn.addEventListener("click", () => {
    setPlaying(!playing);
    if (playing && state.activeTrack?.listen?.type === "soundcloud") {
      // Reload the embed with autoplay so Play has a real effect, not just decoration.
      const iframe = $("listen-embed")?.querySelector("iframe");
      if (iframe && !/auto_play=true/.test(iframe.src)) {
        iframe.src = iframe.src.replace(/auto_play=false/, "auto_play=true");
      }
    }
  });
}

/* ------------------------------------------------------- Related content
   Optional "More from the archive" strip — points at episode/work pages
   without pulling their content into the broadcast page itself. */

function renderRelatedContent() {
  const b = state.broadcast;
  const section = $("related-content-section");
  const mount = $("related-content");
  if (!mount) return;

  if (!b?.relatedContent?.length) {
    if (section) section.style.display = "none";
    return;
  }

  clearChildren(mount);
  mount.appendChild(RadioHecto.buildCardGrid(b.relatedContent));
}

/* ------------------------------------------------------------------ Init */

async function loadBroadcastById(broadcastId) {
  return fetchJSON(`data/broadcasts/${broadcastId}.json`);
}

async function initPage() {
  const broadcastId = window.BROADCAST_ID;
  if (!broadcastId) throw new Error("Missing window.BROADCAST_ID in page.");

  await RadioHecto.initChrome();

  wireLightbox();
  wirePlayButton();

  state.broadcast = await loadBroadcastById(broadcastId);

  renderHero();
  renderTicker();
  renderProgram();
  renderPhotos();
  renderSpokenWords();
  renderTrackLibrary();
  renderHeroLiveButton();
  renderRelatedContent();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
