// frame-transparent.js
// Runs in ALL frames (see manifest all_frames: true) but is inert everywhere except
// inside an iframe whose parent explicitly asks for a transparent background via the
// FTWR_TRANSPARENT_BG_REQUEST postMessage handshake (sent by the transparentPageOverlay
// action in content.js). Applying transparency is benign, so no origin allowlist is
// needed; the namespaced message type prevents accidental triggers.
(function () {
  'use strict';

  // Only ever act inside an embedded frame — never in the top-level page.
  if (window.self === window.top) return;

  var applied = false;

  function applyTransparentBackground() {
    if (applied) return;
    applied = true;
    // Persistent <style> tag beats the page's own body rule (e.g. global.less
    // body { background-color: #fff }) and survives framework re-renders that
    // would wipe an inline style.
    // Contingency if the frame still paints opaque: Chrome renders a cross-origin
    // iframe opaque when embedder/embeddee color-scheme differ — adding
    // `:root { color-scheme: light }` here resolves that. Not added pre-emptively.
    if (document.head && !document.getElementById('ftwr-transparent-bg')) {
      var st = document.createElement('style');
      st.id = 'ftwr-transparent-bg';
      st.textContent = 'html, body { background: transparent !important; background-color: transparent !important; }';
      document.head.appendChild(st);
    }
    if (document.body) {
      document.body.style.setProperty('background-color', 'transparent', 'important');
    }
  }

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'FTWR_TRANSPARENT_BG_REQUEST') return;
    if (event.source !== window.parent) return;
    applyTransparentBackground();
    try {
      event.source.postMessage({ type: 'FTWR_TRANSPARENT_BG_ACK' }, '*');
    } catch (e) { /* parent gone — nothing to do */ }
  });
})();
