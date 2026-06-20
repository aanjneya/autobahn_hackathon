/**
 * nav-state.js
 * Persists selected route (strecke + richtung) across user-mode page switches
 * using sessionStorage. Must be loaded BEFORE the app-specific script.
 *
 * Provides:
 *   NavState.getStrecke()   → saved strecke or 'A93'
 *   NavState.getRichtung()  → saved richtung or 'Sued'
 *   NavState.save(s, r)     → persist to sessionStorage
 *   NavState.applyToButtons() → mark the right route-toggle btn as active
 *   NavState.navigateTo(url) → save current state then navigate
 */

const NavState = (() => {
  const KEY_STRECKE  = 'nav_strecke';
  const KEY_RICHTUNG = 'nav_richtung';

  function getStrecke()  { return sessionStorage.getItem(KEY_STRECKE)  || 'A93';  }
  function getRichtung() { return sessionStorage.getItem(KEY_RICHTUNG) || 'Sued'; }

  function save(strecke, richtung) {
    if (strecke  != null) sessionStorage.setItem(KEY_STRECKE,  strecke);
    if (richtung != null) sessionStorage.setItem(KEY_RICHTUNG, richtung);
  }

  /** Mark the matching route button as active and remove active from others */
  function applyToButtons() {
    const s = getStrecke();
    const r = getRichtung();
    const routeBtns = document.querySelectorAll('#toggle .toggle__btn');
    routeBtns.forEach(btn => {
      const match = btn.dataset.strecke === s && btn.dataset.richtung === r;
      btn.classList.toggle('active', match);
    });
  }

  /**
   * Navigate to a user-mode page, saving the current route first.
   * Call from modebar buttons instead of raw window.location.href.
   */
  function navigateTo(url) {
    // Snapshot current route from active button (or already-saved state)
    const activeBtn = document.querySelector('#toggle .toggle__btn.active');
    if (activeBtn && activeBtn.dataset.strecke) {
      save(activeBtn.dataset.strecke, activeBtn.dataset.richtung);
    }
    window.location.href = url;
  }

  return { getStrecke, getRichtung, save, applyToButtons, navigateTo };
})();

// ── Auto-apply saved state once DOM is ready ──────────────────
document.addEventListener('DOMContentLoaded', () => {
  NavState.applyToButtons();
});
