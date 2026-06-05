// demo_shot_inject.js — kjøres ETTER html2canvas.min.js i demo-shot-vinduet.
// Tar et skjermbilde av sidens synlige viewport (html2canvas, kjører i side-
// konteksten → bypasser CORS for selve DOM-en), nedskalerer til JPEG og sender
// data-URL til Rust (demo_shot_result → demo-capture://shot). Brukes til
// scene-thumbnails OG som bilde til Claude vision.
(function () {
  if (window.top !== window.self) return;
  if (window.__demoShotDone) return;
  window.__demoShotDone = true;

  function invoke(cmd, payload) {
    try {
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, payload);
      }
    } catch (e) { /* IPC utilgjengelig */ }
    return undefined;
  }

  function downscale(canvas, maxW) {
    if (canvas.width <= maxW) return canvas;
    var c2 = document.createElement('canvas');
    c2.width = maxW;
    c2.height = Math.round(canvas.height * maxW / canvas.width);
    var ctx = c2.getContext('2d');
    if (ctx) ctx.drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2;
  }

  function shoot() {
    try {
      if (!window.html2canvas) { invoke('demo_shot_result', { ok: false, error: 'html2canvas mangler' }); return; }
      window.html2canvas(document.documentElement, {
        x: window.scrollX || 0,
        y: window.scrollY || 0,
        width: window.innerWidth,
        height: window.innerHeight,
        useCORS: true,
        logging: false,
        scale: 1,
        backgroundColor: '#ffffff',
      }).then(function (canvas) {
        var out = downscale(canvas, 1000);
        var data = out.toDataURL('image/jpeg', 0.72);
        invoke('demo_shot_result', { ok: true, dataUrl: data });
      }).catch(function (e) {
        invoke('demo_shot_result', { ok: false, error: String(e) });
      });
    } catch (e) {
      invoke('demo_shot_result', { ok: false, error: String(e) });
    }
  }

  function go() { setTimeout(shoot, 1500); } // la siden rendre før skjermbilde
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go);
})();
