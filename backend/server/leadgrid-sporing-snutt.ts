/**
 * leadgrid-sporing-snutt.ts
 *
 * Klient-halvdelen av skjema-endepunktet (mig 0652).
 *
 * Uten denne blir klikk-ID-kolonnene stående tomme. Endepunktet TAR imot
 * utm_*, gclid, fbclid og ttclid — men ingenting i nettleseren sender dem.
 * Kunden måtte skrevet den JavaScripten selv, og da gjør ingen det.
 *
 * Problemet den løser er ikke å lese en URL-parameter. Det er at parameteren
 * finnes på LANDINGSSIDEN, mens skjemaet fylles ut på kontaktsiden, kanskje
 * dager senere. Blir den ikke tatt vare på mellom de to, er attribusjonen
 * borte — og det er nøyaktig der de fleste oppsett svikter uten at noen
 * merker det.
 *
 * Leveres som en ekte JS-fil, ikke som femti linjer å lime inn: én
 * script-tag, og den kan oppdateres uten at kunden rører nettstedet sitt.
 */

/** Første berøring beholdes i 90 dager. Lengre enn en B2B-salgssyklus. */
const DAGER = 90;

/**
 * Snutten er bevisst uten avhengigheter og uten byggesteg. Den skal kunne
 * limes inn på et hvilket som helst nettsted — WordPress, Squarespace,
 * håndskrevet HTML — og virke.
 */
export function byggSporingsSnutt(opts: {
  publicKey: string;
  apiBase: string;
}): string {
  const { publicKey, apiBase } = opts;
  return `/* Leadgrid sporing. Generert for skjema ${publicKey}. */
(function () {
  "use strict";
  var LAGER = "leadgrid_attr";
  var DAGER = ${DAGER};
  var ENDEPUNKT = ${JSON.stringify(`${apiBase}/api/leadgrid/public/forms/${publicKey}/submit`)};

  function lagre(o) {
    try { localStorage.setItem(LAGER, JSON.stringify(o)); } catch (e) {}
    // Cookie som reserve: localStorage er sperret i noen nettlesere ved
    // privat modus og i enkelte innbakte visninger.
    try {
      document.cookie = LAGER + "=" + encodeURIComponent(JSON.stringify(o)) +
        ";path=/;max-age=" + (DAGER * 86400) + ";SameSite=Lax";
    } catch (e) {}
  }

  function les() {
    try {
      var s = localStorage.getItem(LAGER);
      if (s) return JSON.parse(s);
    } catch (e) {}
    try {
      var m = document.cookie.match(/(?:^|;\\s*)leadgrid_attr=([^;]*)/);
      if (m) return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {}
    return null;
  }

  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var KLIKK = ["gclid", "fbclid", "ttclid"];

  function fraUrl() {
    var p;
    try { p = new URLSearchParams(location.search); } catch (e) { return {}; }
    var ut = {};
    UTM.concat(KLIKK).forEach(function (k) {
      var v = p.get(k);
      if (v) ut[k] = String(v).slice(0, 200);
    });
    return ut;
  }

  var nytt = fraUrl();
  var lagret = les() || {};
  var na = Date.now();
  var utlopt = !lagret.t || (na - lagret.t) > DAGER * 86400000;

  var attr = utlopt ? {} : lagret;
  var harNyKampanje = UTM.some(function (k) { return nytt[k]; });

  // Kampanjen som FØRST brakte dem hit, beholdes. Kommer de tilbake via en
  // annen kampanje, er det fortsatt den første som fortjener æren for kunden
  // — ellers får den siste annonsen kreditt for arbeid den ikke gjorde.
  if (harNyKampanje && !attr.utm_campaign) {
    UTM.forEach(function (k) { if (nytt[k]) attr[k] = nytt[k]; });
    attr.landing_page_url = location.href.slice(0, 2000);
    attr.referrer_url = (document.referrer || "").slice(0, 2000);
  }
  // Klikk-ID-en er motsatt: alltid den ferskeste. Den gamle er utløpt hos
  // plattformen og kan ikke matches lenger, så en fersk er alltid bedre.
  KLIKK.forEach(function (k) { if (nytt[k]) attr[k] = nytt[k]; });

  if (!attr.t) attr.t = na;
  if (!attr.landing_page_url) {
    attr.landing_page_url = location.href.slice(0, 2000);
    attr.referrer_url = (document.referrer || "").slice(0, 2000);
  }
  if (Object.keys(attr).length > 1) lagre(attr);

  var vist = Date.now();

  function nyttelast(felt) {
    var body = {};
    Object.keys(attr).forEach(function (k) { if (k !== "t") body[k] = attr[k]; });
    Object.keys(felt || {}).forEach(function (k) { body[k] = felt[k]; });
    // _t lar endepunktet avvise innsendinger som kom raskere enn et menneske
    // kan lese og skrive. _hp er honeypot — den skal alltid være tom.
    body._t = vist;
    if (!body._hp) body._hp = "";
    return body;
  }

  // Hendelses-id deles med server-siden, så en innsending ikke telles to
  // ganger når den samme konverteringen også sendes via Events API / CAPI.
  function nyId() {
    try {
      if (crypto && crypto.randomUUID) return "lg-" + crypto.randomUUID();
    } catch (e) {}
    return "lg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  // Fyrer VERTSSIDENS egne pixler, ikke Leadgrids. ttq og fbq finnes bare om
  // nettstedet selv har lastet dem: på leadgrid.no er det våre, på en kundes
  // nettsted er det kundens. Ingen konfigurasjon, og ingen fare for at en
  // kundes henvendelse havner i vår pixel.
  //
  // Samtykke håndteres av vertssiden. Har den ikke lastet pixelen fordi
  // brukeren sa nei, finnes ikke ttq/fbq, og her skjer ingenting.
  function meldTilPixler(eventId) {
    try {
      if (typeof window.ttq !== "undefined" && window.ttq.track) {
        window.ttq.track("SubmitForm", {}, { event_id: eventId });
      }
    } catch (e) {}
    try {
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", {}, { eventID: eventId });
      }
    } catch (e) {}
  }

  function send(felt) {
    var eventId = nyId();
    var body = nyttelast(felt);
    body.event_id = eventId;
    var p = fetch(ENDEPUNKT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Meldes etter at forespørselen er sendt, aldri før: en feil i et
    // pixel-kall skal ikke kunne hindre at henvendelsen kommer fram.
    meldTilPixler(eventId);
    return p;
  }

  // Skjema merket data-leadgrid sendes automatisk. Feltene leses av name=,
  // så kunden slipper å endre HTML-en sin utover ett attributt.
  function kobleSkjema(form) {
    if (form.__leadgrid) return;
    form.__leadgrid = true;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var felt = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (el.name && el.type !== "submit" && el.type !== "button") {
          felt[el.name] = el.value;
        }
      });
      send(felt).then(function () {
        var ok = form.getAttribute("data-leadgrid-takk");
        if (ok) location.href = ok;
        else form.reset();
      }).catch(function () {
        // Skjemaet skal ikke se ut som det forsvant om nettet svikter.
        form.removeAttribute("data-leadgrid");
        form.__leadgrid = false;
        form.submit();
      });
    });
  }

  function koble() {
    Array.prototype.forEach.call(
      document.querySelectorAll("form[data-leadgrid]"), kobleSkjema);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", koble);
  } else { koble(); }

  // For dem som sender skjemaet selv.
  window.leadgrid = window.leadgrid || {};
  window.leadgrid.attribusjon = function () { return nyttelast({}); };
  window.leadgrid.send = send;
})();
`;
}
