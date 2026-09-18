// AeroSpotArrangorer.tsx — offentlig landingsside for arrangør-siden av
// AeroSpot. Rute: /aerospot/arrangorer.
//
// Bygget etter StoryBrand SB7 (Donald Miller):
//   1. Karakter (helten) = ARRANGØREN, ikke AeroSpot
//   2. Problem (ytre/indre/filosofisk)
//   3. Guide = AeroSpot (empati + autoritet)
//   4. Plan (tre steg)
//   5. Handling (direkte + overgangs-CTA)
//   6. Unngå fiasko (innsats)
//   7. Suksess (transformasjon)
//
// Selvstendig styling (scoped .as-lp) så den ikke kolliderer med appens
// globale CSS. Mørk cockpit-navy, AeroSpot-identitet.

import { useEffect } from 'react';

const MAILTO =
  'mailto:daniel@creatorhubn.com?subject=Claim%20arrangement%20i%20AeroSpot';

export default function AeroSpotArrangorer() {
  useEffect(() => {
    document.title = 'AeroSpot for arrangører';
    // Last IBM Plex (samme identitet som appen). Fjernes ved unmount.
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(fontLink);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.as-lp .reveal').forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      fontLink.remove();
    };
  }, []);

  return (
    <div className="as-lp">
      <style>{CSS}</style>
      <div className="sky" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2c.7 0 1.2.9 1.2 2.4v4.2l7.3 4.3v1.9l-7.3-2.2v4.1l2 1.5v1.5l-3.2-1-3.2 1v-1.5l2-1.5v-4.1L3.5 14.8v-1.9l7.3-4.3V4.4C10.8 2.9 11.3 2 12 2z"
                fill="#4DA3FF"
              />
            </svg>
          </span>
          <span className="wordmark">
            Aero<b>Spot</b>
          </span>
        </div>
        <div className="foreye">FOR ARRANGØRER</div>
      </header>

      <main className="wrap">
        {/* 1. HELTEN + one-liner. Arrangøren er helten; vi tegner det de vil ha. */}
        <section className="hero">
          <div className="eyebrow reveal">Flyshow · flydag · spotterdag</div>
          <h1 className="reveal">
            Fyll arrangementet med folk som <span className="b">virkelig</span> bryr
            seg.
          </h1>
          <p className="lede reveal">
            Dere har brukt måneder på å planlegge. AeroSpot passer på at
            flyfotografene og entusiastene faktisk får vite om dagen, og at{' '}
            <strong>arrangementet deres allerede ligger i appen de bruker.</strong>
          </p>
          <div className="cta-row reveal">
            <a className="btn primary" href={MAILTO}>
              Claim arrangementet ditt
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a className="btn ghost" href="#siden">
              Se hvordan siden ser ut
            </a>
          </div>
        </section>

        <hr className="runrule" />

        {/* 2. PROBLEMET — ytre / indre / filosofisk */}
        <section>
          <div className="sec-head reveal">
            <span className="sec-tag">Problemet</span>
            <h2>Et godt flyshow fortjener bedre enn å drukne i Facebook-støyen</h2>
          </div>
          <div className="prob-grid">
            <div className="prob reveal">
              <div className="pk">Rekkevidden</div>
              <p>
                Annonser treffer «alle», og dermed ingen. Fotografene og
                entusiastene dere vil ha er spredt og vanskelige å nå.
              </p>
            </div>
            <div className="prob reveal">
              <div className="pk">Uroen</div>
              <p>
                Dere har brukt måneder på å planlegge, og lurer likevel på om
                folk rekker å høre om dagen før den er over.
              </p>
            </div>
            <div className="prob reveal">
              <div className="pk">Prinsippet</div>
              <p>
                Fly som samles én gang i året fortjener et publikum som skjønner
                hva de ser, ikke tilfeldige forbipasserende.
              </p>
            </div>
          </div>
        </section>

        {/* 3. GUIDEN — empati + autoritet, med ekte app-bilde */}
        <section id="siden">
          <div className="guide-grid">
            <div className="reveal">
              <div className="sec-head">
                <span className="sec-tag">Guiden</span>
                <h2>Vi kjenner arbeidet bak en flydag</h2>
              </div>
              <p className="body">
                AeroSpot er laget sammen med flyfotografer, så vi vet hva som
                skal til for at en dag ved flyplassgjerdet blir verdt turen.
                Derfor har vi allerede lagt arrangementet deres inn i appen, med
                program, lys-timing og kart.
              </p>
              <p className="body">
                Dere overtar bare siden, får det blå{' '}
                <span className="hl">verifisert-merket</span>, og bestemmer
                innholdet selv. Fotografene er allerede der.
              </p>
              <ul className="chk">
                {[
                  'Verifisert-merke, så folk vet at infoen er offisiell',
                  'Program med lys-timing: «F-35 kl. 13:30, sol i sør»',
                  'Deltakende fly, kart over området og varsler før høydepunktene',
                  'Billett-knapp rett til deres eget salg, med klikk-sporing',
                ].map((t) => (
                  <li key={t}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="shot-wrap reveal">
              <div className="shot-glow" aria-hidden="true" />
              <div className="phone">
                <img
                  src="/aerospot-landing/act-expanded.png"
                  alt="Arrangementsside i AeroSpot med program, lys-timing, deltakende fly og billettknapp"
                  loading="lazy"
                />
              </div>
              <div className="shot-cap">Slik ser siden deres ut i appen</div>
            </div>
          </div>
        </section>

        {/* 4. PLANEN — fjerner risiko */}
        <section>
          <div className="sec-head reveal">
            <span className="sec-tag">Planen</span>
            <h2>Tre steg, så er dere synlige</h2>
          </div>
          <div className="steps">
            {[
              ['01', 'Claim', 'Ta kontakt. Arrangementet ligger allerede inne, så dere overtar bare siden.'],
              ['02', 'Verifiser', 'Vi bekrefter at dere er arrangør og setter det blå merket.'],
              ['03', 'Fyll inn', 'Legg til program, deltakende fly og billett-lenke. Vi hjelper gjerne.'],
            ].map(([n, h, p]) => (
              <div className="step reveal" key={n}>
                <div className="n">{n}</div>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6 + 7. INNSATS + SUKSESS — hva som står på spill vs. hva dere vinner */}
        <section>
          <div className="stakes-grid">
            <div className="stake fail reveal">
              <div className="sk">Uten AeroSpot</div>
              <ul>
                <li>Arrangementet drukner i Facebook-strømmen</li>
                <li>Feil folk møter opp, og de rette hører aldri om det</li>
                <li>Ingen bilder som sprer showet videre etterpå</li>
              </ul>
            </div>
            <div className="stake win reveal">
              <div className="sk">Med AeroSpot</div>
              <ul>
                <li>Fullt av folk som skjønner og verdsetter det de ser</li>
                <li>Fotografene planlegger dagen rundt programmet deres</li>
                <li>Bildene havner i community og sprer showet videre</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Fremhevet — bilde + inntektsmodell */}
        <section>
          <div className="feat-grid">
            <div className="shot-wrap small reveal">
              <div className="phone">
                <img
                  src="/aerospot-landing/featured2.png"
                  alt="Fremhevet-seksjon øverst i AeroSpots arrangementsliste"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="reveal">
              <div className="sec-head">
                <span className="sec-tag">Pris</span>
                <h2>Gratis å komme i gang</h2>
              </div>
              <div className="tiers">
                <div className="tier">
                  <div className="tk">Verifisert side</div>
                  <div className="price">Gratis</div>
                  <ul>
                    <li>Verifisert arrangørside</li>
                    <li>Program med lys-timing</li>
                    <li>Fly, venue-kart, billett-lenke</li>
                    <li>Varsler til publikum</li>
                  </ul>
                </div>
                <div className="tier paid">
                  <div className="tk">Fremhevet</div>
                  <div className="price">Oppgradering</div>
                  <ul>
                    <li>Topp-plassering i «Fremhevet»</li>
                    <li>Push til fotografer i regionen</li>
                    <li>Billett-affiliate, vi deler oppsiden</li>
                    <li>Klikk- og synlighetsstatistikk</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 5. HANDLING — transformasjonen gjentatt + CTA */}
      <footer className="foot">
        <div className="wrap">
          <hr className="runrule reveal" style={{ marginBottom: 44 }} />
          <p className="tag reveal">
            Fotografene er allerede her.
            <br />
            <span className="b">Bli med gratis.</span>
          </p>
          <p className="sub reveal">AeroSpot · daniel@creatorhubn.com</p>
          <a className="btn primary reveal" href={MAILTO}>
            Claim arrangementet ditt
          </a>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.as-lp {
  --bg:#050B14; --bg-2:#071019; --surface:#0B1522; --elevated:#111E2D;
  --line:rgba(145,160,180,0.14); --line-strong:rgba(145,160,180,0.28);
  --primary:#268CFF; --primary-bright:#4DA3FF;
  --ink:#F6F8FB; --ink-2:#A9B6C7; --ink-3:#6B7A8E;
  --success:#42D392; --gold:#F5C518;
  --f-display:"IBM Plex Sans Condensed",-apple-system,"Segoe UI",sans-serif;
  --f-body:"IBM Plex Sans",-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,monospace;
  position:relative; min-height:100vh; background:var(--bg); color:var(--ink);
  font-family:var(--f-body); line-height:1.55; overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
.as-lp *{box-sizing:border-box;}
.as-lp .wrap{max-width:1080px;margin:0 auto;padding:0 24px;}
.as-lp .sky{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(1100px 620px at 82% -10%, rgba(38,140,255,0.20), transparent 60%),
    radial-gradient(720px 480px at 6% 2%, rgba(245,197,24,0.06), transparent 62%),
    linear-gradient(180deg,var(--bg),var(--bg-2));}
.as-lp header,.as-lp main,.as-lp footer{position:relative;z-index:1;}

.as-lp .topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:18px 24px;max-width:1080px;margin:0 auto;}
.as-lp .brand{display:flex;align-items:center;gap:11px;}
.as-lp .mark{width:34px;height:34px;border-radius:9px;
  background:linear-gradient(160deg,#0E2136,#06101C);border:1px solid rgba(77,163,255,0.5);
  display:grid;place-items:center;box-shadow:0 0 22px rgba(38,140,255,0.35);}
.as-lp .mark svg{width:19px;height:19px;}
.as-lp .wordmark{font-family:var(--f-display);font-weight:700;font-size:20px;letter-spacing:.5px;}
.as-lp .wordmark b{color:var(--primary-bright);}
.as-lp .foreye{font-family:var(--f-mono);font-size:12px;color:var(--ink-3);letter-spacing:1px;}

.as-lp .hero{padding:60px 0 22px;}
.as-lp .eyebrow{font-family:var(--f-mono);font-size:12.5px;letter-spacing:3px;text-transform:uppercase;
  color:var(--gold);display:flex;align-items:center;gap:12px;margin-bottom:22px;}
.as-lp .eyebrow::after{content:"";height:1px;flex:1;background:var(--line-strong);}
.as-lp h1{font-family:var(--f-display);font-weight:700;font-size:clamp(36px,6vw,68px);
  line-height:1.03;letter-spacing:-.5px;margin:0;}
.as-lp h1 .b{color:var(--primary-bright);}
.as-lp .lede{margin:24px 0 0;max-width:58ch;font-size:18px;color:var(--ink-2);}
.as-lp .lede strong{color:var(--ink);font-weight:600;}
.as-lp .cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px;}
.as-lp .btn{font-family:var(--f-body);font-weight:600;font-size:15px;text-decoration:none;
  padding:13px 24px;border-radius:999px;display:inline-flex;align-items:center;gap:9px;cursor:pointer;}
.as-lp .btn.primary{background:var(--primary);color:#fff;box-shadow:0 8px 24px rgba(38,140,255,.35);}
.as-lp .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line-strong);}

.as-lp section{padding:44px 0;}
.as-lp .sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:24px;flex-wrap:wrap;}
.as-lp .sec-tag{font-family:var(--f-mono);font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-3);}
.as-lp h2{font-family:var(--f-display);font-weight:600;font-size:clamp(23px,3.3vw,33px);letter-spacing:-.2px;margin:0;max-width:20ch;}
.as-lp .body{color:var(--ink-2);font-size:16px;margin:0 0 16px;max-width:52ch;}
.as-lp .hl{color:var(--primary-bright);font-weight:600;}
.as-lp .runrule{height:1px;border:0;margin:0;
  background:repeating-linear-gradient(90deg,var(--line-strong) 0 22px,transparent 22px 40px);}

.as-lp .prob-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.as-lp .prob{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px 20px;}
.as-lp .prob .pk{font-family:var(--f-mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:9px;}
.as-lp .prob p{margin:0;color:var(--ink-2);font-size:14.5px;}

.as-lp .guide-grid{display:grid;grid-template-columns:1fr 0.82fr;gap:48px;align-items:center;}
.as-lp .chk{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:11px;}
.as-lp .chk li{display:flex;gap:11px;align-items:flex-start;color:var(--ink-2);font-size:15px;}
.as-lp .chk svg{width:19px;height:19px;color:var(--success);flex:none;margin-top:1px;}

.as-lp .shot-wrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:16px;}
.as-lp .shot-glow{position:absolute;inset:-6% 8% 24%;border-radius:60px;
  background:radial-gradient(closest-side,rgba(38,140,255,.30),transparent);filter:blur(36px);z-index:0;}
/* Ekte iPhone-mockup: titan-ramme + dynamic island. */
.as-lp .phone{position:relative;z-index:1;width:100%;max-width:288px;
  padding:11px;border-radius:52px;
  background:linear-gradient(145deg,#3a4048,#15181c 42%,#0a0c0e 60%,#2a2f36);
  box-shadow:
    0 40px 80px rgba(0,0,0,.55),
    inset 0 0 0 1.5px rgba(255,255,255,.10),
    inset 0 2px 3px rgba(255,255,255,.14);}
.as-lp .shot-wrap.small .phone{max-width:262px;}
.as-lp .phone img{display:block;width:100%;border-radius:42px;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.6);}
.as-lp .shot-cap{position:relative;z-index:1;font-family:var(--f-mono);font-size:11px;
  letter-spacing:1px;color:var(--ink-3);text-transform:uppercase;}

.as-lp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;border:1px solid var(--line);
  border-radius:14px;overflow:hidden;background:var(--line);}
.as-lp .step{background:var(--surface);padding:24px 22px;}
.as-lp .step .n{font-family:var(--f-mono);font-size:13px;color:var(--gold);letter-spacing:1px;}
.as-lp .step h4{font-family:var(--f-display);font-weight:600;font-size:20px;margin:8px 0 6px;}
.as-lp .step p{margin:0;font-size:14px;color:var(--ink-2);}

.as-lp .stakes-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.as-lp .stake{border-radius:14px;padding:26px 24px;border:1px solid var(--line);}
.as-lp .stake.fail{background:var(--surface);}
.as-lp .stake.win{background:linear-gradient(180deg,rgba(38,140,255,.07),var(--surface));border-color:rgba(38,140,255,.35);}
.as-lp .stake .sk{font-family:var(--f-mono);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;}
.as-lp .stake.fail .sk{color:var(--ink-3);}
.as-lp .stake.win .sk{color:var(--primary-bright);}
.as-lp .stake ul{margin:0;padding:0;list-style:none;display:grid;gap:11px;}
.as-lp .stake li{font-size:15px;color:var(--ink-2);padding-left:24px;position:relative;}
.as-lp .stake.fail li::before{content:"×";position:absolute;left:2px;top:-1px;color:var(--ink-3);font-weight:700;}
.as-lp .stake.win li::before{content:"✓";position:absolute;left:0;top:0;color:var(--success);font-weight:700;}

.as-lp .feat-grid{display:grid;grid-template-columns:0.7fr 1fr;gap:48px;align-items:center;}
.as-lp .tiers{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.as-lp .tier{border:1px solid var(--line);border-radius:14px;padding:22px 20px;background:var(--surface);}
.as-lp .tier.paid{border-color:rgba(245,197,24,.4);background:linear-gradient(180deg,rgba(245,197,24,.05),var(--surface));}
.as-lp .tier .tk{font-family:var(--f-mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--ink-3);}
.as-lp .tier.paid .tk{color:var(--gold);}
.as-lp .tier .price{font-family:var(--f-display);font-weight:700;font-size:26px;margin:6px 0 12px;}
.as-lp .tier ul{margin:0;padding:0;list-style:none;display:grid;gap:8px;}
.as-lp .tier li{font-size:13.5px;color:var(--ink-2);padding-left:18px;position:relative;}
.as-lp .tier li::before{content:"";position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--primary);}
.as-lp .tier.paid li::before{background:var(--gold);}

.as-lp .foot{padding:66px 0 64px;text-align:center;position:relative;z-index:1;}
.as-lp .foot .tag{font-family:var(--f-display);font-weight:700;font-size:clamp(26px,4vw,44px);
  letter-spacing:-.3px;line-height:1.1;margin:0 0 12px;}
.as-lp .foot .tag .b{color:var(--primary-bright);}
.as-lp .foot .sub{color:var(--ink-3);font-family:var(--f-mono);font-size:13px;letter-spacing:1px;margin-bottom:24px;}

.as-lp .reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease;}
.as-lp .reveal.in{opacity:1;transform:none;}

@media (max-width:860px){
  .as-lp .prob-grid,.as-lp .steps{grid-template-columns:1fr;}
  .as-lp .guide-grid,.as-lp .feat-grid,.as-lp .stakes-grid,.as-lp .tiers{grid-template-columns:1fr;gap:28px;}
  .as-lp .foreye{display:none;}
}
@media (prefers-reduced-motion:reduce){
  .as-lp .reveal{opacity:1;transform:none;transition:none;}
}
`;
