// The shared "virtual station" — a fixed program (data/station/queue.json)
// that every listener's browser plays back in sync, purely by computing
// (Date.now() - epoch) mod totalDuration. No server, no live stream: just
// arithmetic run independently in each browser, landing on the same track
// and the same offset within it. See docs/station-notes.md for the full
// explanation and how to maintain the program as content grows.
//
// Loaded on every page (after app.js). Exposes window.initStationPlayer,
// which app.js's initChrome() calls automatically if present — no other
// per-page wiring needed.

(function () {
  const { $, createEl, fetchJSON, withBase } = RadioHecto;

  const state = {
    queue: [],
    epochMs: 0,
    totalMs: 0,
    playing: false,
    activeIndex: -1,
    audioEl: null,
    scWidget: null,
    scReady: false,
    scLoadingPromise: null,
  };

  /* ------------------------------------------------------------- Timing */

  // Pure function: given the current time, which track (index into
  // state.queue) should be playing right now, and how far into it.
  // Deliberately takes `nowMs` as a parameter (rather than reading
  // Date.now() internally) so it stays trivially unit-testable.
  function computePosition(nowMs) {
    if (!state.totalMs || !state.queue.length) return null;
    let elapsed = (((nowMs - state.epochMs) % state.totalMs) + state.totalMs) % state.totalMs;
    for (let i = 0; i < state.queue.length; i++) {
      const durMs = (state.queue[i].durationSec || 0) * 1000;
      if (elapsed < durMs) return { index: i, offsetMs: elapsed };
      elapsed -= durMs;
    }
    // Rounding edge case (elapsed lands exactly on the boundary): wrap to track 0.
    return { index: 0, offsetMs: 0 };
  }

  /* --------------------------------------------------------------- DOM */

  function els() {
    return {
      bar: $("station-bar"),
      btn: $("station-play"),
      link: $("station-info-link"),
      title: $("station-title"),
      sub: $("station-sub"),
      kind: $("station-kind"),
    };
  }

  function renderBar() {
    if ($("station-bar")) return;

    const bar = createEl("div", { id: "station-bar", class: "station-bar" }, []);

    const btn = createEl("button", {
      id: "station-play",
      type: "button",
      class: "station-bar-play",
      "aria-label": "Play the station",
    }, []);
    btn.innerHTML =
      '<svg class="icon-play" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11"/></svg>' +
      '<svg class="icon-pause" viewBox="0 0 12 12"><rect x="1" y="1" width="3.5" height="10"/><rect x="7.5" y="1" width="3.5" height="10"/></svg>';
    btn.addEventListener("click", togglePlay);

    const link = createEl("a", { id: "station-info-link", class: "station-info", href: "#" }, [
      createEl("div", { class: "station-label" }, [
        createEl("span", { class: "live-dot" }, []),
        "Station",
      ]),
      createEl("div", { id: "station-title", class: "station-title" }, ["Tap play to tune in"]),
      createEl("div", { id: "station-sub", class: "station-sub" }, []),
    ]);
    link.addEventListener("click", (e) => {
      if (!link.getAttribute("href") || link.getAttribute("href") === "#") e.preventDefault();
    });

    const kind = createEl("div", { id: "station-kind", class: "station-kind" }, []);

    bar.appendChild(btn);
    bar.appendChild(link);
    bar.appendChild(kind);
    document.body.appendChild(bar);
    document.body.classList.add("has-station-bar");
  }

  function updateNowPlaying(track) {
    const { link, title, sub, kind } = els();
    if (title) title.textContent = track.title || "";
    if (sub) sub.textContent = track.sub || "";
    if (kind) kind.textContent = track.kind || "";
    if (link && track.href) link.setAttribute("href", withBase(track.href));
  }

  function setPlaying(next) {
    state.playing = next;
    const { btn, bar } = els();
    if (btn) btn.classList.toggle("playing", next);
    if (bar) bar.classList.toggle("is-playing", next);
    if (!next) stopAll();
  }

  /* ------------------------------------------------------- Playback: file */

  function ensureAudioEl() {
    if (state.audioEl) return state.audioEl;
    const audio = document.createElement("audio");
    audio.id = "station-audio";
    audio.preload = "none";
    audio.addEventListener("ended", advance);
    hideEl(audio);
    document.body.appendChild(audio);
    state.audioEl = audio;
    return audio;
  }

  function hideEl(el) {
    // Kept technically visible (not display:none) so browsers don't
    // deprioritize/throttle the media element — just visually and
    // interactively out of the way. The site already has its own
    // now-playing UI; this element is a pure audio engine.
    el.style.position = "absolute";
    el.style.width = "1px";
    el.style.height = "1px";
    el.style.opacity = "0";
    el.style.overflow = "hidden";
    el.style.pointerEvents = "none";
  }

  function playFile(track, offsetMs) {
    if (state.scWidget) {
      try { state.scWidget.pause(); } catch (err) { /* widget not ready yet */ }
    }
    const audio = ensureAudioEl();
    const startAt = () => {
      audio.currentTime = offsetMs / 1000;
      audio.play().catch(() => {}); // blocked until a user gesture; the Play tap itself is that gesture
    };
    if (audio.src === track.src) {
      startAt();
    } else {
      audio.src = track.src;
      audio.addEventListener("loadedmetadata", startAt, { once: true });
      audio.load();
    }
  }

  /* -------------------------------------------------- Playback: SoundCloud */

  function ensureScWidgetApi(cb) {
    if (window.SC && window.SC.Widget) return cb();
    if (!state.scLoadingPromise) {
      state.scLoadingPromise = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "https://w.soundcloud.com/player/api.js";
        s.onload = resolve;
        s.onerror = resolve; // fail open — playSoundcloud() will just no-op if SC never arrives
        document.body.appendChild(s);
      });
    }
    state.scLoadingPromise.then(cb);
  }

  function ensureScFrame() {
    let iframe = $("station-sc-frame");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "station-sc-frame";
      iframe.setAttribute("allow", "autoplay");
      hideEl(iframe);
      document.body.appendChild(iframe);
    }
    return iframe;
  }

  function playSoundcloud(track, offsetMs) {
    if (state.audioEl) state.audioEl.pause();
    ensureScWidgetApi(() => {
      if (!window.SC || !window.SC.Widget) return; // SDK failed to load — silently stay paused

      if (!state.scWidget) {
        // First SoundCloud track this page load: create the iframe and the
        // ONE widget wrapper we'll reuse for the rest of the session.
        //
        // Deliberately NOT creating a fresh SC.Widget(iframe) on every
        // track change: each wrapper registers its own internal
        // postMessage listener on the iframe that's never torn down by
        // unbind() (unbind only removes the specific event callbacks you
        // added, not the SDK's own listener). Re-wrapping the same iframe
        // repeatedly means old wrappers keep reacting alongside the new
        // one, which is what caused playback to break after a couple of
        // track changes. One widget, bound once, and load() for every
        // later track — the pattern SoundCloud's own docs use for exactly
        // this "auto-advance a playlist" case.
        const iframe = ensureScFrame();
        iframe.src = track.embedUrl;
        const widget = SC.Widget(iframe);
        state.scWidget = widget;
        widget.bind(SC.Widget.Events.READY, () => {
          widget.seekTo(offsetMs);
          widget.play();
        });
        widget.bind(SC.Widget.Events.FINISH, advance);
      } else {
        state.scWidget.load(track.embedUrl, {
          callback: () => {
            state.scWidget.seekTo(offsetMs);
            state.scWidget.play();
          },
        });
      }
    });
  }

  /* ------------------------------------------------------------- Control */

  function stopAll() {
    if (state.audioEl) state.audioEl.pause();
    if (state.scWidget) {
      try { state.scWidget.pause(); } catch (err) { /* widget not ready yet */ }
    }
  }

  function playTrackAt(index, offsetMs) {
    const track = state.queue[index];
    if (!track) return;
    state.activeIndex = index;
    updateNowPlaying(track);
    if (track.type === "file") playFile(track, offsetMs);
    else if (track.type === "soundcloud") playSoundcloud(track, offsetMs);
  }

  // Fired when a track ends. Recomputes fresh from the wall clock rather
  // than just stepping to index+1 — self-corrects any drift from an
  // inaccurate durationSec estimate instead of compounding it.
  function advance() {
    if (!state.playing) return;
    const pos = computePosition(Date.now());
    if (!pos) return;
    playTrackAt(pos.index, pos.offsetMs);
  }

  function tuneIn() {
    const pos = computePosition(Date.now());
    if (!pos) return;
    setPlaying(true);
    playTrackAt(pos.index, pos.offsetMs);
  }

  function togglePlay() {
    if (state.playing) setPlaying(false);
    else tuneIn();
  }

  /* ------------------------------------------------------------------ Init */

  async function initStationPlayer() {
    renderBar();
    let data;
    try {
      data = await fetchJSON("data/station/queue.json");
    } catch (err) {
      console.error("Station queue failed to load:", err);
      return;
    }
    state.queue = data.tracks || [];
    state.epochMs = Date.parse(data.epoch) || 0;
    state.totalMs = state.queue.reduce((sum, t) => sum + (t.durationSec || 0) * 1000, 0);
  }

  window.initStationPlayer = initStationPlayer;
  // Exposed for tests / debugging only — not part of the page-author API.
  window.__station = { computePosition, state };
})();
