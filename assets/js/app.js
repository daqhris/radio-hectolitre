import { route } from "./router.js";

function boot() {
  route().catch((err) => {
    // keep it visible in the DOM; makes debugging easier for art projects
    console.error(err);
    const el = document.getElementById("app-error");
    if (el) el.textContent = String(err?.message || err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
