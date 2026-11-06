// Broadcast-page renderer. Framework-free.
// Expects the HTML page to set window.BROADCAST_ID and window.SITE_BASE,
// include assets/js/app.js first (for the RadioHecto shared helpers and
// site nav/footer), then this file.

const { $, clearChildren, createEl, fetchJSON, withBase } = RadioHecto;

const state = {
  broadcast: null,
  activeTrack: null,
  audioEl: null, // the active <audio> for a self-hosted (type "file") track, if any
  lightboxIndex: 0,
  lightboxItems: [], // the set the lightbox is stepping through: the photo parade or the documents
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
    el.addEventListener("click", () => openLightbox(i, b.photos));
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

function openLightbox(i, items) {
  state.lightboxItems = items || [];
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
  const items = state.lightboxItems;
  const photo = items[state.lightboxIndex];
  if (!photo) return;
  const img = $("lightbox-img");
  const cap = $("lightbox-caption");
  const counter = $("lightbox-counter");
  if (img) { img.src = withBase(photo.src); img.alt = photo.alt || ""; }
  if (cap) cap.textContent = photo.caption || photo.title || "";
  if (counter) counter.textContent = `${state.lightboxIndex + 1} / ${items.length}`;
}

function stepLightbox(delta) {
  const total = state.lightboxItems.length;
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
      setPlaying(false); // swapping tracks resets the play button until Play is pressed again
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

  if (state.audioEl) {
    state.audioEl.pause();
    state.audioEl = null;
  }
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
    // Self-hosted recording. These are hour-long, 50–70 MB files, so
    // preload="none" — nothing downloads until the listener presses play.
    // <source type> lets the browser skip a format it can't decode instead
    // of failing at load time; the inner text + download link are the
    // fallback for browsers without <audio> support, and a plain way to
    // save the file.
    const url = withBase(t.listen.src);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.setAttribute("aria-label", t.title ? `Recording: ${t.title}` : "Recording");
    const source = createEl("source", { src: url }, []);
    if (t.listen.mime) source.setAttribute("type", t.listen.mime);
    audio.appendChild(source);
    audio.appendChild(
      document.createTextNode("Your browser can't play this audio here — use the download link below.")
    );
    audio.addEventListener("play", () => {
      setPlaying(true);
      // One thing at a time: tune the shared station out when a recording starts.
      window.__station?.stop?.();
    });
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("ended", () => setPlaying(false));
    state.audioEl = audio;
    playerWrap.appendChild(audio);

    const dl = createEl("a", { class: "audio-download", href: url, download: "" }, [
      `Download (${(t.listen.src.split(".").pop() || "audio").toUpperCase()}) ↓`,
    ]);
    playerWrap.appendChild(dl);
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

/* ---------------------------------------------------------- Play button
   Toggles the button's own pressed state and, for a SoundCloud track,
   reloads its embed with autoplay so Play has a real effect rather than
   being purely cosmetic. (File-type tracks already get native
   <audio controls> from renderActiveTrackPlayer() — nothing to wire here.)

   Previously this also drove a decorative Math.sin()-based VU animation
   in the hero, unrelated to actual playback. Removed per project
   decision — see README "Possible future direction": basic protocol
   correctness (playback, feed, parity) takes priority over decorative
   polish, and a meter that doesn't reflect real audio was judged not
   worth keeping just to replace later with a real one. */

let playing = false;

function setPlaying(next) {
  playing = next;
  const btn = $("play-button");
  if (btn) btn.classList.toggle("playing", playing);
}

function wirePlayButton() {
  const btn = $("play-button");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // File tracks: the button drives the real <audio> element; its
    // play/pause events (wired in renderActiveTrackPlayer) keep the button's
    // state in sync, including when the listener uses the native controls.
    if (state.audioEl) {
      if (state.audioEl.paused) state.audioEl.play().catch(() => setPlaying(false));
      else state.audioEl.pause();
      return;
    }
    setPlaying(!playing);
    if (playing && state.activeTrack?.listen?.type === "soundcloud") {
      // Reload the embed with autoplay so Play has a real effect, not just decoration.
      const iframe = $("listen-embed")?.querySelector("iframe");
      if (iframe && !/auto_play=true/.test(iframe.src)) {
        iframe.src = iframe.src.replace(/auto_play=false/, "auto_play=true");
      }
    }
  });

  // The other half of "one thing at a time": if the shared station starts
  // playing a file, pause the recording here. Media events don't bubble, so
  // listen in the capture phase.
  document.addEventListener(
    "play",
    (e) => {
      if (e.target?.id === "station-audio" && state.audioEl && !state.audioEl.paused) {
        state.audioEl.pause();
      }
    },
    true
  );
}

/* ------------------------------------------------------------ Documents
   Documenting artifacts that are not part of the photo parade: a source
   text and a rehearsal score. Each one gets a figure with its own context
   and credit rather than a strip thumbnail, and opens in the lightbox as
   a set of its own. */

function renderDocuments() {
  const b = state.broadcast;
  const section = $("documents-section");
  const mount = $("documents");
  if (!mount) return;

  if (!b?.documents?.length) {
    if (section) section.style.display = "none";
    return;
  }

  clearChildren(mount);

  b.documents.forEach((doc, i) => {
    const frame = createEl("button", {
      type: "button",
      class: "document-frame",
      "aria-label": `Enlarge: ${doc.title}`,
    }, []);
    if (doc.w && doc.h) frame.style.aspectRatio = `${doc.w} / ${doc.h}`;
    frame.appendChild(createEl("img", { src: withBase(doc.src), alt: doc.alt || "", loading: "lazy" }));
    frame.addEventListener("click", () => openLightbox(i, b.documents));

    const text = createEl("figcaption", { class: "document-text" }, [
      createEl("div", { class: "document-kicker" }, [doc.kicker || ""]),
      createEl("h3", { class: "document-title" }, [doc.title || ""]),
      createEl("p", { class: "document-desc" }, [doc.description || ""]),
    ]);
    if (doc.credit) text.appendChild(createEl("div", { class: "document-credit" }, [doc.credit]));

    mount.appendChild(createEl("figure", { class: "document" }, [frame, text]));
  });
}

/* --------------------------------------------------------------- Videos
   Short videos that document the broadcast, shown in their own section.
   Two kinds, chosen per entry by `type`:

   - "instagram": a public Instagram post or reel. It sits behind a
     click-to-load poster ("facade"): nothing is requested from Instagram
     until the visitor presses play, which keeps the page light and keeps
     Instagram's cookies and tracking out of it for anyone who never
     does. Once pressed, Instagram's own embed player replaces the poster
     and plays the video in place. A plain "Watch on Instagram" link is
     always shown too, so the video stays reachable if the embed is
     blocked (privacy extensions do that) or the post is removed.
   - "file": a self-hosted video — the durable choice, same spirit as the
     self-hosted audio tracks. Native <video controls> with preload="none".

   Embeds are iframes of the form <permalink>embed/, which needs no API
   token. They only work for posts on a public account. */

// Instagram's embed frame wraps the video in a header and a footer bar.
// This is roughly their combined height at typical widths; tune it if the
// embed ever shows a scrollbar or a blank strip.
const INSTAGRAM_CHROME_PX = 150;

// Accepts .../p/<code>/, .../reel/<code>/, .../reels/<code>/, .../tv/<code>/ and
// the .../<username>/reel/<code>/ form that "Copy link" sometimes produces.
// Returns { permalink, embedUrl } or null if the URL isn't an Instagram post.
function parseInstagramUrl(url) {
  const m = String(url || "").match(
    /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/
  );
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  const permalink = `https://www.instagram.com/${kind}/${m[2]}/`;
  return { permalink, embedUrl: `${permalink}embed/` };
}

function buildInstagramStage(v) {
  const ig = parseInstagramUrl(v.url);
  const stage = createEl("div", { class: "video-stage" }, []);
  if (!ig) {
    stage.appendChild(createEl("div", { class: "no-embed" }, ["Video link is missing or not a valid Instagram post."]));
    return stage;
  }

  const ratio = v.w && v.h ? v.h / v.w : 16 / 9; // default: a vertical reel
  const facade = createEl("button", {
    type: "button",
    class: "video-facade",
    "aria-label": `Play video: ${v.title || "Instagram video"}`,
  }, []);
  facade.style.aspectRatio = `${v.w || 9} / ${v.h || 16}`;
  if (v.poster) {
    facade.appendChild(createEl("img", { src: withBase(v.poster), alt: "", loading: "lazy" }));
  }
  facade.appendChild(createEl("span", { class: "video-play", "aria-hidden": "true" }, ["▶"]));
  facade.appendChild(createEl("span", { class: "video-facade-note" }, ["Plays in Instagram's player — loads when you press play"]));

  facade.addEventListener("click", () => {
    const iframe = createEl("iframe", {
      src: ig.embedUrl,
      title: v.title ? `Video: ${v.title}` : "Instagram video",
      loading: "lazy",
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      referrerpolicy: "strict-origin-when-cross-origin",
      scrolling: "no",
    });
    iframe.allowFullscreen = true;
    iframe.style.height = `${Math.round(stage.clientWidth * ratio + INSTAGRAM_CHROME_PX)}px`;
    // One thing at a time: tune the shared station out while the video plays.
    window.__station?.stop?.();
    clearChildren(stage);
    stage.appendChild(iframe);
  });

  stage.appendChild(facade);
  return stage;
}

function buildFileStage(v) {
  const stage = createEl("div", { class: "video-stage" }, []);
  if (!v.src) {
    stage.appendChild(createEl("div", { class: "no-embed" }, ["Video not published yet."]));
    return stage;
  }
  const url = withBase(v.src);
  const video = document.createElement("video");
  video.controls = true;
  video.preload = "none";
  video.playsInline = true;
  if (v.poster) video.poster = withBase(v.poster);
  video.setAttribute("aria-label", v.title ? `Video: ${v.title}` : "Video");
  const source = createEl("source", { src: url }, []);
  if (v.mime) source.setAttribute("type", v.mime);
  video.appendChild(source);
  video.appendChild(document.createTextNode("Your browser can't play this video here — use the download link below."));
  video.addEventListener("play", () => window.__station?.stop?.());
  stage.appendChild(video);
  return stage;
}

function renderVideos() {
  const b = state.broadcast;
  const section = $("videos-section");
  const mount = $("videos");
  if (!mount) return;

  if (!b?.videos?.length) {
    if (section) section.style.display = "none";
    return;
  }

  clearChildren(mount);

  for (const v of b.videos) {
    const isInstagram = v.type === "instagram";
    const stage = isInstagram ? buildInstagramStage(v) : buildFileStage(v);

    // Caption block reuses the Documents text styles (kicker / title / desc / credit).
    const text = createEl("figcaption", { class: "document-text" }, [
      createEl("div", { class: "document-kicker" }, [v.kicker || ""]),
      createEl("h3", { class: "document-title" }, [v.title || ""]),
      createEl("p", { class: "document-desc" }, [v.description || ""]),
    ]);
    if (v.credit) text.appendChild(createEl("div", { class: "document-credit" }, [v.credit]));

    const figure = createEl("figure", { class: "video" }, [stage, text]);

    // Always-available way to the video itself.
    const ig = isInstagram ? parseInstagramUrl(v.url) : null;
    if (ig) {
      figure.appendChild(createEl("a", {
        class: "video-source", href: ig.permalink, target: "_blank", rel: "noopener noreferrer",
      }, ["Watch on Instagram ↗"]));
    } else if (!isInstagram && v.src) {
      figure.appendChild(createEl("a", { class: "video-source", href: withBase(v.src), download: "" }, [
        `Download (${(v.src.split(".").pop() || "video").toUpperCase()}) ↓`,
      ]));
    }

    mount.appendChild(figure);
  }
}

/* -------------------------------------------------------------- Credits */

function creditGroup(label, lines) {
  return createEl("div", { class: "credit-group" }, [
    createEl("h3", { class: "credit-label" }, [label]),
    ...lines.map((line) => createEl("div", { class: "credit-line" }, [line])),
  ]);
}

function renderCredits() {
  const b = state.broadcast;
  const section = $("credits-section");
  const mount = $("credits");
  if (!mount) return;

  const groups = [];

  for (const p of b?.performers || []) {
    groups.push(creditGroup(p.role, p.names || []));
  }

  const c = b?.credits;
  if (c) {
    if (c.madeFor) groups.push(creditGroup("Made for", [c.madeFor]));
    if (c.producer) groups.push(creditGroup("Producer", [c.producer]));
    if (c.design) {
      // "Poster design by X · Documentation photography by Y · …" — one group per
      // "<role> by <name>" entry, so each role is labelled like the performers.
      for (const entry of c.design.split(" · ")) {
        const [role, ...rest] = entry.split(" by ");
        if (rest.length) groups.push(creditGroup(role, [rest.join(" by ")]));
        else groups.push(creditGroup("Design", [entry]));
      }
    }
    if (c.infrastructure) groups.push(creditGroup("Infrastructure", c.infrastructure.split(" · ")));
  }

  if (!groups.length) {
    if (section) section.style.display = "none";
    return;
  }

  clearChildren(mount);
  groups.forEach((g) => mount.appendChild(g));
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
  renderDocuments();
  renderVideos();
  renderTrackLibrary();
  renderHeroLiveButton();
  renderCredits();
  renderRelatedContent();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
