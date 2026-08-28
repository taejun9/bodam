/* global document, localStorage, window */

(() => {
  const cacheKey = "bodam.ui.theme";
  const systemQuery = "(prefers-color-scheme: dark)";
  let preference = "light";

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached === "light" || cached === "dark" || cached === "system") {
      preference = cached;
    }
  } catch {
    // The canonical Settings repository is loaded after the app starts.
  }

  let resolved = preference;
  if (preference === "system") {
    try {
      resolved = window.matchMedia(systemQuery).matches ? "dark" : "light";
    } catch {
      resolved = "light";
    }
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
})();
