// Runs before first paint to avoid a theme flash. Kept as a static file (not
// inline) so the production CSP can stay `script-src 'self'`.
(function () {
  try {
    var stored = localStorage.getItem('cv-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch (_) {
    /* storage unavailable: keep the dark default from index.html */
  }
})();
