// demo_pii_inject.js — PII-sladding (G23, v1). Injiseres FØR shot-/scan-/
// session-scriptene og definerer window.__demoPii med mask()/restore():
//
//   mask()    — bytt ut skjemafelt-verdier (input/textarea) med «•••••» og
//               masker e-postadresser + telefonnummer-lignende siffersekvenser
//               i synlig sidetekst. Returnerer antall maskerte steder.
//   restore() — gjenopprett alt til original tilstand.
//
// Brukes rundt html2canvas-skudd: skjermbildene går til Claude vision, inn i
// delte guider og til sky-biblioteket — de skal ikke bære brukerdata. Bevisst
// konservativt-aggressiv (ordre-/kontonummer kan også maskeres) — personvern
// før estetikk i eksporterte artefakter. Selve SIDEN røres aldri permanent.
//
// Ikke dekket i v1 (dokumentert i audit): video-OPPTAK (getDisplayMedia/
// native screencapture) og tekst brent inn i bilder (krever OCR).
(function () {
  if (window.top !== window.self) return;
  if (window.__demoPii) return;

  var EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  // Telefon-lignende: 8+ sifre totalt, med valgfrie mellomrom/bindestrek/
  // parenteser og +-prefiks. Krever sifferandel så priser à «kr 1 299» slipper.
  var PHONE = /\+?\d(?:[\s\-()]?\d){7,14}/g;

  var maskedInputs = []; // { el, value }
  var maskedNodes = [];  // { node, value }

  function maskText(t) {
    return t.replace(EMAIL, '•••@•••').replace(PHONE, function (m) {
      var digits = m.replace(/\D/g, '');
      return digits.length >= 8 ? '••• •• •••' : m; // korte tall (år, priser) slipper
    });
  }

  window.__demoPii = {
    mask: function () {
      var count = 0;
      try {
        // 1) Skjemafelt-verdier — den vanligste PII-en på innloggede sider.
        var fields = document.querySelectorAll('input, textarea');
        for (var i = 0; i < fields.length; i++) {
          var f = fields[i];
          var type = (f.getAttribute('type') || 'text').toLowerCase();
          if (type === 'button' || type === 'submit' || type === 'checkbox' || type === 'radio' || type === 'range' || type === 'hidden') continue;
          if (!f.value) continue;
          maskedInputs.push({ el: f, value: f.value });
          try { f.value = type === 'password' ? '••••••' : '•••••'; count++; } catch (e) { /* readonly */ }
        }
        // 2) E-post/telefon i synlig tekst.
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            var p = n.parentNode && n.parentNode.nodeName ? n.parentNode.nodeName.toLowerCase() : '';
            if (p === 'script' || p === 'style' || p === 'noscript') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        var node;
        while ((node = walker.nextNode())) {
          var v = node.nodeValue || '';
          if (!v.trim()) continue;
          EMAIL.lastIndex = 0; PHONE.lastIndex = 0;
          if (!EMAIL.test(v) && !PHONE.test(v)) continue;
          EMAIL.lastIndex = 0; PHONE.lastIndex = 0;
          var masked = maskText(v);
          if (masked !== v) {
            maskedNodes.push({ node: node, value: v });
            node.nodeValue = masked;
            count++;
          }
        }
      } catch (e) { /* sladding er best-effort — aldri velt skuddet */ }
      return count;
    },
    restore: function () {
      try {
        for (var i = 0; i < maskedInputs.length; i++) {
          try { maskedInputs[i].el.value = maskedInputs[i].value; } catch (e) { /* */ }
        }
        for (var j = 0; j < maskedNodes.length; j++) {
          try { maskedNodes[j].node.nodeValue = maskedNodes[j].value; } catch (e) { /* */ }
        }
      } catch (e) { /* */ }
      maskedInputs = [];
      maskedNodes = [];
    },
  };
})();
