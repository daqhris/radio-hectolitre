// assets/js/router.js

import { initBroadcastPage } from "./render-page-init.js";

export function route() {
  // Broadcast pages should provide window.BROADCAST_ID
  // or include broadcast-specific containers.
  const hasBroadcastId = typeof window.BROADCAST_ID !== "undefined" && window.BROADCAST_ID;
  const hasHero = !!document.getElementById("hero-title");

  if (hasBroadcastId || hasHero) {
    return initBroadcastPage();
  }

  // If you later add more page types, route them here.
  // homepage can be routed separately.
  return Promise.resolve();
}
