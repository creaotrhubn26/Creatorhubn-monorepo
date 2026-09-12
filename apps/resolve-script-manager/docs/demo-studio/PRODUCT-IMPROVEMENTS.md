# Product Demo Studio — produkt-research & 350+ forbedringer

> Generert av multi-agent workflow (21 agenter): 362 store forbedringer på tvers av 18 kategorier, 20 funksjons-gap, konkurranse-posisjonering. Dato: 2026-06-06.

## Posisjonering — hvordan bli best i verden

For teams who today need a designer, a video editor, and a sales engineer to ship one product demo, Demo Studio is the only tool that turns a single URL into BOTH a montaged product video AND a live interactive click-through guide from one AI-directed pass — capturing the real, logged-in product (not screenshots, not an iframe) via a controlled Tauri window that defeats X-Frame-Options/CSP. Where Arcade/Storylane/Navattic make you manually capture and stitch every screen, and Tango only documents, Demo Studio's Claude Director writes the narrative, drives the recording, voices it, and self-heals when the site changes — so a non-expert pastes a link and gets a shareable, analytics-instrumented, on-brand demo in minutes. The wedge: "AI-directed, dual-output (video + interactive), real-product capture — the demo that records and re-records itself." To win, the order of battle is non-negotiable: real-product DOM-snapshot capture + runtime verification first, then cloud-hosted shareable guides with analytics + lead-gen, because without those two the AI advantage has nothing trustworthy or distributable to stand on.

**Konkurrenter å slå:** Arcade (arcade.software) — polished interactive demos, the design/UX bar · Storylane — interactive product tours + analytics + lead-gen, the PLG/sales benchmark · Navattic — no-code interactive demos, enterprise sales-led, strong analytics/CRM · Supademo — AI-first quick interactive demos + AI voiceover + localization · Tango — instant step-by-step how-to guides (capture-as-you-click), the speed/simplicity bar · Walnut — sales demo automation + personalization + demo analytics · Loom — async screen-recording video (the default many teams already use) · Reprise — enterprise demo environments (sandboxed live-app demos) · Guidde — AI video documentation with TTS voiceover · Demostack — demo environment management for sales teams · Folge / Scribe — auto-generated step documentation (support-guide niche)

## Topp-prioriteringer (bygg nå)

1. 1. Cloud project store + hosted shareable guide links (replace localStorage-only). Nothing else matters if the output can't be shared, viewed, or measured. This is the table-stakes the whole category is built on and the foundation for analytics, collaboration, and monetization.
2. 2. DOM-snapshot interactive guide capture — clone the live page into an editable interactive replica instead of thumbnail/iframe. This is the Arcade/Storylane core artifact and the basis for hotspots, branching, responsive output, and self-healing. Highest single quality lever.
3. 3. Runtime outcome verification (replace selector-string sceneActionMatch). Confirm the action ACTUALLY happened (DOM/network/vision). Today validation is a string compare — it gives false confidence and is the root cause of broken demos. Unblocks auto/assisted modes and QA.
4. 4. Embedded per-step + per-scene analytics: view, completion-rate, drop-off, CTA conversion. This is what sales/marketing buyers actually pay for and the data that powers the AI Engagement Director later. Ship with the hosted guide.
5. 5. Resilient multi-strategy locators + AI self-healing of broken selectors. Demos rot the moment the target site ships; auto-repair is the defensibility moat vs every competitor who needs manual re-capture.
6. 6. Persistent auth/session profile + reusable single capture window (one session, not a new window per step). Required to demo logged-in SaaS — the overwhelming majority of real product demos — and fixes the per-step window churn.
7. 7. Real TTS voiceover pipeline (the toggle exists with no voice source). Multi-voice, multilingual, durations driving per-scene timing. Closes the gap to Supademo/Guidde and makes the 'paste a URL → finished narrated demo' promise real.
8. 8. Cross-origin auto-execute via coordinate/vision injection (today auto-mode is blind cross-origin). Combined with the controlled Tauri window, deterministic engine-driven replay is the differentiator vs manual-capture rivals — and powers multi-take and re-record.
9. 9. Embed SDK: drop-in <script> + web component + iframe widget with lead-gate. This is how interactive demos go viral and convert on landing pages; it's the primary distribution + PLG growth loop.
10. 10. Lead-capture gate as a native scene type + CTA tracking with goals. Direct revenue attribution is the buying trigger for sales orgs and the upsell wedge vs free.
11. 11. Goal-driven Director + Director Critic self-review pass + element-anchored regi with confidence. Turn the AI from 'fills fields' into 'produces a demo that converts', the headline reason to choose this over manual tools.
12. 12. Real thumbnails/screenshots in recorder timeline + scene cards, drag-drop reorder, global undo/redo. The editor today shows empty boxes and lacks core editing affordances; this is the credibility floor before anyone trusts it for real work.

## Funksjons-gap i dagens produkt

### Gap 1: Persistence is localStorage-only — no cloud store, no shareable link, no hosting
- **Hvorfor:** Every competitor (Arcade/Storylane/Navattic/Supademo) is fundamentally a hosted-link product; a demo that can't be shared, viewed, or embedded has no distribution and no measurable value. It also caps virality, collaboration, analytics, and monetization at zero. This is the single largest gap.
- **Fiks:** Build a cloud project model with shareable short-URL links and a hosted guide/video player. Local-first cache with delta sync; separate large assets (screenshots) from project JSON as file-referenced blobs in object storage.

### Gap 2: Validation is selector-string comparison (sceneActionMatch), not runtime verification that the action succeeded
- **Hvorfor:** Confirmed in demoStudioModel.ts:314 — it compares targetSelector vs detectedSelector strings. This gives false 'Match' confidence while the actual click/scroll may have failed, producing broken demos that ship silently. It also blocks any reliable auto/assisted recording.
- **Fiks:** Add runtime outcome assertions per actionType: post-action DOM diff, navigation/URL change, network response, and Claude-vision confirmation of visible state change. Surface Match/Warning/Fail from real signal, not string equality.

### Gap 3: Interactive guide is built from thumbnail/iframe, not a cloneable DOM snapshot
- **Hvorfor:** buildInteractiveGuideHtml (demoStudioExports.ts:102) produces a static page over a screenshot or live iframe. Live iframes break on X-Frame-Options/CSP and go stale; screenshots aren't interactive. The category standard (Arcade/Storylane) is a captured editable DOM replica that feels like the real product.
- **Fiks:** Capture a sanitized DOM snapshot per scene (inline CSS/assets, strip scripts), store as the guide artifact. Enables hotspots, branching, responsive re-render, theming, and offline replay independent of the source site.

### Gap 4: No analytics/telemetry on shared demos (views, completion, drop-off, CTA conversion)
- **Hvorfor:** Analytics is the primary thing sales/marketing buyers pay for and the feedback loop that justifies an AI 'Engagement Director'. Without it the product is a creation tool with no proof of outcome — a hard sell against analytics-native rivals.
- **Fiks:** Embed a privacy-respecting telemetry beacon in hosted guides/videos: per-step funnel, completion rate, watch-time, hotspot hit-rate, CTA clicks with attribution. Per-recipient named share links.

### Gap 5: Selectors are brittle cssPath chains with no self-healing
- **Hvorfor:** Target sites change constantly; the moment a class or DOM order shifts, every downstream scene's targeting and hotspot break. Manual re-capture is exactly the pain competitors also suffer — auto-repair is the defensible moat.
- **Fiks:** Multi-strategy locators (role/text/testid/semantic + cssPath fallback) and an AI self-heal pass that re-resolves a broken selector from the stored element description + vision, with confidence scoring.

### Gap 6: Cannot demo logged-in/authenticated products reliably (no persistent session, new window per step)
- **Hvorfor:** The vast majority of real SaaS demos are behind a login. A fresh capture window per step (and no persisted auth/session) means re-authenticating constantly, losing app state, and breaking multi-step flows mid-journey.
- **Fiks:** Reuse one persistent Tauri WebviewWindow with a saved session/cookie profile across the whole capture+replay run; add a controlled login/2FA pause wizard for the auth step.

### Gap 7: Auto-mode only works same-origin web; cross-origin is blind waiting; 'assisted' continueMode is defined but unimplemented
- **Hvorfor:** The product's headline promise is 'paste a URL → AI builds and records the demo', but on any real external/cross-origin site the auto pilot can't execute, falling back to manual clicking — exactly what Tango/Loom already do. Assisted mode being a no-op widens the gap.
- **Fiks:** Drive cross-origin replay via coordinate/vision injection inside the controlled Tauri window (defeats the iframe limitation), and implement 'assisted' as half-auto with a per-step confirm prompt.

### Gap 8: No real TTS/voiceover generation despite the voiceover toggle
- **Hvorfor:** The 'finished narrated demo from a URL' promise is hollow without a voice source. Supademo/Guidde win on instant AI voiceover + localization; a silent or manually-recorded-only demo loses the non-expert and the multilingual buyer.
- **Fiks:** Wire a TTS pipeline: Claude-written script → per-scene narration audio, voice library with preview in Script Builder, durations that drive auto-timing, loudness normalization, and one-click multilingual variants.

### Gap 9: Recorder timeline shows empty cream box — no real thumbnails/screenshots
- **Hvorfor:** thumbnailDataUrl exists and is used for vision/guide, yet the recorder shows blank tiles. Editors live or die by visual scrubbing; blank tiles make the tool feel broken and unusable for serious work, undermining trust before any feature is judged.
- **Fiks:** Render captured scene screenshots as real thumbnails in the recorder timeline and scene cards; add scrubbing and a thumbnail-timeline.

### Gap 10: Video overlays — animated cursor, callouts, spotlight, auto-zoom — are hardcoded as '(kommer)' and not wired
- **Hvorfor:** Cursor motion, click ripples, zoom-to-hotspot and callouts are the difference between a raw screen recording and a polished product video; their absence puts video output below Loom-quality and far below Arcade.
- **Fiks:** Implement an overlay/compositing layer driven by actionType + hotspot: smoothed animated cursor with click ripples, auto-zoom/pan to the hotspot, and callout/spotlight masks; connect the existing toggles to the render pipeline.

### Gap 11: No embed SDK / iframe widget for distributing the interactive guide
- **Hvorfor:** Embeddable demos on landing pages are the dominant growth loop in this category (Storylane/Navattic). Without a drop-in <script>/web-component, the product can't power the highest-converting placement and loses the viral PLG flywheel.
- **Fiks:** Ship an embeddable Demo SDK: <script> snippet + web component + responsive iframe, with optional lead-gate and brand-token theming.

### Gap 12: Site context comes from anonymous reqwest (no JS rendering), missing SPA/client-rendered content
- **Hvorfor:** Modern marketing sites and apps are JS-rendered; a plain reqwest fetch sees an empty shell, so the AI Director plans the flow from incomplete/missing content and DOM scan misses dynamically injected elements.
- **Fiks:** Fetch site context via a headless JS-rendered pass (reuse the Tauri WebviewWindow), capturing post-hydration DOM, visible text, and interactive elements.

### Gap 13: AI Director plans from the front page only — no multi-page product understanding
- **Hvorfor:** A good demo narrative spans multiple features/pages; planning from one URL yields shallow, generic flows that can't tell a real product story or position against competitors — the AI's main differentiator is wasted.
- **Fiks:** Multi-page crawl (bounded) to build a feature map; goal-driven Director that selects and sequences pages/features toward a stated objective, with a Critic self-review pass.

### Gap 14: No collaboration, review, comments, approvals, or versioning
- **Hvorfor:** Demos are produced by teams (PMM writes, sales reviews, design approves). Without scene-anchored comments, approval flow, and version snapshots, the tool can't enter team workflows where competitors are entrenched.
- **Fiks:** Cloud project model with scene-anchored comment threads, per-scene approve/reject, immutable version snapshots with visual diff, and login-free review links.

### Gap 15: No lead-gen gate or CTA-with-form scene type
- **Hvorfor:** Interactive demos are a top-of-funnel conversion surface; without a native lead-capture gate and tracked CTA, the product can't show revenue attribution — the exact buying trigger for sales orgs and the primary upsell.
- **Fiks:** Add a lead-capture gate as a first-class scene type and CTA steps with form + conversion tracking tied to goals and per-recipient links.

### Gap 16: Hotspots don't track stably across scroll/resize/layout shifts; startScrollPct set but unused by web capture
- **Hvorfor:** Hotspots stored as viewport-% drift when the page scrolls or the layout reflows, so callouts point at the wrong element. Responsive Check writes startScrollPct but the recorder never pre-scrolls, so the captured frame doesn't match the planned action.
- **Fiks:** Anchor hotspots to the resolved element (re-measure on scroll/resize) rather than fixed viewport-%, and have the web recorder honor startScrollPct/switch_device by pre-positioning before capture.

### Gap 17: No PII/sensitive-data masking in screenshots, recordings, or vision payloads
- **Hvorfor:** Demos of real, logged-in products routinely expose customer names, emails, revenue. Sending unredacted screenshots to Claude vision and shipping them in shared guides is a GDPR/compliance landmine that blocks enterprise adoption outright.
- **Fiks:** DOM-aware + vision-based PII detection with a pre-flight redaction report before any export/share, redact-before-Claude guarantee, synthetic-data substitution mode, and sensitive-route guardrails.

### Gap 18: Editing UX lacks drag-drop reorder, global undo/redo, multi-select, and working command palette
- **Hvorfor:** Three separate timelines with no cross-timeline drag, no project-wide undo, and a non-functional ⌘K make iteration slow and error-prone. Editor ergonomics are the daily-use credibility floor that determines retention.
- **Fiks:** Add drag-drop scene reordering across timelines, a global undo/redo history, shift/⌘ multi-select with bulk ops, and a real ⌘K command palette over scenes and actions.

### Gap 19: 'Multiple versions' / AI Export Assistant (LinkedIn cut, teaser, GIF) are mockup cards only
- **Hvorfor:** One-click repurposing into platform-specific cuts is a core distribution multiplier (every clip shared is a growth seed) and a clear premium upsell; shipping it as a dead mockup at 0.7 opacity erodes trust in the rest of the UI.
- **Fiks:** Implement a multi-format export pipeline (9:16/1:1/16:9 auto-reframe, GIF, MP4 teaser, PDF step-guide) driven from the single master recording.

### Gap 20: No always-up-to-date 'living demo' re-capture despite site-drift being the core failure mode
- **Hvorfor:** Demos silently rot as the target product evolves; competitors increasingly offer scheduled re-capture/monitoring. Combined with self-healing selectors this is a strong retention + defensibility play.
- **Fiks:** Scheduled re-validation/re-capture with a site-drift monitor and semantic scene-diff that alerts when the target page has changed and auto-attempts repair.

## Dagens produkt (kartlegging)

I now have a complete picture across all files. Writing the structured overview.

---

# Product Demo Studio — kartlegging

**Kjernekonsept:** En Tauri-app-modul (lever i `apps/resolve-script-manager`, vises som «Story»-fane i CreativeEditorView) som forvandler en URL til en ferdig produktdemo. Brukeren limer inn en nettside-URL; AI analyserer siden, foreslår en scene-flow med manus + handling per scene, og brukeren tar opp/eksporterer enten en **montert produktvideo** eller en **selvstendig interaktiv klikk-guide**. State er ren/serialiserbar i React + localStorage (`trrpa.demoStudio.*`), ingen backend for selve modellen; AI går via Role Room Claude-proxy.

**9-stegs workflow** (UI eksponerer 6 nav-items: Create · Flow Builder · Script Builder · Guided Recorder · Device Preview · Export — de 9 stegene er den underliggende pipelinen):
1. **URL** — `makeProject(url, demoType)` velger en av 8 demo-typer (product_demo, tutorial, onboarding, sales_video, investor_demo, social_clip, support_guide, feature_walkthrough), hver med egen tone/lengde/format/device-mal.
2. **Page Analysis** — `demo_fetch_site_context` (reqwest, CORS-fri) henter tittel/description/klikkbare labels/synlig tekst; `demo_scan_dom` katalogiserer ekte interaktive elementer (`ScannedElement` med selector + hotspot i viewport-%).
3. **Scene Engine** — `flowForDemoType` seeder deterministiske scener fra maler; AI Director (`generateDemoFlow`) kan overskrive med en hel dramaturgisk flow (intro→kjernefunksjon→bevis→CTA→outro) bundet til ekte elementer.
4. **Script Builder** — per-scene narration/visualInstruction/requiredAction/overlayText, redigerbart; Tone/Audience/Language/Length-meta.
5. **Required Actions** — hver scene har `actionType` (click/scroll/type/hover/highlight/zoom/switch_device/...), `targetLabel`/`targetSelector`/`hotspot`, `continueMode` (manual/assisted/auto).
6. **Device Preview** — MacBook/iPad(stående+liggende)/iPhone-rammer (`FramedDevice`), live iframe over rammen, spill gjennom scener.
7. **Guided Recorder** — kjernen: device-preview + Required Action-panel + Step X of N. Web-opptak (getDisplayMedia) eller native capture (AVFoundation/simulator/iPhone Mirroring via Rust). Venter på manuell «Mark as Done».
8. **Validation** — `sceneActionMatch` sammenligner Expected (targetSelector) ↔ Detected (detectedSelector) → Match/Warning/Unverified; `validateScene` sjekker readiness; per-scene status + approve.
9. **Export** — montert video via `mockupRenderVideo`-pipeline (format/oppløsning/fps/voiceover/musikk), pluss tekst/bilde-leveranser.

**To output:** (a) **Video** — opptaks-klipp montert med device-mockup, polish, loudness-normalisering (ExportView). (b) **Interaktiv guide** — `buildInteractiveGuideHtml` lager en selvstendig delbar HTML med klikkbare hotspots + tooltips + steg-navigasjon (bruker thumbnail eller live iframe). Tillegg: .srt-undertekster, manus-PDF, branded thumbnail-PNG.

**AI-funksjoner:** AI Director (`generateDemoFlow`, hel flow), AI fullfør (`completeDemoFlow`, fyller kun tomme felt), per-scene generering + AI Improve (`improveScript`: shorten/clarify/professional/cta/...), **vision** (sender scene-screenshot som image-blokk til Claude), **Responsive Check** (`runResponsiveCheck` vurderer desktop/tablet/mobil + anvendbare fikser: start_scroll/switch_device/set_format).

**Capture-mekanisme:** Egne Tauri `WebviewWindow` på den EKTE målsiden (omgår X-Frame-Options/CSP). Inject-scripts (capture/scan/verify/auto/shot) sender steg via IPC-kommandoer → emittes som events (`demo-capture://step|dom|verify|auto|shot|done`) til hovedvinduet, som bygger scener med hotspot.

**Hva som åpenbart MANGLER:**
- Cursor/overlay/callouts i video er hardkodet som «(kommer)» — toggles ikke koblet til pipelinen.
- «Flere versjoner»/AI Export Assistant (LinkedIn-cut, teaser) er kun mockup-kort (opacity 0.7).
- Guided Recorder-panelets «Script/Notes»-faner og ✎/⚙-redigeringsikoner er statiske (kun «Guide» aktiv).
- Auto-modus virker kun på same-origin web (cross-origin = blind venting); `assisted` continueMode er definert men ikke implementert i opptak.
- Validering er selector-streng-sammenligning, ikke faktisk runtime-verifisering av at handlingen lyktes.
- `thumbnailDataUrl`/scene-screenshots brukes til vision/guide, men recorder-timeline viser tom cream-boks (ingen ekte thumbnail).
- Ingen lyd/TTS-generering for voiceover (toggle finnes, men kilde for stemme er uklar).
- localStorage-only persistens — ingen sky-lagring/deling/samarbeid på prosjektnivå.
- `startScrollPct` settes av Responsive Check men brukes ikke synlig av web-opptaket til å pre-scrolle.

Relevante filer (alle absolutte): `/Users/danielqazi/monorepo-demo-studio/apps/resolve-script-manager/src/components/demo-studio/{DemoStudioShell,ScriptBuilderView,GuidedRecorderView,ExportView}.tsx` + `{demoStudioModel,demoStudioAI,demoStudioExports,demoStudioStore}.ts` og `src-tauri/src/demo_capture.rs`.

## De 362 forbedringene

### Capture-motor (DOM, robusthet, SPA-er, innloggede/auth-sider, iframe-fri capture)

1. **Resilient multi-strategy locators (ikke skjøre cssPath-kjeder)** [high · L · ★differentiator]  
   Erstatt dagens nth-of-type cssPath med en lagdelt locator-modell som lagrer flere uavhengige fingeravtrykk per element (role+accessible name, data-testid, stabil tekst, attributt-signatur, DOM-anker + geometri), og rangerer dem ved replay. Dette er kjernen for at scener overlever re-renders, hashede CSS-klasser og A/B-varianter — der konkurrentenes ett-selector-tilnærming knekker.
2. **AI self-healing av brutte selektorer** [high · M · ★differentiator]  
   Når en lagret locator ikke matcher ved replay, send Claude den nye DOM-en + scenens intensjon (label/role/screenshot) og la den foreslå ny target, så scenen reparerer seg selv i stedet for å feile. Forvandler 'demoen din er utdatert' fra en blocker til en automatisk fiks.
3. **Ekte readiness-deteksjon i stedet for setTimeout(1200)** [high · M]  
   Bytt de hardkodede 1200 ms-ventene i scan/auto/shot mot en observer som venter på network-idle, MutationObserver-ro og at target-elementet faktisk er synlig/interaktivt. Eliminerer flakey capture på trege SPA-er og fjerner både falske tomme skann og for-tidlige skjermbilder.
4. **Persistent auth-/session-profil for innloggede sider** [high · M · ★differentiator]  
   Gi capture-vinduene en dedikert, gjenbrukbar WebView-datamappe slik at cookies/localStorage/SSO-sesjon overlever mellom scan/capture/auto/shot-vinduer og mellom økter. Uten dette kan produktet aldri demo'e bak innlogging — den enkeltstørste blockeren for B2B-SaaS-demoer.
5. **Én sammenhengende capture-/replay-sesjon (ikke nytt vindu per steg)** [high · L · ★differentiator]  
   I dag åpner demo_auto_execute et friskt vindu per handling og mister all state; bygg en langlivet capture-sesjon som holder ett vindu åpent og spiller hele scene-sekvensen i rekkefølge. Først da kan man auto-demo'e flertrinns-flyt (logg inn → naviger → fyll skjema → bekreft).
6. **Shadow-DOM- og web-components-gjennomtrenging** [high · M · ★differentiator]  
   Dagens querySelectorAll ser ikke inn i shadow roots, så hele rammeverk (Salesforce LWC, mange design-systemer, Stripe-elementer) blir usynlige. Rekursiv shadow-piercing scan + composedPath-basert click-capture gjør disse sidene capture-bare.
7. **Iframe-aware capture (fjern window.top-guarden)** [medium · M · ★differentiator]  
   Alle inject-scripts bailer med `if (window.top !== window.self) return`, så betalings-iframes, embeds og innleide widgets ignoreres helt. Inject i alle frames med frame-koordinat-translasjon til toppviewport gir korrekte hotspots på sider som faktisk bruker iframes.
8. **SPA route-change-deteksjon uten full reload** [high · M]  
   Capture-stegtelleren er avhengig av full navigasjon + re-inject via sessionStorage; patch history.pushState/replaceState/popstate slik at klient-side ruteendringer registreres som scene-overganger med ny URL/skjermbilde. Avgjørende for React/Vue/Next-apper som aldri laster om.
9. **Full input-vokabular i capture (ikke bare click)** [high · M]  
   Utvid event-capture fra kun click til keyboard-input, select/dropdown-valg, dra-og-slipp, hover-menyer, fil-opplasting og kopiering, med korrekt actionType per interaksjon. Ekte produktflyter er sjelden bare klikk — dette fanger demoen slik den faktisk utføres.
10. **Runtime-verifisering av at handlingen faktisk lyktes** [high · L · ★differentiator]  
   sceneActionMatch sammenligner bare selector-strenger; legg til post-action assertion (DOM-diff, URL-endring, ny synlig tekst, network-respons) som beviser at klikket gjorde noe. Hever validering fra 'samme selector' til 'handlingen virket', noe ingen klikk-guide-konkurrent gjør.
11. **Headless JS-rendret site-kontekst (ikke anonym reqwest)** [high · S]  
   demo_fetch_site_context henter rå HTML uten JS og uten sesjon, så SPA-er og innloggede sider gir tom/feil kontekst til AI Director. Hent konteksten fra det faktiske gjengitte DOM-et i et WebView (med sesjon) i stedet. Gir AI ekte innhold å skrive scener fra.
12. **AI vision-basert element-deteksjon som fallback** [medium · L · ★differentiator]  
   Når DOM-selektorer er umulige (canvas-apper, WebGL, Flutter-web, kraftig obfuskert markup), la Claude vision lokalisere target visuelt fra skjermbildet og returnere koordinat-hotspot. Gjør produktet til det eneste som kan demo'e pikselbaserte apper.
13. **Cross-origin auto-execute via koordinat-injeksjon** [medium · L · ★differentiator]  
   Auto-modus er i praksis blind på cross-origin fordi den er avhengig av at injisert JS finner selector; legg til en native CDP/synthetic-input-vei som kan klikke på koordinat uansett opprinnelse. Fjerner 'auto virker kun på same-origin'-begrensningen helt.
14. **2FA-/login-veiviser med kontrollert manuell pause** [high · M · ★differentiator]  
   Tilby en eksplisitt 'logg inn nå'-modus der brukeren fullfører innlogging/2FA i capture-vinduet, og motoren venter til autentisert tilstand er nådd før opptak starter — uten å lagre passord. Gjør sensitive interne verktøy demobare på en trygg, forklarbar måte.
15. **Stabil hotspot-tracking ved scroll/resize/layout-skift** [medium · M]  
   Hotspots lagres som ett statisk viewport-% øyeblikksbilde; bind dem i stedet til en levende locator som re-måles ved replay/eksport slik at callouts treffer riktig selv om layout flytter seg. Hindrer at den interaktive guiden peker på feil sted.
16. **Demo-safe seed-data og scrubbing av sensitiv info** [medium · L · ★differentiator]  
   Ved capture på ekte/innloggede kontoer, auto-detekter og maskér PII (e-post, navn, beløp, kundedata) i skjermbilder/DOM og tilby substitusjon med demo-data. Lar bedrifter trygt demo'e produksjonsdata — en compliance-funksjon konkurrentene mangler.
17. **Deterministisk replay-opptak (motoren styrer, ikke manuell klikking)** [high · L · ★differentiator]  
   La capture-motoren spille hele den verifiserte scene-sekvensen selv mens den tar opp video, med jevn syntetisk cursor og timede handlinger, i stedet for å vente på menneskelig 'Mark as Done'. Gir perfekte, reproduserbare opptak hver gang og fjerner menneskelig flakiness.
18. **Network-/loading-aware fangst av async-resultater** [medium · M]  
   Mange aha-øyeblikk er asynkrone (søkeresultat, AI-svar, lastet dashboard); instrumentér fetch/XHR slik at motoren venter på at riktig respons har landet og UI-et er ferdig før den fanger skjermbilde/neste steg. Unngår at demoen viser spinnere i stedet for resultatet.
19. **Robusthets-/forhåndskjøring med selvtest av hele flyten** [medium · M · ★differentiator]  
   Før eksport, kjør hele scene-sekvensen i et headless-pass som rapporterer hvilke steg som fant target, lyktes og forble stabile på tvers av desktop/tablet/mobil — en 'capture confidence'-score per scene. Gir brukeren tillit til at demoen ikke knekker live.
20. **DOM-snapshot-arkiv for offline replay og fremtidig reparasjon** [medium · L · ★differentiator]  
   Lagre en lettvekts serialisert DOM+stil-snapshot (ikke bare et bilde) per scene, slik at den interaktive guiden kan gjengis offline/uten å treffe live-siden, og slik at self-healing har fasit å sammenligne mot ved senere site-endringer. Kombinerer arkivverdi med reparerbarhet på en måte ingen klikk-guide-verktøy har.

### Interaktiv guide-output i verdensklasse (Arcade/Storylane/Navattic-nivå: branching, hotspots, chapters, embed)

21. **DOM-snapshot capture (cloneable interactive replica, ikke screenshot)** [high · L · ★differentiator]  
   Utvid demo_shot_inject.js til a serialisere hele DOM-treet (inlined computed styles + ressurser som data-URI) til en selvstendig, klikkbar HTML-klone per steg, slik Arcade/Navattic gjor. Dette er kategoriens kjernedifferensiator: brukeren far en pixel-perfekt, fullt interaktiv replika de kan redigere (sladde tekst, bytte bilder, fikse typos) uten a ta opp pa nytt, i stedet for en flat thumbnail eller en CSP-blokkert live iframe.
22. **Branching/choose-your-own-path mellom steg** [high · L · ★differentiator]  
   Utvid DemoScene med nextSceneId-mapping per hotspot/valg + en grenede-flow-modell, og rendre forgreninger i buildInteractiveGuideHtml. Lar en demo vise ulike spor for ulike personas (admin vs sluttbruker) eller features, noe lineaere slideshows ikke kan og som Storylane/Navattic tar betalt for.
23. **Flere hotspots + sekvensielle steg per skjermbilde** [high · M]  
   Bytt scenens enkelt-hotspot mot en array av hotspots/annotasjoner (pil, callout, blur-maske, tekstboks) som kan vises samtidig eller i rekkefolge pa samme skjerm. Verdensklasse-guider legger ofte 3-5 annotasjoner pa ett skjermbilde; dagens en-hotspot-per-steg tvinger frem unaturlig mange steg.
24. **Sky-hosting + delbar lenke med kort-URL** [high · L]  
   Erstatt localStorage-only med backend-persistens (Role Room-API) som publiserer guiden pa en delbar URL (f.eks. demo.theroleroom.com/g/abc123) i stedet for en nedlastet HTML-fil. Deling via lenke er bordstaver i kategorien; en fil-pa-disk kan verken oppdateres, spores eller embedded.
25. **Embed-modus (iframe + script-snippet + responsiv)** [high · M]  
   Generer en embed-kode (script-tag som injiserer en responsiv iframe, samt rene iframe- og inline-varianter) slik at guiden kan limes inn pa landingssider, i blogginnlegg og i Notion. Embedding er hovedkanalen for Arcade/Storylane-konvertering og apner produktet for PLG-bruk hos kundene.
26. **Per-steg analytics-funnel + completion-rate** [high · L · ★differentiator]  
   Legg inn lettvekts event-beacons (step_view, step_complete, hotspot_click, cta_click, drop-off) i den publiserte guiden som rapporterer til et analytics-endepunkt, med dashboard i Demo Studio. A vite NOYAKTIG hvilket steg folk faller av pa er den storste verdien Navattic/Storylane selger; ingen video gir dette.
27. **Lead-gen gating + CTA-steg med skjema** [high · M · ★differentiator]  
   Legg til en sceneType for lead-skjema/CTA (e-post-capture, kalender-booking, custom felt) som kan settes inn midt i eller pa slutten av guiden, med leads levert til CRM-en (Universal CRM finnes allerede i monorepoet). Gating + lead-capture er hvordan disse verktoyene tjener penger for kundene; CRM-koblingen er en unik moat for dere.
28. **Personalisering med variabler/tokens** [medium · M · ★differentiator]  
   Stott {{firstName}}, {{company}}, {{logo}}-tokens i narration/overlay/tittel som fylles fra URL-parametere eller en API-payload, slik at en demo kan personaliseres per prospect uten reopptak. Storylane/Navattic priser dette hoyt for ABM-salg; det gjor en generisk demo til hundrevis av navngitte demoer.
29. **Kapitler/seksjonering med navigerbar innholdsmeny** [medium · M]  
   Grupper scener i navngitte kapitler med en hopp-til-meny og progresjonsindikator i den publiserte guiden. Lange demoer (investor/feature_walkthrough) blir uoversiktlige som flat steg-rekke; kapitler lar seeren hoppe til det de bryr seg om og oker fullforing.
30. **Theming/white-label brand-kit per prosjekt** [high · M]  
   Erstatt den hardkodede oransje paletten i buildInteractiveGuideHtml med et brand-kit (logo, primaer/sekundaerfarge, font, favicon, custom domene) lagret pa prosjektet og anvendt pa guide + thumbnail + embed. White-labeling er et betalt enterprise-trekk hos alle konkurrentene og kreves for at kundens demo skal se ut som kundens produkt.
31. **WYSIWYG live-editor for den publiserte guiden** [high · L · ★differentiator]  
   Bygg en direkte-pa-snapshot-editor der brukeren klikker pa elementer i den fangede DOM-en for a flytte hotspots, redigere tekst, sladde sensitive data og legge til annotasjoner, i stedet for a redigere abstrakte scene-felter i Script Builder. Den visuelle redigeringsopplevelsen er der Arcade vinner; felt-skjemaer foles som verktoy, ikke som magi.
32. **Auto-zoom og smart kamera-bevegelse pa hotspots** [medium · M · ★differentiator]  
   I bade video- og guide-output, animer en myk zoom/pan inn mot det aktive hotspotet (Ken Burns pa UI) basert pa hotspot-rektangelet som allerede finnes. Auto-zoom pa interaksjonspunktet er Arcades signatur-foliese; det gjor sma UI-detaljer lesbare og foler seg dyrt produsert uten manuelt arbeid.
33. **Ekte runtime-validering av at handlingen lyktes** [medium · M]  
   Erstatt selector-streng-sammenligningen i sceneActionMatch med faktisk runtime-sjekk via demo_verify_inject.js (DOM-mutasjon observert, URL endret, element ble synlig) sa validationRule evalueres mot virkeligheten. Dagens validering kan si Match selv om klikket ikke gjorde noe; ekte verifisering gir tillit til at demoen faktisk fungerer.
34. **Interaktiv try-it-selv-modus (sandboxed clickthrough)** [high · L · ★differentiator]  
   La seeren faktisk klikke seg gjennom DOM-snapshot-replikaen selv (gated til de riktige hotspotene), ikke bare trykke Neste. Navattics interaktive demoer konverterer fordi prospektet FOLER produktet; en passiv slideshow gjor det ikke.
35. **TTS-voiceover-generering for narration** [medium · M]  
   Koble narration-feltene til en TTS-tjeneste (f.eks. via Claude-proxy/ElevenLabs) som genererer naturlig tale per scene, brukt bade i video-render og som valgfri lyd i guiden. Voiceover-toggelen finnes allerede uten lydkilde; auto-stemme fjerner det storste manuelle steget i a lage en ferdig demovideo.
36. **A/B-testing av guide-varianter** [medium · M · ★differentiator]  
   Tillat publisering av flere varianter (ulik rekkefolge, CTA-tekst, gating av/pa) under samme lenke med automatisk trafikk-splitt og vinner-rapport koblet til analytics-funnelen. A/B pa demoer er et hoy-tier konkurransetrekk og en naturlig forlengelse nar analytics + hosting forst er pa plass.
37. **Responsiv guide som rendrer ekte mobil-snapshot** [medium · M]  
   Bruk Responsive Check + startScrollPct til a fange separate desktop/tablet/mobil DOM-snapshots og servere riktig variant etter seerens skjerm, i stedet for a skalere en desktop-iframe. startScrollPct settes allerede men ignoreres av output; ekte responsive snapshots gjor embedded guider profesjonelle pa mobil.
38. **Kommentar/godkjenning + delbare review-lenker** [medium · M]  
   Legg til en del-til-review-modus der teammedlemmer eller kunder kan kommentere pa enkeltsteg (pin pa hotspot) og godkjenne, lagret pa prosjektet. Demoer lages sjelden alene; innebygd review-flyt (som dere alt har monster for i Story Arc) fjerner Loom/e-post-frem-og-tilbake og holder folk i appen.
39. **Auto-redigering/PII-sladding av sensitive data** [medium · M · ★differentiator]  
   Kjor en Claude-vision/regel-pass over fangede snapshots som auto-detekterer og blurrer e-poster, navn, kortnummer og avatars, med manuell overstyring. Demoer av ekte produkter lekker konstant kundedata; auto-sladding er et tillits- og compliance-trekk konkurrentene saavidt har og som passer Claude-stacken deres perfekt.
40. **Multi-format eksport-pipeline (GIF, MP4-klipp, LinkedIn-cut, PDF-guide)** [medium · L · ★differentiator]  
   Realiser de i dag mockup-bare eksport-kortene: generer korte auto-loop-GIF-er, plattform-tilpassede sosiale klipp og en print-PDF-versjon av den interaktive guiden fra samme scene-modell. En guide som ogsa spytter ut delbare GIF-er og sosiale cuts dekker hele distribusjonsbehovet i ett verktoy, noe ingen enkelt konkurrent gjor godt.

### AI Director & manus (smartere flow-generering, mål-drevet, persona, A/B)

41. **Goal-driven Director (mål → flow)** [high · M · ★differentiator]  
   Erstatt den frie demo-type-malen med et eksplisitt mål-objekt (f.eks. 'øk trial-signups', 'reduser support-tickets på X', 'lukk enterprise-deal') som Director optimaliserer hele dramaturgien, scene-rekkefølgen og CTA-en mot. Stort fordi det flytter produktet fra 'lag en demo' til 'lag en demo som konverterer', som er det kjøpere faktisk betaler for.
42. **Persona-styrt manus per målgruppe** [high · M · ★differentiator]  
   Innfør et førsteklasses persona-objekt (rolle, smerter, innvendinger, teknisk nivå, beslutningsmakt) som injiseres i alle Director-prompts og styrer ordvalg, hvilke funksjoner som vises, og hvilke innvendinger manuset proaktivt motbeviser. Stort fordi samme produkt trenger radikalt ulik demo for en CFO vs. en utvikler, og ingen konkurrent gjør persona til en strukturert akse.
43. **Én demo → mange persona-/språk-varianter på ett klikk** [high · L · ★differentiator]  
   La Director generere et helt sett parallelle varianter av samme grunn-flow (per persona, språk, lengde og format) som deler scene-skjelett men har egen narration/overlay/CTA, holdt i synk via en delt 'master story'. Stort fordi det gjør personalisering i skala triviell og fyller de allerede skisserte 'flere versjoner'-mockup-kortene med ekte verdi.
44. **Innebygd A/B-/multivariant-eksperimentering med vinner-tracking** [high · L · ★differentiator]  
   Generer to-tre manus-/hook-/CTA-varianter med eksplisitt hypotese per variant, eksporter med UTM/event-tags, og hent konverterings-signaler tilbake (manuell innliming eller webhook) slik at Director lærer hvilken vinkel som vant. Stort fordi det lukker loopen fra 'AI gjettet et manus' til 'data viser hvilket manus som faktisk konverterer'.
45. **Story-modell med eksplisitt narrativ-bue og spennings-kurve** [high · M · ★differentiator]  
   Modellér hver scene mot en narrativ rolle (hook/problem/stakes/aha/proof/objection-handling/CTA/outro) og en mål-spenningskurve, så Director kan kvalitetssjekke at flowen faktisk har dramaturgi i stedet for en flat funksjonsliste. Stort fordi det gjør 'god historie' til noe systemet kan måle og forbedre, ikke bare håpe på.
46. **Director Critic-pass (selv-kritikk før levering)** [high · M · ★differentiator]  
   Etter generering kjører et eget Claude-pass som scorer flowen mot rubrikker (klarhet, hook-styrke, lengde-budsjett, CTA-styrke, persona-match) og foreslår konkrete edits, vist som aksepterbare diff-forslag. Stort fordi en innebygd redaktør hever kvaliteten dramatisk uten å kreve at brukeren selv er en god manusforfatter.
47. **Konkurrent-bevisst posisjonering** [medium · M · ★differentiator]  
   La brukeren angi konkurrenter (eller la Director hente kontekst), og generer manus som subtilt fremhever differensiatorene mot navngitte alternativer uten å virke aggressivt. Stort fordi salgsdemoer i praksis alltid selges mot et alternativ, og en demo som adresserer 'hvorfor ikke X' konverterer langt bedre.
48. **Dyp produktforståelse via flersides crawl, ikke bare forsiden** [high · M · ★differentiator]  
   Utvid site-konteksten fra én URL til en styrt crawl av pricing/features/docs/changelog (via det eksisterende Tauri reqwest-laget, CORS-fritt) som bygger et strukturert produkt-faktablad Director bruker. Stort fordi manuskvaliteten i dag er begrenset av ~1500 tegn forsidetekst; ekte produktforståelse er hele forskjellen på generisk vs. presist manus.
49. **Lengde-/tids-budsjett som hard constraint med per-scene allokering** [medium · S]  
   Gjør targetSeconds til et reelt budsjett Director fordeler eksplisitt per scene basert på narrativ viktighet, og som validerer at sum(narration-lesetid) faktisk passer scene-varigheten (ord/min-estimat). Stort fordi demoer som sprenger tidsbudsjettet er den vanligste feilen, og presis tids-styring er noe ingen lavkode-konkurrent leverer.
50. **Brand voice-profil (lær tonen fra eksisterende materiell)** [medium · M · ★differentiator]  
   La brukeren lime inn eller peke på eksisterende markedstekst/transkripsjoner slik at Director ekstraherer en gjenbrukbar 'brand voice'-profil (ordforråd, setningslengde, do/don't) som overstyrer den generiske tonen. Stort fordi enterprise-kunder krever at demoen høres ut som DEM, ikke som en generisk AI.
51. **Innvendings-bibliotek og proaktiv motargumentasjon** [high · M · ★differentiator]  
   Vedlikehold et persistent bibliotek av kjente kjøper-innvendinger per persona, og la Director eksplisitt plante motbevis i relevante scener (med en 'objection handled'-markør i story-modellen). Stort fordi de beste sales-demoene fjerner tvil før den oppstår, og dette systematiserer en ferdighet de fleste mangler.
52. **Conversational Director (chat-redigering av hele flowen)** [high · M · ★differentiator]  
   Legg til en samtale-flate der brukeren styrer Director i naturlig språk ('gjør scene 3 kortere og mer teknisk', 'flytt CTA tidligere', 'legg til en ROI-scene') og får strukturerte scene-diffs tilbake. Stort fordi det erstatter felt-for-felt-redigering med intensjons-drevet regi og matcher hvordan folk faktisk tenker om historien.
53. **Hook-generator med flere konkurrerende åpninger** [medium · S]  
   Generer fem distinkte hook-vinkler (problem, statistikk, kontroversiell påstand, før/etter, nysgjerrighets-gap) for de første to sekundene og la brukeren velge eller A/B-teste. Stort fordi hooken avgjør om noen i det hele tatt ser resten, særlig for social_clip, og den fortjener dedikert AI-behandling.
54. **Element-forankret regi med begrunnelse og confidence** [medium · S · ★differentiator]  
   Få Director til å begrunne HVORFOR hvert element ble valgt fra DOM-katalogen og angi en confidence-score, så svake bindinger (gjettet hotspot uten targetIndex) flagges visuelt for brukerkontroll. Stort fordi tillit til AI-valgene er avgjørende, og confidence + begrunnelse gjør at brukeren stoler på og kan korrigere regien raskt.
55. **Format-spesifikk regi (omskriv samme historie for 9:16 vs 16:9)** [high · M · ★differentiator]  
   La Director re-regissere en eksisterende flow når format/plattform endres (TikTok-tempo og tekst-tunge overlays vs. rolig 16:9 sales-video), ikke bare endre aspect ratio. Stort fordi en 90-sekunders desktop-demo og en 25-sekunders vertikal klipp er fundamentalt ulike historier, ikke samme video beskåret.
56. **Voiceover-bevisst manus (skriv for stemme, ikke for øyet)** [medium · M]  
   Få Director til å produsere narration optimalisert for TTS/innspilling med uttale-hints, pauser, vekt-markeringer og forbud mot tunge tall/forkortelser, koblet mot den planlagte voiceover-toggelen. Stort fordi tekst som leser bra på skjerm ofte høres robotisk ut opplest, og dette gjør den manglende lyd-pipelinen profesjonell fra dag én.
57. **Story-maler fra vinner-demoer (lærbart mønster-bibliotek)** [medium · M · ★differentiator]  
   Bygg et kuratert bibliotek av høyt-konverterende demo-arketyper (PLG-onboarding, enterprise-evaluering, investor-pitch) som strukturerte story-skjeletter Director instansierer mot det konkrete produktet. Stort fordi det gir nybegynnere tilgang til proven dramaturgi i stedet for å starte fra en generisk seks-scene-mal.
58. **Adaptiv re-regi fra valideringssignaler** [high · M · ★differentiator]  
   Når validering/Responsive Check/recorder avdekker at et element mangler, er under fold eller handlingen ikke kunne verifiseres, lar Director automatisk foreslå en omskrevet scene (annet element, scroll-først, device-bytte) i stedet for bare å flagge feil. Stort fordi det gjør Director til en aktiv problemløser i hele loopen, ikke bare en engangs-generator.
59. **ROI-/verdi-scene med automatisk tallinnsetting** [medium · M]  
   La brukeren oppgi nøkkeltall (tidsbesparelse, pris, kundestatistikk) eller la Director hente dem fra pricing-siden, og generer en datadrevet verdi-/proof-scene med konkrete tall og dynamiske overlays. Stort fordi konkrete tall er det mest overbevisende elementet i en B2B-demo, og automatisk innsetting fjerner den mest tidkrevende manuelle jobben.
60. **Forklarbar regi-tidslinje med versjonering og angre** [medium · M · ★differentiator]  
   Lagre hver Director-kjøring som en navngitt, gjenopprettbar versjon med en lesbar 'regi-logg' (hvorfor scener kom/forsvant, hvilken persona/mål som drev valgene) og diff mot forrige. Stort fordi brukere må kunne eksperimentere fryktløst og forstå AI-ens beslutninger; sporbar, reversibel regi er det som gjør en AI Director trygg å stole på i produksjon.

### Vision & multimodal AI (Claude ser UI, auto-annotering, auto-hotspots, OCR)

61. **Claude-Vision auto-annotering av hver opptaks-frame** [high · M · ★differentiator]  
   Send hver opptatt scene-frame til Claude som image-blokk og la den returnere strukturerte callouts (boks + tekst + pil) bundet til viewport-koordinater, slik at video- og guide-eksport automatisk får profesjonelle annoteringer uten manuelt arbeid. Stort fordi det lukker det hardkodede '(kommer)'-gapet og er selve kjernen i kategorien.
62. **OCR-basert hotspot-deteksjon som fallback for DOM-scan** [high · M · ★differentiator]  
   Kjør OCR (Tesseract/Vision-API via Rust) på frame-screenshots for å lokalisere knapper/tekst når DOM-scan feiler (canvas-apper, video, cross-origin captures), og match OCR-bokser mot scenens targetLabel. Stort fordi det gjør auto-hotspots robust på sider hvor selector-tilnærmingen er blind i dag.
63. **Vision-basert runtime-verifisering av at handlingen lyktes** [high · M · ★differentiator]  
   Erstatt selector-streng-sammenligningen i sceneActionMatch med at Claude sammenligner før/etter-frames og bekrefter at den forventede tilstandsendringen faktisk skjedde (modal åpnet, side scrollet, felt fylt). Stort fordi validering blir ekte funksjonell verifisering, ikke streng-likhet.
64. **Auto-følg cursor: Claude foreslår animert markør-bane mellom hotspots** [high · M · ★differentiator]  
   La Claude regne ut en naturlig markør-bane og timing mellom forrige og nåværende hotspot, og bake en animert cursor inn i video-pipelinen. Stort fordi cursor-overlay i dag er '(kommer)' og dette gir polerte, menneskelige demoer automatisk.
65. **Semantisk scene-diff: Claude oppdager når målsiden har endret seg** [high · M · ★differentiator]  
   Lagre baseline-frame per scene og kjør vision-diff ved re-opptak slik at Claude flagger 'knappen heter nå Kjøp, ikke Bestill / layout flyttet' og foreslår oppdatert selector/hotspot. Stort fordi demoer råtner når produktet endrer UI, og selvhelende demoer er unikt i kategorien.
66. **Full-side vision-storyboard fra ett enkelt scroll-capture** [high · M · ★differentiator]  
   Ta én lang full-page screenshot, la Claude segmentere den i logiske seksjoner (hero, features, pricing, CTA) og auto-generere en scene-flow med hotspots forankret i de detekterte seksjonene. Stort fordi det gjør URL→ferdig flow til ett klikk basert på faktisk visuell layout, ikke bare DOM-labels.
67. **Vision-drevet Responsive Check med faktiske breakpoint-screenshots** [medium · M · ★differentiator]  
   Utvid runResponsiveCheck til å rendre siden i desktop/tablet/mobil-bredder, sende alle tre frames til Claude, og la den peke ut konkrete visuelle brudd (overlappende tekst, avkuttet CTA) med koordinater. Stort fordi vurderingen blir grunnet i ekte pikslere fremfor heuristikk.
68. **Auto-generert voiceover via TTS synket til vision-detekterte handlinger** [high · L]  
   Koble narration-feltet til en TTS-motor og tids-juster lyden til når Claude-vision ser at handlingen faktisk skjer i opptaket, ikke til fast scene-lengde. Stort fordi det lukker det manglende voiceover-kildegapet og gir lip-sync-presis fortelling.
69. **Vision-basert auto-zoom og smart kamera (Ken Burns på UI)** [high · M · ★differentiator]  
   La Claude identifisere det viktigste elementet i hver frame og auto-generere zoom/pan-keyframes mot det, slik at små UI-detaljer blir tydelige i video uten manuell redigering. Stort fordi det gir Screen Studio-klasse polish drevet av modellens forståelse av hva som betyr noe.
70. **Multimodal 'Demo Critic' som scorer den ferdige demoen** [medium · S · ★differentiator]  
   Send det monterte resultatet (frames + manus) tilbake til Claude for en holistisk kritikk: klarhet, pacing, om CTA er tydelig, om hotspots peker riktig, med konkrete fiks-forslag. Stort fordi ingen konkurrent gir en AI-regissør-gjennomgang av sluttproduktet før publisering.
71. **Live vision-styrt auto-modus for cross-origin opptak** [high · L · ★differentiator]  
   I den native WebviewWindow, la Claude-vision se hver frame i sanntid og avgjøre når neste handling kan utløses (knappen er synlig/klikkbar), slik at auto-modus virker på cross-origin sider hvor det i dag bare blindt venter. Stort fordi det fjerner den største opptaks-begrensningen.
72. **Auto-redigering av sensitiv info via vision-deteksjon (PII-blur)** [high · M · ★differentiator]  
   La Claude-vision oppdage e-poster, navn, kortnumre, tokens og ekte kundedata i frames og automatisk blurre dem i eksporten. Stort fordi demoer av ekte produkter konstant lekker PII, og auto-redigering er en kritisk enterprise-blokkering konkurrenter ignorerer.
73. **Vision-forankrede interaktive hotspots som spores på tvers av frames** [medium · S]  
   I buildInteractiveGuideHtml, la Claude-vision verifisere at hver hotspot-koordinat faktisk treffer det riktige elementet i thumbnailen og justere posisjonen, så den selvstendige guiden aldri peker på tom plass. Stort fordi guide-presisjon er det som skiller en delbar produktdemo fra en frustrerende.
74. **Naturlig-språk redigering av video via vision-forståelse** [high · L · ★differentiator]  
   La brukeren skrive 'hopp over login-scenen og zoom mer på prising', og Claude redigerer flow + keyframes ved å forstå hvilke frames som tilhører hvilken intensjon. Stort fordi det gjør redigering konversasjonell på toppen av modellens visuelle scene-forståelse.
75. **Auto-undertekst med vision-bekreftet on-screen-tekst-synk** [medium · S]  
   Generer .srt der Claude i tillegg leser on-screen-tekst (OCR) for å unngå at undertekst kolliderer visuelt med UI-tekst og for å tidssette mot det som faktisk vises. Stort fordi undertekstene blir kontekst-bevisste fremfor blinde tidsstempel.
76. **Vision-drevet thumbnail-utvalg (beste frame automatisk)** [medium · S]  
   I stedet for tom cream-boks i recorder-timeline, la Claude velge den mest representative/visuelt rene frame per scene som thumbnail og som branded export-PNG-bakgrunn. Stort fordi det fikser et synlig hull og gir bedre delings-previews uten manuelt arbeid.
77. **Multimodal merkevare-konsistens-sjekk mot brukerens stilguide** [medium · M · ★differentiator]  
   Last opp logo/farger/font-stilguide og la Claude-vision verifisere at alle overlays, callouts og thumbnails matcher merkevaren, med auto-korreksjon der de avviker. Stort fordi byrå- og enterprise-brukere krever pixel-konsistent branding og ingen demo-verktøy håndhever det visuelt.
78. **Vision-katalogisering: auto-oppdag alle features fra én produktrundtur** [high · L · ★differentiator]  
   La brukeren klikke fritt rundt i appen mens Claude-vision kontinuerlig katalogiserer hver unike skjerm/feature den ser, og deretter foreslår flere ferdige demoer (én per oppdaget feature). Stort fordi det snur arbeidsflyten: utforsk én gang, få mange demoer ut.
79. **Tilgjengelighets-audit via vision (kontrast, fokus, lesbarhet)** [low · M · ★differentiator]  
   La Claude-vision evaluere hver eksportert frame mot WCAG-kontrast og tekststørrelse, og flagge/auto-justere overlays som er uleselige. Stort fordi det legger til et accessibility-lag ingen demo-verktøy har, og som offentlige/enterprise-kunder krever.
80. **Vision-basert 'assisted'-modus med live coaching-overlay** [high · M · ★differentiator]  
   Implementer den definerte men manglende assisted continueMode: under opptak ser Claude-vision frame-strømmen og viser et live overlay ('klikk Innstillinger oppe til høyre nå') og bekrefter automatisk når handlingen er gjort. Stort fordi det fyller et eksisterende API-gap og gjør guidet opptak hands-free-presist.

### Opptak & videoproduksjon (kvalitet, multi-take, b-roll, transitions, auto-zoom)

81. **Multi-take per scene med auto-best-take-rangering** [high · L · ★differentiator]  
   La hver scene holde flere takes (take 1/2/3) opptatt mot samme Required Action, og bruk Claude vision + audio-analyse til a rangere dem (jevn cursor-bevegelse, ingen feilklikk, ren narration) og auto-velge beste take. Dette eliminerer den storste smerten i screencast-produksjon: a matte gjore om hele opptaket fordi ett klikk feilet.
82. **Auto-zoom og auto-pan til klikk-hotspot** [high · M · ★differentiator]  
   Bruk den eksisterende hotspot-koordinaten (viewport-%) til a automatisk Ken Burns-zoome inn mot elementet som klikkes og pan-e jevnt mellom hotspots, ferdig montert i video-pipelinen. Dette er den definerende Screen-Studio-effekten og gjor selv 1080p-opptak til a se cinematic og lesbart ut pa mobil.
83. **Smussfri animert cursor med klikk-ripples og bevegelses-smoothing** [high · M · ★differentiator]  
   Erstatt OS-cursoren med en stor, animert syntetisk cursor som beveger seg via ease-in-out-baner mellom hotspots, med klikk-ripple og forstorrelse pa klikk -- koble de allerede hardkodede '(kommer)'-toggles til pipelinen. Rene cursor-bevegelser er den enkeltfaktoren som mest skiller pro-demoer fra ramatte skjermopptak.
84. **Auto-generert B-roll mellom scener** [medium · L · ★differentiator]  
   La AI Director foresla og hente B-roll (UI-detaljezoom, langsom scroll-reveal, logo-sting, abstrakt produkt-tekstur) som limklipp mellom kjernehandlingene, generert fra eksisterende screenshots eller stock/AI-bilder. Dette lofter rytmen fra monoton skjermtour til redigert produktfilm uten at brukeren ma filme noe ekstra.
85. **Profesjonelle scene-overganger drevet av actionType** [medium · M]  
   Map hver scenes actionType (switch_device, zoom, scroll) til en passende transition (whip-pan ved device-skifte, match-cut ved zoom, crossfade ved skifte av seksjon) automatisk i monteringen. Kontekstuelle overganger gir polert flyt uten at brukeren ma kunne videoredigering.
86. **Runtime-verifisert opptak (handling lyktes faktisk)** [high · M · ★differentiator]  
   Erstatt selector-streng-sammenligningen med ekte runtime-verifisering: inject-scriptet bekrefter at klikket trigget DOM-mutasjon/navigasjon/visibility-endring for steget markeres som vellykket, ellers flagges retake. Dette gjor 'Mark as Done' til en sannhet, ikke en antakelse, og er forutsetningen for palitelig auto-modus.
87. **Ekte auto-pilot-opptak ogsa cross-origin** [high · L · ★differentiator]  
   Bruk den dedikerte Tauri WebviewWindow pa den ekte malsiden til a kjore hele scene-floweten autonomt (klikk/scroll/type via injisert driver) ogsa pa cross-origin sider, sa hele demoen tas opp uten manuell interaksjon. Dette gjor 'lim inn URL -> ferdig film' reelt, ikke bare same-origin.
88. **Loudness-normalisert voiceover med innebygd TTS og stemme-bibliotek** [high · M]  
   Generer narration til faktisk lyd via TTS (flere stemmer/sprak matchet Language-meta), tidssett mot scene-lengde, og kjor gjennom den eksisterende loudness-normaliseringen. Lukker det apenbare gapet hvor voiceover-toggelen finnes men ingen stemmekilde eksisterer -- en komplett demo trenger lyd.
89. **Auto-ducking av bakgrunnsmusikk under tale** [medium · S]  
   Senk musikken dynamisk nar narration spiller (sidechain-ducking) og loft den i pauser/intro/outro, automatisk i mikse-pipelinen. Dette er forskjellen mellom amatorlyd og redigert produksjonslyd og krever ingen brukerinngrep.
90. **Tempo-/dod-tid-trimming (auto-cut av venting og noling)** [high · M · ★differentiator]  
   Detekter og fjern automatisk dod tid -- lasting, museni, lange pauser mellom handlinger -- og komprimer slik at hver scene holder tett rytme matchet narration-lengden. Jump-cut-trimming er kjernen i hvorfor Screen-Studio-demoer foles raske; manuell trimming er den mest tidkrevende redigeringsjobben.
91. **Auto-callouts og spotlight-masker pa nokkelelementer** [high · M · ★differentiator]  
   Koble de definerte callout/highlight-actionene til faktiske visuelle lag: animerte piler, ramme-glow rundt targetSelector-elementet, og bakgrunns-dimming (spotlight) som leder oyet til riktig sted. Visuell veiledning er essensielt i produktdemoer og fjerner behov for etterredigering i ekstern editor.
92. **Multi-resolusjon/aspect auto-reframe fra ett opptak** [high · M · ★differentiator]  
   Bruk hotspot-data til a auto-reframe samme opptak til 16:9, 9:16 og 1:1 ved a holde det aktive elementet i ramme, sa ett opptak gir LinkedIn-, YouTube- og TikTok-cut. Aktiverer de mockup-kortene som i dag star pa opacity 0.7 og dekker hele distribusjonsbehovet fra en kilde.
93. **Live retake av enkeltscene uten a ta opp alt pa nytt** [high · M · ★differentiator]  
   La brukeren markere en enkelt scene som 'retake', spille bare den i Guided Recorder, og sy det nye klippet somlost inn i den eksisterende monteringen. Scene-isolert reopptak er det som gjor multi-take praktisk og redder en 12-stegs demo nar bare steg 7 ble feil.
94. **Webkamera-PIP med talking-head og auto-bakgrunnsfjerning** [medium · L]  
   Stott valgfritt webkamera-overlay (rund eller rektangel-PIP) med segmentert bakgrunnsfjerning, posisjonert sa det ikke dekker aktiv hotspot. Personlig talking-head over demoen oker tillit og engasjement i sales/investor-demoer markant.
95. **AI-generert kapittelmarkorer, .srt og animerte tekstplakater** [medium · M]  
   Generer kapittelmarkorer, undertekster og kinetiske on-screen-titler automatisk fra scene-narration og overlayText, synket til monteringen. Utvider den eksisterende .srt-leveransen til full tekst-pa-skjerm-produksjon som gjor video forstaaelig uten lyd (kritisk for sosiale feeds).
96. **Branded motion-intro/outro og device-mockup-stinger** [medium · M]  
   Generer animerte intro/outro-bumpers og device-mockup-reveal-stingers fra brukerens merkevare (logo/farger), ikke bare statiske rammer. Konsistent branding rundt selve demoen gir et ferdig-produsert inntrykk som skiller seg fra ramme skjermopptak.
97. **Ekte thumbnail-timeline og scrubbing i Guided Recorder** [medium · S]  
   Fyll recorder-timelinen med faktiske scene-thumbnails (fra thumbnailDataUrl/scene-shots) og la brukeren scrubbe/hoppe mellom takes visuelt i stedet for den tomme cream-boksen. Visuell timeline er grunnleggende for a vurdere opptakskvalitet og velge takes.
98. **Kvalitets-gate for opptak (oppl./fps/dropped frames/audio-clip)** [high · M · ★differentiator]  
   Analyser hvert ratt opptak for problemer -- droppede frames, lav oppl., klippet/forvrengt lyd, sort skjerm, feil cursor -- og blokker eksport med konkrete retake-anbefalinger per scene. Forhindrer at brukeren oppdager kvalitetsfeil forst etter eksport, og garanterer leveransekvalitet.
99. **Smart speed-ramping for repetitive eller lange handlinger** [medium · M · ★differentiator]  
   Speed-ramp automatisk gjennom kjedelige strekk (lang skjema-utfylling, lang scroll) og bremse til normal hastighet ved nokkelklikk og avslorende oyeblikk. Dynamisk tempo holder seeren engasjert og er en signatur-redigeringsteknikk som ellers krever timer i en NLE.
100. **Sky-prosjektlager med team-review og tidsstemplet kommentering** [high · L]  
   Flytt prosjektmodellen fra localStorage-only til sky-lager med deling, og legg pa et review-lag der team/kunde kommenterer pa spesifikke tidskoder/scener for godkjenning. Samarbeid og frame-praktis feedback er standard i pro-videoverktoy og lukker det apenbare localStorage-gapet for reelt teamarbeid.

### Voiceover, TTS & lokalisering (innlest lyd, flerspråklig, leppe-sync, stemmevalg)

101. **Claude-skrevet manus → ekte TTS-voiceover per scene** [high · L · ★differentiator]  
   Generer faktisk innlest lyd fra hver scenes narration via en TTS-tjeneste (ElevenLabs/OpenAI/Azure) kalt fra Rust-laget, lagre per-scene WAV og mate dem inn i mockup-polish-pro.mts som voiceover-spor. Dette lukker det største gapet: i dag finnes 'Inkluder voiceover'-toggle men ingen stemme-kilde — appen kan produsere en komplett demo med profesjonell innlest fortelling uten at brukeren leser noe selv.
102. **Per-scene varighet styrt av faktisk voiceover-lengde (auto-timing)** [high · M]  
   Mål den genererte TTS-lydens lengde og sett scene.duration + pauseSec automatisk, så video, .srt-undertekster og montering er millimeter-synket til talen i stedet for hardkodede sekunder. Eliminerer det vanligste demo-problemet: bilde og tale som glir fra hverandre.
103. **Stemme-bibliotek med forhåndslytting i Script Builder** [high · M]  
   Et stemmevalg-panel per prosjekt (kjønn, alder, aksent, varme/energi) med inline forhåndslytting på den faktiske scene-teksten før render. Brukeren hører stemmen mot sitt eget manus og velger merkevare-stemmen før de bruker render-tid, ikke etter.
104. **Custom brand-voice via stemme-kloning** [high · M · ★differentiator]  
   La en grunnlegger laste opp 30–60 sek av egen stemme og klone den (ElevenLabs instant voice clone), så alle demoer snakker med selskapets faktiske stemme. For et solo-/startup-produkt er en gjenkjennelig grunnlegger-stemme et sterkt merkevaresignal ingen mal-baserte demo-verktøy tilbyr.
105. **Ett-klikks flerspråklig lokalisering av hele demoen** [high · L · ★differentiator]  
   Bruk Claude til å oversette alle scenenes narration + overlayText + targetLabel til N målspråk og generer en komplett lokalisert video + interaktiv guide + .srt per språk i ett kjør. Forvandler én demo til et globalt distribusjonssett — direkte salgsverdi for B2B-team som lanserer i flere markeder.
106. **Lokaliserings-glossar og term-låsing** [medium · S · ★differentiator]  
   Per-prosjekt ordliste som tvinger Claude til å beholde produktnavn, knappe-etiketter og fagtermer uoversatt eller oversatt konsekvent på tvers av alle språk og scener. Hindrer den klassiske oversettelsesfeilen der UI-tekst i videoen ('Start free trial') ikke matcher den lokaliserte voiceoveren.
107. **Word-level karaoke-undertekster fra TTS-tidsstempler** [high · M · ★differentiator]  
   Hent ord-nivå timing fra TTS (eller Whisper forced-alignment på recorded narration) og generer animerte, ord-for-ord highlightede undertekster (.ass/burned-in) i stedet for dagens grovt timede én-blokk-per-scene .srt. Sosiale klipp med kinetiske undertekster har dramatisk høyere fullføringsrate.
108. **Leppe-/handlings-sync: align voiceover til faktiske on-screen-handlinger** [high · L · ★differentiator]  
   Bruk hotspot/required-action-tidspunktet til å plassere setningen som beskriver en handling akkurat når handlingen skjer i opptaket (f.eks. 'klikk her' uttales i samme frame som klikket). Erstatt naiv per-scene-konkatenering med handlings-ankret voiceover-plassering så fortellingen følger pekeren.
109. **SSML-kontroll: pauser, vekt, tempo og uttale per scene** [medium · M]  
   Eksponer lette SSML-kontroller (pause før CTA, vekt på nøkkelord, tempo per scene-type) som lagres på scenen og sendes til TTS-motoren. Gir polert, regissert tale — investor-demo rolig og vektig, social_clip rask og energisk — i tråd med de eksisterende demo-type-malenes tone/length.
110. **Per-scene uttale-leksikon for merkenavn og akronymer** [medium · S · ★differentiator]  
   La brukeren definere fonetisk uttale for produktnavn, akronymer og egennavn (f.eks. 'CreatorHubn', 'API') én gang, gjenbrukt på tvers av alle scener og språk. TTS uttaler ofte merkenavn feil; et leksikon løser det permanent og er noe generiske TTS-knapper aldri tilbyr.
111. **Voiceover-konsistens og normalisering mellom scener** [medium · S]  
   Kjør de per-scene TTS-klippene gjennom en felles loudness-/EQ-/pause-normalisering (utvid eksisterende loudnorm -14 LUFS-steg) så alle scener høres ut som én sammenhengende innspilling i stedet for N separate genereringer med driftende volum/tone. Profesjonell helhet uten manuell mixing.
112. **Hybrid: behold ekte stemme-opptak, fyll hull med matchet TTS** [medium · M · ★differentiator]  
   Når en scene allerede har recordingPath med tale, behold den; for scener uten opptak generer TTS i samme klonede stemme så hele videoen er sømløs. Lar grunnleggeren lese de viktige scenene selv og auto-fylle resten uten hørbart bytte.
113. **Voiceover i den interaktive HTML-guiden (Web Speech + lyd-fallback)** [medium · M · ★differentiator]  
   Embed de genererte per-steg lyd-klippene (eller Web Speech API-fallback) i buildInteractiveGuideHtml, så den selvstendige delbare guiden leser hvert steg høyt med play/auto-advance. I dag er guiden helt stum — talt steg-for-steg gjør den brukbar som tilgjengelig onboarding.
114. **AI Voice Director: foreslå stemme + tone fra demo-type og side-kontekst** [medium · M · ★differentiator]  
   Utvid AI Director til å anbefale stemmeprofil, tempo og emosjonell bue per scene basert på demoType og fetchSiteContext (rolig autoritet for investor_demo, vennlig for onboarding). Brukeren får en ferdig-regissert voiceover-plan i stedet for å gjette stemme-innstillinger.
115. **Aksent- og lokalstemme-utvalg per målmarked** [medium · S · ★differentiator]  
   Tilby region-spesifikke stemmer (norsk bokmål, US/UK/AU-engelsk, tysk osv.) koblet til lokaliseringsspråket, så den tyske versjonen snakkes av en innfødt tysk stemme, ikke en engelsk stemme som leser tysk tekst. Innfødt aksent per marked er det som skiller en troverdig lokalisert demo fra en maskinoversatt.
116. **Teleprompter-opptaksmodus i Guided Recorder med live transkripsjon** [medium · M]  
   Vis scenens narration som rullende teleprompter under opptak og kjør Whisper på det opptatte sporet for å verifisere at det leste matcher manuset (flagg avvik). Hjelper folk som vil bruke egen stemme å levere rent uten å glemme replikker, og kobler narration til faktisk levert tale.
117. **Voiceover-cache + diff-basert regenerering** [medium · S]  
   Hash hver scenes narration+stemme+SSML og cache den genererte lyden i prosjektet; ved re-eksport regenerer kun scener hvis tekst/stemme endret seg. Sparer TTS-kostnad og rendertid massivt under iterativ redigering — kritisk når flerspråk multipliserer antall klipp.
118. **Musikk-ducking styrt av voiceover-tilstedeværelse per scene** [low · S]  
   Mat presise voiceover-tidsstempler inn i det eksisterende ducking-steget (sidechaincompress) så bakgrunnsmusikk kun dempes mens stemmen snakker og løftes i pauser/overgangs-scener. Mer dynamisk, radiokvalitets-mix enn dagens grove tale-vs-musikk-ducking.
119. **Stemme-emosjon/energi per scene-type for retensjon** [medium · M · ★differentiator]  
   Bruk emosjons-/stil-styring (der TTS-motoren støtter det) så hook-scener er energiske, bevis-scener trygge og CTA-scener oppfordrende, drevet av scene-rollen i malen. Monoton AI-stemme er hovedgrunnen til at folk avviser TTS; per-scene emosjon gjør talen levende.
120. **Voiceover-utkast som delbar lyd-leveranse (sammen med PDF/SRT)** [low · S]  
   Legg til 'Voiceover (MP3)' og 'Voiceover-script + tidsplan' i Leveranser-seksjonen, så team kan godkjenne/dele den innleste fortellingen uavhengig av videoen, eller sende den til et eksternt studio. Behandler voiceover som en førsteklasses leveranse på linje med .srt og manus-PDF.

### Maler, temaer & branding (per-bransje maler, merkevare-kit, white-label)

121. **Brand Kit som førsteklasses prosjekt-objekt** [high · M]  
   Introduser en serialiserbar BrandKit-modell (logo, farger, fonter, tonefall, CTA-stil, lyd-logo) lagret i localStorage + eksporterbar JSON, som alle generatorer (thumbnail, script-PDF, interaktiv guide, video-overlay) leser fra i stedet for den hardkodede #ef8a5d-paletten. Stort fordi det er fundamentet hele kategorien hviler på — i dag er merkevaren bakt inn i kildekoden og umulig å endre uten å redigere TS-filer.
122. **Auto-ekstraher merkevare fra URL-en (Brand Autopilot)** [high · M · ★differentiator]  
   Utvid det eksisterende demo_fetch_site_context/demo_scan_dom-laget til å trekke ut favicon/logo, dominerende farger (computed-styles + canvas-fargekvantisering), font-stacker og merkevarens tonefall, og foreslå et komplett Brand Kit automatisk når brukeren limer inn URL-en. Stort fordi det fjerner all manuell oppsett — demoen ser ut som kundens produkt fra første sekund, noe ingen konkurrent gjør fra bare en URL.
123. **Bransje-pakker (vertical template packs)** [high · L · ★differentiator]  
   Bygg kuraterte bransje-pakker (SaaS, fintech, helse/MedTech, e-handel, eiendom, edtech) som kombinerer scene-flow, tonefall, juridiske overlays/disclaimere, fargestemning og CTA-mønstre tilpasset hver vertikal — over dagens 8 generiske demo-typer. Stort fordi en fintech-demo og en helse-demo har helt ulike krav (compliance, språk, bevisføring), og bransje-spesifisitet er nøyaktig det kjøpere etterspør i denne kategorien.
124. **Tema-motor med live preview på tvers av alle leveranser** [high · M]  
   Lag en sentral tema-motor (CSS-variabler + render-tokens) der ett valg umiddelbart oppdaterer device-preview, interaktiv guide, thumbnail og video-overlay samtidig, med 8-10 ferdige temaer (Minimal, Bold, Editorial, Dark, Neon, Corporate). Stort fordi dagens palett er duplisert som hardkodede hex-verdier i tre separate filer; én kilde-til-sannhet gjør temaskifte til ett klikk.
125. **White-label-modus (fjern all Demo Studio-branding)** [high · S · ★differentiator]  
   Legg til en white-label-bryter som erstatter «Generert av Product Demo Studio»-footer, ▶-logoen i guiden og enhver standard-vannmerke med byråets/kundens egen merkevare, inkludert egen favicon og meta-tagger i den eksporterte HTML-guiden. Stort fordi byråer og reselgere ikke kan levere noe med en annens logo på — white-label er selve inngangsbilletten til agency-segmentet.
126. **Merkevarestyrt video-overlay-tema (cursor, callouts, lower-thirds)** [high · M]  
   Koble de i dag «(kommer)»-merkede overlay-, cursor- og callout-elementene til Brand Kit-temaet slik at lower-thirds, tekstkort, kapittel-titler og animasjons-stil arver merkevarens farger, font og hjørneradius. Stort fordi videoen i dag er den eneste leveransen uten merkevare-konsistens, og samkjørte overlays er det som får en demo til å se profesjonelt produsert ut.
127. **Brand Voice i AI Director (merkevare-persona i promptene)** [high · M · ★differentiator]  
   Utvid SYSTEM-prompten og generateDemoFlow/improveScript til å injisere en lagret merkevare-persona (forbudte/foretrukne ord, slagord, formalitetsnivå, eksempel-setninger) så AI-manuset høres ut som kunden, ikke en generisk demo-stemme. Stort fordi tone/audience i dag er grunne enum-verdier; en ekte brand-voice gjør AI-teksten on-brand uten manuell omskriving.
128. **Template Marketplace med deling og import** [medium · L · ★differentiator]  
   Bygg en delbar mal-pakke (scene-flow + tema + brand-voice + overlays som én .trrtemplate-JSON) med import/eksport og et galleri av community-/Anthropic-kuraterte maler. Stort fordi det forvandler maler fra statiske kode-konstanter til et voksende økosystem — kjøpere velger produkt basert på malbibliotekets bredde i denne kategorien.
129. **Merkevare-fonter via lokal font-innlasting** [medium · M]  
   La brukeren laste opp/lenke egne fonter (WOFF2) som embeddes i den interaktive HTML-guiden (base64 @font-face) og brukes i canvas-thumbnail og video-overlays via Tauris filsystem. Stort fordi typografi er halve en merkevares identitet, og dagens generatorer er låst til -apple-system/Segoe UI — ekte font-støtte hever leveransene fra «default» til «designet».
130. **Tilgjengelighet- og kontrast-vakt på merkevaretemaer** [medium · M · ★differentiator]  
   Integrer en WCAG-kontrastsjekk i tema-motoren som validerer tekst-mot-bakgrunn for hver leveranse og foreslår justerte tints/shades når et merkevaretema bryter AA/AAA, gjenbruker Responsive Check-UI-mønsteret. Stort fordi compliance-tunge bransjer (helse, offentlig) krever tilgjengelige leveranser, og automatisk kontrast-fiks er en seriøs differensiator ingen demo-verktøy tilbyr.
131. **Multi-brand-prosjekter for byråer** [medium · M · ★differentiator]  
   Tillat at ett prosjekt holder flere Brand Kits (f.eks. kunde + medsponsor, eller co-branded partner-demo) og bytter merkevare per scene eller eksporterer samme demo i N merkevare-varianter på ett klikk. Stort fordi byråer og reselgere som lager mange demoer trenger merkevare-veksling uten å duplisere hele prosjektet — dette er agency-segmentets kjernebehov.
132. **Smarte device-rammer med merkevare-tilpasning** [medium · M · ★differentiator]  
   Utvid FramedDevice/deviceFrames slik at enhetsrammer kan farges/skinnes (klokkeslett, statuslinje, bakgrunn) og kobles til Brand Kit, pluss alternative rammer (browser-chrome med kundens favicon i fanen, app-ikon på hjemskjerm). Stort fordi en MacBook-ramme med kundens favicon i nettleserfanen får demoen til å se ut som en ekte produktopptaks-økt, ikke en mal.
133. **Tema-bevisst interaktiv guide med innebygd merkevare-CSS-variabler** [high · S]  
   Refaktorér buildInteractiveGuideHtml til å motta tema-tokens (i dag hardkodet :root med #ef8a5d) så hver eksportert guide bærer kundens farger, logo, font og favicon, med valgbare guide-layouter (sidebar, fullscreen, hotspot-only). Stort fordi den selvstendige HTML-guiden er den mest delbare leveransen — den må se 100% ut som kundens produkt når den deles eksternt.
134. **Merkevare-mal-låsing og merkevareregler (brand guardrails)** [medium · M · ★differentiator]  
   La en merkevare-administrator låse farger/fonter/logo-plassering/forbudte fraser som regler, slik at andre teammedlemmer (og AI Director) ikke kan bryte merkevaren — med en synlig «off-brand»-varsling à la sceneActionMatch. Stort fordi store organisasjoner trenger at alle demoer er on-brand uavhengig av hvem som lager dem; guardrails er enterprise-kategoriens signatur.
135. **Sesongbaserte og kampanje-temaer** [low · M]  
   Lever et bibliotek av tids-/kampanje-temaer (Black Friday, jul, produktlansering, Pride, sommer) som lagrer en hel visuell stemning (farger, badges, overlay-ornamenter, animasjons-tempo) som kan legges over ethvert Brand Kit uten å overskrive det. Stort fordi markedsteam lager kampanje-spesifikke demoer kontinuerlig, og ett-klikks kampanje-skinn over egen merkevare sparer dem for designarbeid.
136. **AI-genererte tema-forslag basert på demo-mål** [medium · M · ★differentiator]  
   La Claude foreslå 3 komplette tema-/farge-/typografi-retninger ut fra demo-type, bransje og ekstrahert merkevare, presentert som klikkbare preview-kort à la dagens demo-type-velger. Stort fordi de fleste brukere ikke er designere; AI som leverer ferdige, smaksfulle tema-retninger fjerner det blanke-ark-problemet og er et tydelig Claude-drevet konkurransefortrinn.
137. **Merkevare-konsistens-revisjon før eksport** [medium · M · ★differentiator]  
   Legg til en pre-eksport-revisjon som sjekker at alle scener, overlays og leveranser bruker samme merkevarefarger/font/logo og flagger avvik (f.eks. en scene med standard-aksent), med ett-klikks «bring on-brand». Stort fordi inkonsistens er den vanligste feilen i merkevarede leveranser; en automatisk revisjon er det som skiller et profesjonelt verktøy fra en samling redigeringsbokser.
138. **Animert merkevare-intro/outro-pakke** [medium · M]  
   Lever maler for animert logo-reveal-intro og CTA-outro (logo-sting, slagord-fade, CTA-knapp-puls) som arver Brand Kit og settes inn som første/siste scene i video og guide. Stort fordi profesjonelle demoer åpner og lukker med merkevaren; ferdige, merkevare-tilpassede intro/outro-stings er noe brukere ellers betaler en videograf for.
139. **Lokaliserte merkevaremaler (per-marked tonefall og tekst)** [medium · L · ★differentiator]  
   Utvid scriptMeta/language til en lokaliserings-matrise der ett prosjekt holder merkevare-konsistent manus + overlays på flere språk/markeder, med AI-oversettelse som bevarer merkevare-voice og markeds-spesifikke CTA-er. Stort fordi globale produkter trenger samme demo on-brand på 5+ språk; per-marked merkevaremaler er en stor tidsbesparelse ingen URL-til-demo-verktøy gjør i dag.
140. **Merkevare-tokens eksporterbar til Resolve/Photoshop-broen** [medium · M · ★differentiator]  
   Eksponer Brand Kit (farger, fonter, logo-asset-stier, overlay-stiler) som strukturerte tokens den eksisterende Resolve/Photoshop-broen kan konsumere, så finpuss i DaVinci/Firefly bruker nøyaktig samme merkevare som demoen ble generert med. Stort fordi det knytter Demo Studio til monorepoets pro-redigeringskjede — merkevaren forblir konsistent fra auto-generert demo helt til håndredigert sluttvideo, et unikt økosystem-fortrinn.

### Samarbeid & deling (team, kommentarer, review-flyt, godkjenning, versjoner)

141. **Sky-backet prosjektmodell med realtime-sync** [high · L]  
   Flytt demo-prosjektene fra localStorage-only til en sky-backet, CRDT-basert dokumentmodell (Yjs/Automerge) slik at flere teammedlemmer kan jobbe på samme demo samtidig uten konflikter. Dette er fundamentet hele samarbeidskategorien hviler på — uten det er alt annet umulig.
142. **Scene-forankrede kommentartråder** [high · M · ★differentiator]  
   La reviewere kommentere på en konkret scene (eller et hotspot/overlay i scenen) med tråder, @-mentions og emoji-reaksjoner, slik at feedback er kontekstuell i stedet for løsrevet Slack-prat. Kommentaren peker på targetSelector/hotspot så den følger elementet selv når flowen redigeres.
143. **Tidsstemplede video-kommentarer** [high · M · ★differentiator]  
   På den monterte demovideoen kan reviewere klikke et tidspunkt og legge igjen en pin-kommentar (a la Frame.io), som mapper tilbake til scenen som spilte på det sekundet. Lukker gapet mellom 'video ser ferdig ut' og 'fiks akkurat dette klippet'.
144. **Strukturert godkjenningsflyt med stadier** [high · M]  
   Innfør eksplisitte review-stadier (Draft → In Review → Changes Requested → Approved → Published) med påkrevde godkjennere per stadie og en synlig status-badge per prosjekt. Gjør demoer til en styrt leveranse i stedet for en evig redigerbar fil.
145. **Per-scene approve/reject med blokkering** [high · S]  
   Bygg videre på den eksisterende per-scene status og validateScene slik at hver scene kan godkjennes eller avvises individuelt, og eksport blokkeres til alle påkrevde scener er Approved. Knytter den tekniske valideringen til en menneskelig kvalitetsport.
146. **Uforanderlige versjons-snapshots** [high · M]  
   Hver gang en demo deles til review eller publiseres, frys et navngitt, uforanderlig snapshot (flow + script + opptak + eksport-innstillinger) som kan gjenåpnes og sammenlignes. Reviewere godkjenner alltid en konkret versjon, ikke et bevegelig mål.
147. **Visuell scene-diff mellom versjoner** [high · M · ★differentiator]  
   Vis en side-ved-side diff av to versjoner: hvilke scener ble lagt til/fjernet/omarrangert, manus-tekstendringer markert, og thumbnail-før/etter. Gjør 'hva endret seg siden forrige godkjenning' til ett blikk i stedet for gjetting.
148. **Delbar review-lenke uten innlogging** [high · M · ★differentiator]  
   Generer en sikker, utløpbar web-lenke (passord/utløp valgfritt) der eksterne — kunder, sjefer, investorer — kan se demoen og legge igjen kommentarer/godkjenning uten å installere Tauri-appen eller ha konto. Senker terskelen for review dramatisk for et solo-team som selger til andre.
149. **Samarbeid på den interaktive klikk-guiden** [medium · M · ★differentiator]  
   Utvid buildInteractiveGuideHtml slik at den selvstendige HTML-guiden tar imot betrakter-kommentarer per hotspot (postet tilbake til prosjektet), ikke bare vises passivt. Gjør den allerede unike interaktive guiden til en to-veis review-artefakt.
150. **Presence og live-cursorer i Flow/Script Builder** [medium · M]  
   Vis hvem som er inne i prosjektet akkurat nå, hvilken scene de ser på, og live tekst-cursorer i Script Builder. Forhindrer dobbeltarbeid og gir samme samtidighetsfølelse som Figma/Docs.
151. **Roller og granulære tilganger** [high · M]  
   Innfør rollene Owner/Editor/Reviewer/Viewer per prosjekt og workspace, der Reviewer kan kommentere/godkjenne men ikke endre flow, og Viewer kun ser ferdig output. Nødvendig for å trygt dele med kunder og eksterne uten å eksponere redigering.
152. **AI-oppsummering av review-feedback til oppgaver** [high · M · ★differentiator]  
   La Claude lese alle kommentartrådene i en versjon og generere en prioritert handlingsliste ('Scene 3: forkort narration; Scene 5: bytt CTA-tekst') med direkte hopp-til-scene-knapper. Gjør spredt feedback om til konkrete redigeringer for et solo-team.
153. **AI-foreslåtte redigeringer som suggestion-mode** [medium · M · ★differentiator]  
   AI Improve/Director leverer endringer som forslag (godta/avvis per scene) i stedet for å overskrive direkte, akkurat som Google Docs suggesting mode. Gjør AI til en trygg samarbeidspartner i en review-prosess der man må kunne spore hvem/hva som endret.
154. **Full aktivitets- og endringslogg (audit trail)** [medium · M]  
   Loggfør hver handling — hvem la til scene, hvem godkjente, hvem endret manus, når AI genererte flow — i en gjennomsøkbar tidslinje per prosjekt. Gir ansvarlighet og er ofte et krav for byrå/enterprise-kunder.
155. **Side-ved-side godkjenning av varianter** [medium · M · ★differentiator]  
   Når 'flere versjoner' (LinkedIn-cut, teaser, mobil) realiseres, la reviewere se og godkjenne alle varianter i samme review-vindu og velge favoritt med ett klikk. Knytter den planlagte multi-variant-eksporten direkte til en beslutningsflyt.
156. **Gjestebidrag av råopptak fra mobil** [medium · L · ★differentiator]  
   La en kollega uten appen sende inn et råopptak/skjermklipp via review-lenken som dukker opp som en kandidat for en scene i Guided Recorder. Distribuerer det tunge opptaksarbeidet uten å distribuere hele appen.
157. **Merkevare- og review-maler delt på team-nivå** [medium · M]  
   Lagre godkjente brand-kits (device-rammer, intro/outro, font, CTA-stil) og review-sjekklister som delte team-maler nye prosjekter arver. Sikrer at alt teamet shipper er konsistent og forhåndsgodkjent.
158. **Sammenlign demo mot live nettside ved review-tid** [high · M · ★differentiator]  
   Siden flowen er bundet til ekte selectors via demo_scan_dom, kjør en re-scan ved review og flagg scener der målsiden har endret seg (knapp flyttet/forsvunnet) før godkjenning. Hindrer at man godkjenner en demo som allerede er utdatert mot produktet.
159. **Innebygde leverings- og signeringsrom for klient** [high · M · ★differentiator]  
   Et 'klientrom' per prosjekt der den endelige videoen, interaktive guiden, undertekster og PDF samles, kan lastes ned, og der kunden trykker en formell 'Godkjent for publisering' med signatur og tidsstempel. Lukker leveranse-loopen profesjonelt for et byrå/solo-lead.
160. **Varslinger og review-innboks på tvers av kanaler** [medium · M]  
   Push-/e-post-/Slack-varsler når man tagges, en scene avvises, eller en godkjenning ventes — samlet i en 'mine reviews'-innboks i appen. Holder asynkron review i bevegelse i stedet for å dø i ventemodus.

### Analyse & engasjement (seer-tracking, heatmaps, fullføringsrate, CTA-konvertering)

161. **Embedded telemetry-beacon i den interaktive guiden** [high · M]  
   Inject en liten, GDPR-vennlig event-sender i buildInteractiveGuideHtml som sender step_view/step_complete/cta_click/drop_off til et nytt /api/demo-analytics-endepunkt med en signert demoId. Uten dette er hver delt guide en black box; dette er selve grunnmuren for HELE seer-/engasjement-kategorien.
162. **Klikk- og oppmerksomhets-heatmap per scene** [high · L · ★differentiator]  
   Samle musebevegelse/scroll/tap-koordinater i guiden (samme viewport-% som hotspot-modellen bruker) og render aggregert heatmap-overlay rett oppå hver scene-thumbnail i et nytt Analytics-view. Viser nøyaktig hvor seerne ser vs. hvor du PLASSERTE hotspot/CTA — direkte handlingsbart for re-cut.
163. **Funnel- og fullføringsrate-graf på scene-nivå** [high · M]  
   Et stegvis funnel-diagram (Steg 1 → N) som viser hvor mange seere som faller fra på hvilken scene, med prosent og absolutte tall per scene-id. Gjør at brukeren umiddelbart ser den 'lekke' scenen i stedet for bare en total completion-rate.
164. **CTA-konvertering med ekte attribusjon** [high · L · ★differentiator]  
   Spor klikk på highlight/CTA-scener (actionType 'highlight') og koble dem til faktisk utfall via en post-click redirect-wrapper + valgfri konverterings-pixel/postback, slik at 'X seere → Y CTA-klikk → Z signups' vises ende-til-ende. Konverterer demoen fra markedsføring til målbart salgsverktøy.
165. **AI Engagement Director — Claude analyserer dataen og foreslår re-cut** [high · L · ★differentiator]  
   Mate aggregert drop-off/heatmap/CTA-data inn i claudeProxyService og la Claude returnere strukturerte ResponsiveFix-lignende forslag ('Scene 3 mister 40% — kort ned narration til 8s og flytt CTA opp'), med ett-klikks anvend. Lukker analyse→handling-løkken som ingen demo-verktøy gjør i dag.
166. **Seer-session replay (anonymisert)** [medium · L · ★differentiator]  
   Spill av en komprimert event-strøm (steg-navigasjon, hover, scroll, hotspot-klikk, pause) som en scrubbable tidslinje pr. anonym seer-session i Analytics-viewet. Lar deg SE hvor en konkret prospect nølte — uvurderlig for sales_video/investor_demo-typene.
167. **Engagement-score per scene innebygd i Script Builder** [high · M · ★differentiator]  
   Vis en live engasjements-badge (grønn/gul/rød) direkte på hvert scene-kort i ScriptBuilderView basert på faktisk completion + hover-tid + CTA-rate fra publiserte versjoner. Bringer analytics inn der redigeringen skjer, ikke gjemt i en separat fane.
168. **A/B-testing av scene-varianter med automatisk vinner** [high · L · ★differentiator]  
   La en publisert demo ha to+ varianter av en scene (manus/CTA/rekkefølge); guiden serverer tilfeldig og analytics-laget kårer statistisk signifikant vinner på completion eller CTA-rate. Verdensklasse-funksjon ingen URL→demo-verktøy har.
169. **Watch-time og attention-kurve for video-eksporten** [high · M]  
   For video-output, generer en delbar landingsside med innebygd spiller som logger play/pause/seek/25-50-75-100%-milepæler og tegner en attention-retention-kurve. Gir samme seer-innsikt for video som for den interaktive guiden, ikke bare for HTML.
170. **Per-mottaker delingslenker med navngitt sporing** [high · M · ★differentiator]  
   Generer unike lenker (?v=token) pr. mottaker/konto slik at Analytics kan vise 'Acme Corp så hele demoen 3 ganger og klikket CTA' — ikke bare anonym aggregering. Forvandler demoen til et account-based-sales signalverktøy (à la DocSend for demoer).
171. **Real-time live-varsel når en demo blir sett** [medium · M · ★differentiator]  
   Push-varsel (PushNotification/Tauri) i det øyeblikket en navngitt prospect åpner demoen og når de fullfører/klikker CTA, så selger kan følge opp mens interessen er varm. 'Hot lead'-signal som hever demoen fra innhold til pipeline-driver.
172. **Drop-off-årsaksdiagnose med Claude vision** [medium · M · ★differentiator]  
   Når en scene har høy frafall, send scenens screenshot + narration + drop-off-tall som image-blokk til Claude vision og få en konkret diagnose ('CTA er under fold på mobil, teksten er for tett'). Kobler den eksisterende vision-kapasiteten direkte til engasjements-problemer.
173. **Hotspot-treffrate vs. plassering (interaction efficacy)** [medium · M · ★differentiator]  
   Mål andelen seere som faktisk klikker den tiltenkte hotspot vs. klikker andre steder, pr. scene, og vis avvik mot targetSelector. Validerer om dine guidede handlinger faktisk leder seeren dit du vil — en presis utvidelse av sceneActionMatch til runtime.
174. **Benchmark mot demo-type-baseline** [medium · M · ★differentiator]  
   Bygg anonyme aggregat-baselines pr. DemoType (f.eks. social_clip har median 62% completion) og vis 'din demo ligger 18% under typisk product_demo'. Gir kontekst som gjør tallene meningsfulle uten at brukeren må gjette hva 'bra' er.
175. **Geografi-, enhets- og kilde-segmentering** [medium · M]  
   Segmenter alle engasjements-tall etter device (desktop/tablet/mobil), land og henvisningskilde, og fremhev f.eks. 'mobilseere faller av på scene 2'. Knytter direkte til den eksisterende Responsive Check-aksen — analyse + auto-fiks i samme løkke.
176. **Engagement-mål og varsler (SLA på demoen)** [medium · S]  
   La brukeren sette mål (f.eks. '>50% fullføring, >10% CTA') pr. demo, og få CronCreate-baserte varsler når en publisert demo faller under terskel over tid. Gjør analytics proaktiv i stedet for noe man må huske å sjekke.
177. **Eksporterbar engasjements-rapport (PDF/CSV) med branding** [medium · S]  
   Gjenbruk buildScriptHtml-print-mønsteret til en branded engasjements-rapport (funnel, heatmap-miniatyrer, CTA-tall, topp/bunn-scener) som kan deles med kunde/ledelse, pluss rå CSV-eksport. Gjør dataen presentabel og kontraktsbar.
178. **Lead-capture-gate midt i guiden med konverterings-spor** [high · M · ★differentiator]  
   Valgfri e-post/navn-gate som kan plasseres på en valgt scene i guiden; innsamlede leads vises i Analytics koblet til hvor i flowen de konverterte og om de fullførte etterpå. Forener engasjement + lead-gen i ett delbart artefakt.
179. **Predictive engagement-score FØR publisering** [medium · L · ★differentiator]  
   La Claude estimere forventet completion/CTA-rate fra manus-lengde, scene-antall, tone og hotspot-tetthet — kalibrert mot historiske aggregater — og vise en 'predicted engagement'-score i ExportView før man deler. Forhåndsoptimalisering ingen konkurrent tilbyr.
180. **Personverns-første consent- og anonymiserings-lag** [high · M · ★differentiator]  
   Innebygd cookieløs, IP-trunkert, DNT-respekterende sporing med consent-banner-toggle i guiden og full lokal-kun-modus, dokumentert i en innebygd personvern-erklæring. Avgjørende differensiator for B2B/EU-kunder der konkurrenter (Hotjar-stil) skremmer juridisk.

### Onboarding & bestemor-enkelhet (én-knapp, guidet, feilsikker, norsk klarspråk)

181. **Én-knapp-modus: «Lim inn lenke → Få demo»** [high · L · ★differentiator]  
   En default super-enkel sti der bruker kun limer inn URL og trykker én stor knapp; AI kjører hele 9-stegs-pipelinen autonomt (analyse→flow→manus→opptak via Tauri-vindu→montering→eksport) og leverer ferdig video + interaktiv guide uten et eneste mellomvalg. Avansert modus skjules bak «Tilpass». Dette er selve kjernen i bestemor-enkelhet og ingen konkurrent leverer ende-til-ende på ett klikk.
182. **Norsk klarspråk-stemme (TTS) for voiceover ende-til-ende** [high · M · ★differentiator]  
   Koble voiceover-toggelen til ekte norsk TTS (naturlig bokmål + nynorsk + dialekt-valg) generert fra scene-narration, med ordlyd-normalisering og leppe-tempo matchet til scene-lengde. Lukker det åpne gapet («kilde for stemme uklar») og gjør at en ikke-teknisk bruker får ferdig fortalt demo på morsmål uten å spille inn noe selv.
183. **Live talt los gjennom hele opptaket («følg stemmen»)** [high · M · ★differentiator]  
   Under Guided Recorder leser appen hver Required Action høyt på norsk («Nå klikker du på den blå Logg inn-knappen oppe til høyre») og venter til handlingen er oppdaget før den går videre. Gjør opptak mulig for folk som ikke leser skjermtekst, og fjerner all gjetting om hva neste steg er.
184. **Selvhelende handlings-deteksjon (ekte runtime-verifisering)** [high · L · ★differentiator]  
   Erstatt selector-streng-sammenligning med faktisk runtime-bekreftelse i capture-vinduet (DOM-mutasjon/URL-endring/synlighet etter handling), og når forventet element ikke finnes, la AI re-skanne DOM og foreslå nærmeste match automatisk. Fjerner «blind venting» og falske Match/Warning, så demoen aldri stopper opp på en bestemors skjerm.
185. **Auto-pek-markør med callouts og zoom i video** [high · M]  
   Implementer den hardkodede «(kommer)»-funksjonen: animert markør som beveger seg til hotspot, ringer/pulser rundt elementet, zoomer inn og viser overlay-tekst — drevet av scene-actionType og hotspot-koordinatene som allerede finnes. Gjør rå skjermopptak til en polert, lettforståelig forklaringsvideo uten manuell redigering.
186. **Cross-origin auto-opptak via Tauri-vindu-styring** [high · L · ★differentiator]  
   Utvid det egne WebviewWindow-en på målsiden til å faktisk utføre handlinger automatisk (klikk/scroll/type via injisert script) også på cross-origin sider, slik at auto-modus virker overalt — ikke bare same-origin. Da kan «én-knapp» faktisk ta opp hele demoen helt uten brukerhandling, noe ingen nettleser-basert konkurrent kan på grunn av CSP/X-Frame.
187. **Angre/forfra på alt + automatisk versjonshistorikk** [medium · M]  
   Hver AI-handling, opptak og redigering blir et angrebart steg med synlig tidslinje («Gå tilbake til før AI endret manuset»), og prosjektet auto-lagrer navngitte snapshots. Trygghetsnett som lar uerfarne brukere eksperimentere uten frykt for å ødelegge noe.
188. **Live forhåndsvisning mens AI bygger («se demoen ta form»)** [medium · M · ★differentiator]  
   Vis device-preview som spiller gjennom scenene fortløpende mens AI Director genererer flow og manus, slik at brukeren ser produktet bli til i sanntid i stedet for en spinner. Bygger tillit og forståelse — kritisk for ikke-tekniske brukere som ellers ikke vet om noe skjer.
189. **Sky-lagring, deling og samarbeid på prosjektnivå** [high · L]  
   Flytt fra localStorage-only til sky-lagrede prosjekter med delbar lenke, kommentarer og «be noen om å spille inn dette steget for meg». Lar en bestemor starte en demo og få barnebarnet til å fullføre opptaket fra sin maskin — og fjerner risikoen for å miste alt når nettleseren tømmes.
190. **Feilsikker recovery: «Vi fikser det for deg»-modus** [high · M · ★differentiator]  
   Når noe feiler (side svarer ikke, element forsvant, opptak avbrutt), viser appen aldri en teknisk feil men en vennlig norsk melding med ett forslag og en «Prøv på nytt automatisk»-knapp som lar AI omgå problemet (re-fetch, alternativ selector, hopp over scene). Eliminerer dødpunktene der ikke-tekniske brukere gir opp.
191. **Mal-galleri med ferdige bransje-demoer på norsk** [medium · M]  
   Et startgalleri med ferdige demo-maler (nettbutikk, booking-side, SaaS-onboarding, kommunal selvbetjening) med norsk tone og typiske scener, så brukeren velger «ligner mest på min side» i stedet for å starte blankt. Senker terskelen fra tomt ark til nesten-ferdig på sekunder.
192. **AI Export Assistant: faktiske flere-versjoner-cuts** [high · M · ★differentiator]  
   Gjør de mockede kortene ekte: ett opptak → automatisk LinkedIn-kvadrat, 30-sek teaser, vertikal social-clip, og full produktvideo, hver med riktig format/lengde/undertekster generert fra samme scener. Stor tidsbesparelse og en differensiator mot single-output-verktøy.
193. **Innebygd kvalitetssjekk før eksport («Klar til å deles?»)** [medium · M]  
   En automatisk siste-kontroll som vurderer lydnivå, lesbarhet av overlay-tekst, om alle scener har handling som ble verifisert, og om noen klipp er for korte/lange — med grønn hake eller konkret norsk fiks-forslag. Gir trygghet om at resultatet faktisk er bra før det sendes til kunder.
194. **Pre-scroll og device-bytte faktisk koblet til opptak** [medium · S]  
   Bruk startScrollPct fra Responsive Check til å faktisk pre-scrolle capture-vinduet, og implementer switch_device-actionType slik at scenen bytter ramme og viewport automatisk under opptak. Lukker to åpne gap og gjør responsive demoer feilfrie uten manuell mikrostyring.
195. **Ekte thumbnails i recorder-tidslinjen + scene-kort** [medium · S]  
   Erstatt den tomme cream-boksen med faktiske scene-screenshots (allerede fanget for vision/guide) som thumbnails gjennom hele UI-et. Visuell orientering er avgjørende for ikke-tekniske brukere som navigerer etter «bildet av siden», ikke etter scene-nummer.
196. **Snakk-til-demo: beskriv demoen med stemmen** [medium · M · ★differentiator]  
   La brukeren si på norsk hva demoen skal vise («Vis hvordan man bestiller time og betaler») i stedet for å redigere scene-felter; AI oversetter talen til flow + manus + handlinger. Maksimal tilgjengelighet for folk som ikke vil skrive eller navigere skjema.
197. **Assisted continueMode: halvautomatisk med bekreftelse** [medium · M]  
   Implementer den definerte men manglende assisted-modusen der appen utfører handlingen automatisk men pauser og spør «Ble dette riktig? Ja/Nei» før neste steg. Perfekt mellomting mellom skummel full-auto og slitsom full-manuell for nervøse brukere.
198. **Branded mal i ett klikk fra egen nettside** [medium · S · ★differentiator]  
   Trekk automatisk logo, farger og font fra den analyserte URL-en (allerede hentet i site-context) og bruk dem på device-rammer, overlays, thumbnail og intro/outro. Brukeren får en profesjonelt merkevaret demo uten å kunne noe om design.
199. **Interaktiv guide som live, alltid-oppdatert embed** [high · L · ★differentiator]  
   Gjør buildInteractiveGuideHtml til en hostet, embeddbar widget som kan legges direkte på kundens nettside som «Vis meg hvordan»-knapp, med valgfri auto-re-skann når siden endres. Forvandler engangs-demo til et levende onboarding-element — sterk differensiator mot statiske video-verktøy.
200. **Seerinnsikt: hvor folk stopper i demoen** [medium · L · ★differentiator]  
   Samle anonym analytikk fra interaktive guider og videoer (hvilke steg blir hoppet over, hvor faller folk fra) og oppsummer det som konkrete norske forbedringsforslag («3 av 4 hopper over steg 4 — vil du forkorte det?»). Lukker loopen fra publisert demo tilbake til forbedring, noe rene byggeverktøy ikke gjør.

### Redigerings-UX & timeline (drag-drop, snarveier, undo-historikk, multi-select)

201. **Drag-drop scene-omrokering på tvers av alle tre timelines** [high · M]  
   Erstatt opp/ned-pilene (DemoStudioShell:571) med ekte pekersensitiv drag-drop (HTML5 dnd eller pointer-events) i Flow Builder-, Script Builder- og Recorder-timelinene, med levende innsettings-indikator, auto-scroll ved kanten og en spring-animasjon. reorderScenes finnes allerede i store, så datalaget er klart — dette er det mest grunnleggende manglende grepet i en timeline-redaktør.
202. **Global undo/redo-historikk for hele prosjektet** [high · M]  
   Bygg en command-stack i Zustand (eller temporal-middleware) som logger hver scene-mutasjon, reorder, sletting og felt-edit slik at ⌘Z/⌘⇧Z angrer alt — ikke bare den ene AI-narration-snapshotten (ScriptBuilderView:83). Uten skikkelig undo tør ingen eksperimentere, og det er bordstandard i enhver verdensklasse-editor.
203. **Multi-select på scener med shift/⌘-klikk og bulk-operasjoner** [high · M]  
   Tillat valg av flere scener (shift=range, ⌘=toggle) og kjør bulk-handlinger: slett, dupliser, bytt device, sett continueMode, juster varighet og grupper. Store har kun selectedSceneId (single) i dag — multi-select forvandler redigering av en 8+ sceners demo fra repetitivt klikk-arbeid til ett grep.
204. **Komplett keyboard-shortcut-system med overlay-cheatsheet** [high · M]  
   Innfør et sentralt hotkey-lag (J/K/L for naviger, Space=spill, ⌘D=dupliser, Delete, ⌘C/⌘V, [/] for trim, , /. for frame-step, ⌘K=command palette) med en «?»-overlay som viser alle. I dag finnes ingen snarveier utover Enter i URL-feltet — power-tempo er det som skiller pro-editorer fra leketøy.
205. **Fungerende ⌘K command palette over scener og handlinger** [high · M]  
   Gjør den eksisterende ⌘K-placeholderen (ScriptBuilderView:180) reell: fuzzy-søk i scener, narration-tekst og targetLabels, pluss kjørbare kommandoer (generer manus, sett device, eksporter). Et command palette er den raskeste broen mellom hensikt og handling i moderne kreative verktøy.
206. **Proporsjonal varighets-timeline med drag-to-trim håndtak** [high · L]  
   Bytt ut de like-brede scene-kortene med spor der bredden er proporsjonal med duration, og legg drag-håndtak på hver kant slik at man strekker/krymper varigheten visuelt (med snap til 0,5s og live tooltip). I dag justeres varighet kun via et number-input (DemoStudioShell:675) — visuell trimming er selve kjernen i timeline-UX.
207. **Ekte thumbnails i timeline-sporene** [high · M]  
   Render scenens thumbnailDataUrl (eller en live mini-iframe-snapshot) i timeline-kortene i stedet for den tomme cream-boksen (ScriptBuilderView:415, GuidedRecorderView). Visuell gjenkjenning av scener er forskjellen mellom å scanne en timeline på et halvsekund og å lese hver tittel.
208. **Copy/paste/dupliser av scener inkludert på tvers av prosjekter** [medium · S]  
   Implementer ⌘C/⌘V/⌘D på scener med en serialiserbar utklippstavle (localStorage-basert siden modellen allerede er ren), slik at man kan gjenbruke en perfeksjonert CTA-scene i flere demoer. Mangler helt i dag og er en daglig tidsbesparer.
209. **Inline-redigerbar timeline (tittel + varighet direkte i sporet)** [medium · S]  
   La brukeren dobbeltklikke tittelen og varigheten rett i timeline-kortet uten å hoppe til detaljpanelet, med tab mellom felt. Reduserer kontekstbytte dramatisk når man finpusser rekkefølge og lengde samtidig.
210. **Snap-magnetisme og total-tid-budsjett mot demo-typens targetSeconds** [medium · M · ★differentiator]  
   Vis en akkumulerende tidslinjal og en mål-markør for demo-typens targetSeconds (finnes i DEMO_TYPE_TEMPLATES), med fargevarsel når totalen overskrider målet og magnetisk snapping av varigheter til hele/halve sekunder. Knytter redigerings-UX direkte til at en social_clip faktisk holder seg på 25s.
211. **Split og merge av scener** [medium · M]  
   La en lang scene splittes i to ved markøren (manus deles på cursor-posisjon, handling beholdes i første, ny tom handling i andre) og to nabo-scener slås sammen. Standard ikke-destruktiv redigeringsoperasjon som mangler helt og er nødvendig når AI Director genererer for grove eller for fine scener.
212. **Marker/kapittel-spor på timelinen for cues og pauser** [medium · M · ★differentiator]  
   Et eget tynt spor over scenene for markører (pause-cue, voiceover-cue, kapittelskille, «trenger retake») som kan dras og hoppes mellom med shortcuts. Gjør pauseSec/notes-feltene synlige i tid i stedet for begravd i et detaljpanel, og gir regissøren et fugleperspektiv.
213. **Dra et skannet DOM-element rett inn på en scene for å binde target+hotspot** [high · M · ★differentiator]  
   La ScannedElement-katalogen vises som en palett man drar fra og slipper på en scene i timelinen, som automatisk setter targetSelector, targetLabel og hotspot. Dette kobler det allerede eksisterende DOM-skannet til redigerings-UX på en måte ingen demo-verktøy gjør — element-binding blir fysisk og direkte.
214. **Hotspot-redigering med drag/resize-håndtak på selve preview-en** [high · M · ★differentiator]  
   Gjør hotspot-rektangelet manipulerbart direkte i Device Preview med 8 resize-håndtak, drag, piltast-nudge og snap til skannede element-bokser, i stedet for engangs-«klikk for å plassere» (DemoStudioShell:521). Presis hotspot-plassering avgjør kvaliteten på både den interaktive guiden og video-callouts.
215. **Timeline-zoom og fit-to-window** [medium · M]  
   Legg til zoom (⌘+/⌘-/pinch) og «fit»-knapp for timeline-sporet slik at man kan jobbe presist på en 2-minutters investor_demo uten horisontal scrolling-helvete. Zoombar tidsakse er forventet i enhver tidslinje-editor over en viss lengde.
216. **Persistent undo-historikk-panel med navngitte versjoner/checkpoints** [medium · L · ★differentiator]  
   Et sidepanel som viser hele redigeringshistorikken som klikkbar tidslinje pluss manuelle, navngitte checkpoints («før AI-omskriving») man kan hoppe tilbake til. Går utover lineær undo og lar brukeren trygt la Claude regenerere hele flowen vel vitende om at de kan rulle tilbake.
217. **Live drag-feedback med ghost-preview og ripple/insert-modus** [medium · M]  
   Under drag-omrokering vis en gjennomsiktig ghost av kortet og la brukeren velge mellom ripple (skyver naboer) og overwrite-innsetting, med haptisk-aktig snap. Den taktile følelsen av at redigeringen «svarer» er det som får et verktøy til å føles verdensklasse fremfor funksjonelt.
218. **AI-drevet «Reorder for flow»-forslag med diff-forhåndsvisning** [medium · M · ★differentiator]  
   En knapp der Claude analyserer scene-rekkefølgen (intro→bevis→CTA-dramaturgi) og foreslår en ny rekkefølge presentert som en før/etter-diff på timelinen som man godtar eller avviser per flytting. Kombinerer redigerings-UX med produktets AI-kjerne på en måte konkurrentene ikke har.
219. **Drag-merge av enheter: dra en scene på en device-rad for å bytte device/orientering** [medium · L · ★differentiator]  
   Gjør timelinen device-bevisst med swimlanes per device (MacBook/iPad/iPhone), slik at det å dra en scene til en annen lane setter device + viewport + orientering automatisk. Visualiserer multi-device-demoer (product_demo bytter til iPhone midtveis) og gjør switch_device til et fysisk grep i stedet for en dropdown.
220. **Robust autosave-status, konfliktsikring og lokal recovery-snapshot** [medium · M]  
   Erstatt den statiske «✓ Lagret»-teksten (ScriptBuilderView:195) med ekte lagre-state (dirty/saving/saved/feilet), debounced skriving, og periodiske recovery-snapshots i en egen localStorage-nøkkel som overlever crash/stale-chunk-reload. Tap av redigeringsarbeid er det mest tillitsbrytende som kan skje i en editor.

### Device-rammer & responsivt (flere enheter, orientering, ekte ramme-fysikk)

221. **Programmatisk SVG/CSS device-rammer (drop PNG-er)** [high · L · ★differentiator]  
   Erstatt de 4 statiske PNG-rammene med en parametrisk vektor-/CSS-frame-motor (bezel-tykkelse, hjørneradius, knapper, farge som tokens) slik at hver enhet er oppløsnings-uavhengig, retina-skarp og fargevariant-bar uten nye bildefiler. Stort fordi dagens manuelt piksel-detekterte skjerm-rektangler er sprø og umulige å skalere til et helt enhetsbibliotek.
222. **Komplett enhets-bibliotek med ekte spesifikasjoner** [high · L · ★differentiator]  
   Bygg en datadreven katalog (iPhone 15/16-serien, iPad Pro/mini, Pixel/Galaxy, Surface, Apple Watch, Vision Pro, ulike MacBook/iMac/Studio Display) med ekte logiske viewport-bredder, DPR, safe-area-innsett og bezel-geometri per modell. Stort fordi VIEWPORT_W i dag er fire hardkodede tall, mens konkurrenter (Screen Studio, Arcade) lever av troverdig enhetsutvalg.
223. **Animert enhetsrotasjon portrait↔landscape** [high · M · ★differentiator]  
   Render switch_device/orientering som en flytende 3D-rotasjon av selve rammen (innholdet re-layouter til ny viewport-bredde midt i bevegelsen) i stedet for et hardt kutt mellom ipad og ipad_landscape. Stort fordi rotasjon er signaturmomentet som beviser responsivt design og i dag ikke finnes i opptak/eksport.
224. **Animert device-handoff (switch_device i video)** [high · M · ★differentiator]  
   Implementer den lovede switch_device-overgangen i render-pipelinen: samme app glir fra MacBook til iPhone med morph/cross-dissolve og synkronisert scroll-posisjon. Stort fordi action-typen og malen (product_demo «Mobile Flow») allerede forventer dette, men eksporten markerer det som «Kommer».
225. **3D-perspektiv og kamera-rigg for rammer** [high · L · ★differentiator]  
   Legg til et lett 3D-lag (CSS transform / WebGL) som lar enheten tiltes, panoreres og dolly-zoomes med fysisk plausibel perspektiv og dybdeskarphet, styrbart per scene som keyframes. Stort fordi flat front-on-mockup er den vanligste «billig»-signalen; cinematisk kamera løfter demoen til verdensklasse.
226. **Fysisk-realistiske refleksjoner og glass** [medium · M · ★differentiator]  
   Tilfør justerbar skjerm-refleksjon, glass-glød, kantlys og miljø-refleksjon (HDRI-lite) over rammen slik at enheten ser ut som ekte hardware, ikke et utklipp på en drop-shadow. Stort fordi ramme-fysikk («ekte ramme-fysikk» er hele kategorien) i dag kun er én statisk drop-shadow.
227. **Hånd- og miljø-presentere (held device)** [medium · M · ★differentiator]  
   Tilby ferdige composites der enheten holdes i en hånd, står på et skrivebord eller monteres på et stativ, med riktig okklusjon og skygge mot underlaget. Stort fordi sosiale klipp (9:16) selger langt bedre med menneskelig kontekst, og ingen del av dagens modell støtter omgivelser rundt rammen.
228. **Multi-device side-by-side hero-komposisjon** [high · M · ★differentiator]  
   La én scene vise MacBook + iPad + iPhone samtidig (responsiv-grid hero) med samme live-URL i hver, automatisk arrangert og dybde-lagt. Stort fordi «vis at det er responsivt» er kjernebudskapet, og dagens preview/eksport kun rendrer én enhet om gangen.
229. **Live status-bar, notch og Dynamic Island** [medium · M]  
   Render en troverdig, redigerbar status-bar (klokke, signal, batteri, operatør) pluss riktig notch/Dynamic Island/punch-hole per modell, inkludert lys/mørk variant. Stort fordi safeArea i dag bare er en boolean-flagg uten faktisk geometri, og ekte status-bar er det som får mobil-mockups til å se autentiske ut.
230. **Pikselpresis safe-area-geometri per modell** [medium · M · ★differentiator]  
   Gjør safeArea til ekte innsett-tall (notch, home-indicator, hjørneradius, kamera-cutout) hentet fra enhets-katalogen, som hotspot/overlay/CTA respekterer ved layout og validering. Stort fordi Responsive Check i dag ikke kan oppdage at en knapp havner bak en notch eller home-indicator.
231. **Ekte breakpoint-drevet Responsive Check** [high · M · ★differentiator]  
   Oppgrader Responsive Check fra tre faste enheter til en sveip over reelle CSS-breakpoints (320–1920px) som måler overflow, tap-target-størrelse, kontrast og innhold-skjuling, og rapporterer per breakpoint med skjermbilde-bevis. Stort fordi dagens sjekk er grov (desktop/tablet/mobil) og fiksene er begrenset til tre kinds.
232. **Auto-detekter enhetens optimale viewport fra siden** [medium · M · ★differentiator]  
   Les sidens egne media-queries/meta-viewport via DOM-skannet og foreslå den enheten/bredden der layouten faktisk er finest, i stedet for å anta 390/834/1440. Stort fordi en hardkodet viewport ofte treffer mellom sidens breakpoints og gir en stygg, utilsiktet layout i preview og opptak.
233. **Nettleser-chrome som egen rammetype** [medium · S]  
   Legg til realistiske browser-vinduer (Safari/Chrome med adresselinje, faner, trafikklys-knapper, lys/mørk) som en førsteklasses ramme ved siden av device-rammene. Stort fordi web-SaaS-demoer ofte vil vises i nettleser-kontekst, og dagens MacBook-ramme viser bare et bart skjerminnhold uten browser-UI.
234. **Branded/farge- og custom-frame-studio** [medium · M · ★differentiator]  
   La brukeren velge enhetsfarge (Titanium/Black/Blue osv.), legge til egen logo-gravering, og laste opp egne PNG-rammer som registreres med auto-detektert skjerm-rektangel. Stort fordi byråer vil ha merkevarekonsistens, og dagens fire faste PNG-er gir null tilpasning.
235. **Auto-kalibrering av skjerm-rektangel for opplastede rammer** [medium · M · ★differentiator]  
   Når brukeren slipper inn en egen ramme-PNG, kjør en Rust-side kant-/svartfelt-deteksjon som finner skjerm-hullet og hjørneradius automatisk (samme jobb som ble gjort manuelt for de fire eksisterende). Stort fordi det fjerner den eneste blokkeringen for et åpent rammebibliotek og gjør custom-frames trivielt.
236. **Device-aware cursor og touch-input** [medium · M]  
   Bytt automatisk mellom syntetisk muspeker (desktop), tap-ringer/finger (touch-enheter) og pen/Apple Pencil avhengig av enhet, med fysisk plausibel bevegelse og trykk-feedback. Stort fordi showCursor/showTouchPoints i dag er uavhengige flagg uten enhets-logikk, og feil input-metafor avslører at det er en mockup.
237. **Pinch/zoom/scroll-gester med ekte fysikk** [medium · M · ★differentiator]  
   Implementer momentum-scroll, gummibånd-effekt ved kant, og pinch-to-zoom på touch-rammer slik at zoom/scroll-handlinger ser ut som ekte enhetsinteraksjon. Stort fordi zoom/scroll i dag er statiske action-typer uten bevegelses-fysikk, mens jevn gest-fysikk er det som skiller premium fra amatør.
238. **Responsivt auto-reframe per eksportformat** [high · M · ★differentiator]  
   Gitt valgt format (16:9/9:16/1:1/4:5) velg og posisjoner automatisk den enheten + zoom-nivå som fyller rammen best (f.eks. iPhone portrait fyller 9:16, MacBook fyller 16:9) med smart padding/bakgrunn. Stort fordi format og enhet i dag velges uavhengig, så en MacBook i 9:16 gir enorme tomme felt.
239. **Per-scene device-keyframes og overgangs-tidslinje** [high · L · ★differentiator]  
   Gjør enhet, orientering, kamera og zoom til keyframe-bare egenskaper over scenens varighet, med en mini-tidslinje for å time rotasjon/handoff/zoom presist mot narrasjonen. Stort fordi device i dag er én statisk verdi per scene, noe som umuliggjør de cinematiske overgangene kategorien krever.
240. **DPR/retina-tro opptak og skarphets-pipeline** [medium · L]  
   Render iframe-innhold ved enhetens faktiske device-pixel-ratio (2x/3x) og pipe det gjennom eksporten uten oppskalerings-uskarphet, med per-modell pixel-grid. Stort fordi FramedDevice i dag bare CSS-skalerer ett logisk viewport, så tekst i rammen blir mykere enn på ekte hardware ved 4K-eksport.

### Validering, QA & pålitelighet (self-heal, retry, ekte state-validering, feilrapport)

241. **Runtime outcome assertions (did the action actually work?)** [high · L · ★differentiator]  
   Replace selector-string comparison with real post-action runtime verification: after each injected action, the verify-script snapshots DOM/URL/scroll/visibility and asserts the expected state-change actually occurred (e.g. modal opened, route changed, element appeared), reporting pass/fail with the captured before/after diff. This is the core gap that turns 'matched the selector' into 'the demo step provably succeeded'.
242. **Self-healing selectors with semantic fallback chain** [high · L · ★differentiator]  
   When a stored targetSelector no longer matches (site changed), auto-resolve the element via a fallback chain — label text, ARIA role, nearby text, and a Claude-vision match against the original hotspot screenshot — then rewrite the selector and flag it as auto-healed. Demos stop silently breaking when the target site ships a redesign.
243. **Retry-with-backoff on flaky steps** [high · M]  
   Wrap every capture/auto/verify action in a bounded retry loop with exponential backoff and per-action-type wait conditions (waitForSelector, waitForNavigation, network-idle), so transient timing failures on slow/JS-heavy pages don't abort the whole run. Eliminates the #1 cause of brittle automated walkthroughs.
244. **Structured failure report with reproducible artifacts** [high · M · ★differentiator]  
   On any failed scene, persist a self-contained failure bundle — screenshot, DOM snapshot, console/network logs, attempted selector, expected-vs-detected diff, and timestamp — viewable in a Failures panel and exportable as JSON. Turns 'it didn't work' into an actionable, shareable diagnosis.
245. **Pre-flight readiness check before recording** [high · M]  
   Before the Guided Recorder starts, run a dry validation pass over every scene (URL reachable, all targetSelectors resolve, hotspots in viewport, required device available) and block recording with a checklist of fixes until green. Stops wasted recording sessions that fail at step 7 of 9.
246. **Site-drift monitor with scheduled re-validation** [high · L · ★differentiator]  
   A background Tauri job periodically re-opens each saved demo's target URL headless, re-runs all selector/assertion checks, and notifies the user when a live demo has drifted (target moved, copy changed, step now fails). Keeps published interactive guides and videos from going stale without anyone noticing.
247. **Visual regression diffing on scene screenshots** [medium · M · ★differentiator]  
   Store a baseline screenshot per scene and on each re-record/re-validate compute a perceptual pixel diff (pinned to the hotspot region) to detect layout/branding changes even when selectors still resolve. Catches the silent failures that DOM checks miss.
248. **Implement 'assisted' continueMode for real** [high · M · ★differentiator]  
   Build the defined-but-missing assisted mode: the recorder highlights the next target, auto-detects when the user performs the expected action (via injected event listener), validates it, and advances automatically — bridging fully-manual and fully-auto. Closes a stated gap and makes recording dramatically faster while staying verified.
249. **Cross-origin auto-mode via injected capture window** [high · L · ★differentiator]  
   Extend the auto-execute path to work cross-origin by driving the dedicated Tauri WebviewWindow on the real target site (already used for capture) instead of the same-origin iframe, ending the 'blind waiting' on cross-origin auto runs. Makes auto-validation work for the real-world case (third-party SaaS pages).
250. **Action-outcome verification matrix per actionType** [high · M · ★differentiator]  
   Define, per actionType (click/scroll/type/hover/highlight/zoom/switch_device), an explicit success oracle (e.g. type → value present in field; scroll → target now in viewport; switch_device → frame changed) so validation is semantic rather than one-size-fits-all selector matching. Each step is checked the way that step actually proves success.
251. **Whole-run integrity gate before export** [high · S]  
   Block (or loudly warn on) export of any video/interactive guide that contains unverified or failed scenes, with a one-click 'fix or override' flow. Prevents shipping a polished demo that contains a broken/unproven step.
252. **Interactive-guide live link-checker** [medium · M · ★differentiator]  
   For exported interactive HTML guides, embed a lightweight self-check that on load validates each hotspot's selector still resolves against the live iframe and reports broken steps back (or degrades gracefully to thumbnail mode). The shipped artifact validates itself in the field.
253. **Deterministic replay harness for regression CI** [medium · L · ★differentiator]  
   Record each run as a deterministic event log (steps, selectors, timings, seeds) that can be replayed headless to reproduce a pass/fail, enabling a Playwright-style regression suite for demos themselves. Lets the team prove a demo still works after every edit.
254. **Confidence scoring per scene** [medium · M · ★differentiator]  
   Compute a 0-100 confidence score per scene from selector stability, assertion strength, retry count, visual-diff delta, and AI ambiguity, surfaced as a color badge so users instantly see which steps are fragile. Replaces the binary Match/Warning/Unverified with actionable risk signal.
255. **Network and console error capture during recording** [medium · M]  
   Inject console/error/network listeners into the capture window so JS errors, 4xx/5xx responses, and failed assets that occur mid-demo are recorded against the scene and flagged. Surfaces target-site breakage that visually looks fine but is actually failing.
256. **AI root-cause + auto-fix suggestion on failure** [high · M · ★differentiator]  
   Feed each failure bundle (screenshot, DOM, expected/detected, logs) to Claude to diagnose the likely cause and propose a concrete fix — new selector, added wait, scroll-first, or device switch — applyable in one click. Turns QA from manual debugging into guided repair.
257. **Idempotent / resumable capture sessions** [medium · M]  
   Make capture crash-safe: persist per-step progress so a crashed or interrupted recording resumes at the failed step instead of restarting from scene 1, and guarantee re-running a validated step is side-effect-aware (warns on destructive actions like 'delete'/'submit'). Long demos become reliable rather than all-or-nothing.
258. **Responsive-validity enforcement across all target devices** [medium · M · ★differentiator]  
   Extend Responsive Check from advisory into validation: actually run each scene's assertions in desktop/tablet/mobile viewports and mark a scene invalid if its target is hidden/unreachable on a device the demo claims to support. Guarantees a multi-device demo actually works on every device it ships for.
259. **Tamper-evident validation provenance for exports** [medium · L · ★differentiator]  
   Embed a signed validation manifest (hashes of each scene's assertions, pass results, timestamps, app version) into exported videos/guides so a viewer or buyer can verify the demo was machine-validated and not faked. A trust differentiator for investor/sales demos where authenticity matters.
260. **Health dashboard across all projects with alerting** [medium · L · ★differentiator]  
   A cross-project QA dashboard showing every saved demo's last-validated time, pass rate, drift status, and broken-step count, with PushNotification/email alerts when any published demo regresses. Gives a portfolio-level reliability view instead of per-project blindness, beyond localStorage isolation.

### Integrasjoner (CRM, Slack, Notion, CMS, HubSpot, embed-SDK, Zapier, webhook)

261. **Embeddable Demo SDK (drop-in <script> + web component)** [high · L · ★differentiator]  
   Ship a tiny JS snippet/<demo-studio> web component that renders any exported interactive guide or video on the customer's own site, marketing pages or in-app, with autoplay-on-scroll and lazy-load. This turns every demo into distributable, embeddable content like Storylane/Arcade/Navattic — the single biggest table-stakes gap versus competitors.
262. **Per-step demo analytics + viewer telemetry** [high · L · ★differentiator]  
   Capture views, step completion, drop-off per scene, hotspot clicks, watch-time and CTA conversions from embedded demos via a lightweight beacon back to a Role Room endpoint. Without engagement analytics a demo platform can't prove ROI; this is what makes demos a measurable funnel asset, not just a video.
263. **HubSpot bidirectional integration (CRM activity + lead routing)** [high · L · ★differentiator]  
   OAuth into HubSpot to log demo views as timeline activities on contacts/deals, create leads from CTA captures, and trigger workflows when a prospect finishes a demo. HubSpot is the dominant SMB CRM and native demo-engagement-to-deal mapping is exactly what sales teams pay for.
264. **Salesforce integration (custom object for demo engagement)** [high · L]  
   Push demo sessions, completion scores and hotspot heatmaps into Salesforce as a custom object linked to Leads/Opportunities, with Einstein-ready fields. Enterprise sales runs on Salesforce; first-class SFDC support unlocks the upmarket segment competitors gate behind expensive tiers.
265. **Native Slack app (share, notify, react)** [high · M]  
   A Slack app that posts an unfurling rich preview when a demo link is shared, and DMs the owner real-time alerts ('Acme Corp just completed your investor demo, 92% watched'). Slack is where sales/marketing live; instant, contextual notifications drive the engagement loop that keeps demos top-of-mind.
266. **Zapier + Make connector with rich triggers/actions** [high · M · ★differentiator]  
   Publish a Zapier/Make integration exposing triggers (demo viewed, completed, CTA clicked, lead captured) and actions (create demo from URL, generate share link). This gives no-code teams thousands of downstream automations without us building every integration — the force multiplier for long-tail tools.
267. **Outbound webhook engine with signed payloads + retries** [high · M]  
   A configurable webhook subsystem firing HMAC-signed events (demo.created, scene.recorded, demo.viewed, lead.captured) with exponential-backoff retries and a delivery log. Webhooks are the universal integration substrate that powers Zapier, custom backends and the SDK analytics; everything else builds on it.
268. **Notion two-way sync (embed + scene-to-doc)** [medium · M · ★differentiator]  
   Embed live interactive demos in Notion pages via the embed API, and export a demo's scene scripts/screenshots as a structured Notion doc for collaborative review. Notion is the default knowledge base for startups; demos that live natively inside docs become onboarding/support assets, not orphaned files.
269. **Headless CMS publishing (Contentful, Sanity, WordPress)** [medium · L · ★differentiator]  
   Direct publish of demos as managed content entries/blocks into Contentful, Sanity and WordPress, so marketing can drop demos into landing pages through their existing CMS workflow. Meeting teams inside the CMS they already use removes the copy-paste-embed friction that kills adoption.
270. **Public REST + GraphQL API with API keys** [high · L]  
   A documented public API to create projects from URLs, trigger AI flow generation, fetch scenes/exports and read analytics, gated by scoped API keys. A real API turns Demo Studio from a closed app into a platform that agencies and enterprises can automate against and resell.
271. **Cloud project store + share links replacing localStorage-only** [high · L]  
   Move project persistence to a Role Room-backed store so demos get permanent shareable URLs, team access and versioning, while keeping the local-first model for offline editing. Every integration (embed, CRM logging, analytics, Slack unfurl) needs a canonical hosted URL — localStorage-only is the structural blocker for the whole category.
272. **Native Universal CRM bridge inside the monorepo** [high · M · ★differentiator]  
   First-class integration with the existing Universal CRM (contacts/deals) so demo creation, sharing and engagement attach to the right CRM record automatically, and a 'Send demo' action appears inside CRM. Owning the loop in our own CRM creates a sticky, end-to-end story no external competitor can match for our base.
273. **Personalized demos via merge-tokens + dynamic params** [high · M · ★differentiator]  
   Allow {{firstName}}/{{company}}/{{logo}} merge tokens in narration/overlays and URL params that swap account-specific data at view time, populated from CRM. Account-personalized demos (the Navattic/Reprise enterprise hook) convert dramatically better and justify premium pricing.
274. **Calendar + meeting-tool integration (Calendly, HubSpot Meetings, Google)** [medium · M]  
   Embed a booking CTA at the end of interactive demos that books directly via Calendly/HubSpot Meetings, and log which demo drove each meeting. Closing the demo-to-meeting gap inside one flow is exactly the conversion event sales cares about most.
275. **Sales engagement integration (Outreach, Salesloft, Apollo)** [medium · M · ★differentiator]  
   Insert trackable demo links into sequence emails and surface 'prospect viewed your demo' signals back into Outreach/Salesloft cadences. SDRs run their day in these tools; native demo signals turn cold sequences into intent-driven follow-ups.
276. **Embeddable interactive guide as iframe widget + lead-gate** [high · M]  
   Wrap buildInteractiveGuideHtml output as a hosted iframe widget with an optional email-capture gate before the final steps, posting captured leads to CRM/webhooks. The existing self-contained HTML is 80% there; gating + hosting converts it from a file into a lead-gen surface.
277. **Intercom / Zendesk help-center publishing for support guides** [medium · M · ★differentiator]  
   One-click publish of support_guide / tutorial demos into Intercom articles and Zendesk Help Center, with deep-linking from in-app help widgets. Demo Studio already has support-oriented demo types; pushing them into the support stack makes it the canonical 'how-to' production tool for CS teams.
278. **Segment / CDP event forwarding** [medium · M]  
   Emit demo engagement events through a Segment source (or generic CDP spec) so they flow into any downstream analytics/warehouse/marketing tool the customer already wires up. Speaking CDP means enterprises get our data everywhere without bespoke connectors — a credibility unlock for data-mature buyers.
279. **Embed-SDK theming + brand-token API for white-label** [medium · M · ★differentiator]  
   Expose CSS variables, logo, font and accent-color config on the embed/web-component plus a per-workspace brand profile, enabling agencies to white-label demos under client brands. White-label embeds are the wedge for agency and reseller revenue that pure-tool competitors monetize heavily.
280. **Two-way figma/marketing-asset and PowerOffice/billing hooks** [medium · L · ★differentiator]  
   Pull brand assets from Figma for thumbnails/overlays and, leveraging the monorepo's PowerOffice bridge, meter integration usage (embeds, API calls) for seat/usage billing. Connecting demo output to the design source and the existing accounting bridge closes the loop from creation to monetization within our own stack.

### Ytelse & skalerbarhet (store demoer, mange scener, caching, bakgrunns-render)

281. **Scene-granular render cache med innholds-hashing** [high · L · ★differentiator]  
   Hash hver scenes render-inputs (klipp-fil-mtime+size, mockup-config, overlays, voiceover) til en cache-nøkkel og gjenbruk ferdig-rendrede scene-segmenter på disk, så bare endrede scener re-rendres ved eksport. Gjør re-eksport av en 40-sceners demo til sekunder i stedet for minutter — det største enkelt-løftet for store demoer.
282. **Inkrementell segment-basert ffmpeg-pipeline (render→concat)** [high · L]  
   Bytt mockup-polish-pro fra én monolittisk pass til per-scene segment-render + ffmpeg concat demuxer, slik at segment-cache fungerer og en feilet scene ikke kaster bort hele jobben. Fundamentet som gjør caching, parallellisme og resume mulig i det hele tatt.
283. **Parallell scene-render via Rayon/tokio worker-pool** [high · M · ★differentiator]  
   Render uavhengige scene-segmenter parallelt opptil (CPU-kjerner − 1) i stedet for sekvensielt, med en kø som streamer per-segment-progress. På en moderne Mac kutter dette total render-tid 3-6x for demoer med mange korte scener.
284. **Hardware-akselerert encoding (VideoToolbox) med CPU-fallback** [high · S]  
   Bruk h264_videotoolbox/hevc_videotoolbox på Apple Silicon i ffmpeg-kommandoen, med libx264-fallback for kvalitet/kompatibilitet. Encoding av lange demoer går fra realtime til mange ganger raskere og senker termisk throttling ved batch-render.
285. **Bakgrunns-render-kø som overlever app-restart** [high · L · ★differentiator]  
   Persistér render-jobber (status, segment-progress, output-sti) i en SQLite-kø slik at eksport kjører i bakgrunnen mens brukeren jobber videre, og kan gjenopptas etter krasj/restart fra siste fullførte segment. Forvandler eksport fra et blokkerende modal-vindu til et fire-and-forget-system som verdensklasse-verktøy har.
286. **Migrer prosjekt-persistens fra localStorage til SQLite/IndexedDB** [high · M]  
   localStorage har ~5MB-tak og er synkron på hovedtråden; med base64-thumbnails per scene sprenger store demoer kvoten og fryser UI ved hver autolagring. Flytt DemoProject + binær-assets til SQLite (Tauri) med async writes for å fjerne taket og UI-hakkingen helt.
287. **Skill thumbnails/screenshots ut av prosjekt-JSON som fil-refererte assets** [high · M]  
   Lagre scene-screenshots som faktiske .jpg/.webp-filer i app-data og referer dem via sti i stedet for å inline base64-data-URLer i modellen. Kutter prosjektstørrelsen 10-50x, gjør serialisering/lasting rask og fjerner den største kilden til minne-blow-up ved mange scener.
288. **Virtualisert scene-liste og recorder-timeline** [medium · S]  
   Render bare synlige scene-kort/steg med en virtuell liste (windowing) i ScriptBuilder, GuidedRecorder og Device Preview. Holder UI flytende ved 100+ scener der dagens full-mount-render begynner å hakke merkbart.
289. **Gjenbruk ett skjult capture-WebviewWindow i stedet for ett per handling** [high · M · ★differentiator]  
   I dag åpnes/lukkes et helt nytt WebviewWindow for hver scan/verify/auto/shot-operasjon, som koster sekunder i nav+load per scene. Hold ett varmt, skjult capture-vindu i bakgrunnen og kjør operasjoner sekvensielt mot det for å gjøre batch-scanning/screenshot av en hel demo dramatisk raskere.
290. **Batch-screenshot av alle scener i én pass med adaptiv kvalitet** [medium · M]  
   Naviger det varme capture-vinduet gjennom hver scenes URL/scroll-posisjon og ta alle thumbnails i én sekvens, lagret som progressivt komprimert WebP. Erstatter dagens ett-vindu-per-bilde med en enkelt effektiv pipeline som skalerer til store demoer.
291. **Streaming proxy-preview vs. full-res master-render** [high · M · ★differentiator]  
   Generer raskt en lav-oppløst proxy (720p, høyt komprimert) for umiddelbar forhåndsvisning, og kjør full-res master kun ved endelig eksport. Gir nær-instant preview-loop selv for lange demoer mens kvalitet bevares i sluttproduktet.
292. **Erspart regex-HTML-parsing med strømmende tolerant parser** [medium · S]  
   Bytt de flere full-dokument-regexene i demo_fetch_site_context (som backtrack-er på store sider) til en enkelt-pass HTML-parser (f.eks. lol_html/scraper) med tidlig stopp. Robustere og mange ganger raskere kontekst-uttrekk på store/komplekse landingssider.
293. **AI-respons-caching og delta-prompting per scene** [high · M · ★differentiator]  
   Cache Claude-svar på (scene-input-hash) og send bare endrede scener ved completeDemoFlow/improveScript, med prompt-caching av den uforanderlige side-konteksten. Kutter AI-latens og kostnad kraftig for store demoer der brukeren itererer på enkelt-scener.
294. **Parallelle AI-kall med samtidighetstak og backpressure** [medium · M]  
   Generer per-scene-manus for mange scener samtidig (begrenset semafor, f.eks. 4 parallelle) i stedet for sekvensielt, med kø og retry på rate-limit. Gjør AI Director / fullfør på en 30-sceners demo til en kort batch i stedet for en lang serie.
295. **Sann runtime-handlingsverifisering i stedet for selector-streng-match** [high · L · ★differentiator]  
   Kjør hver scenes handling i det varme capture-vinduet og verifiser faktisk DOM-/URL-effekt (mutasjon, navigasjon, synlighet) som validerings-signal, batch-kjørt over hele demoen. Hever validering fra kosmetisk streng-sammenligning til ekte korrekthet — et reelt differensiator mot konkurrenter.
296. **Memoiser tunge utledede beregninger (totalDuration, validering, match)** [medium · S]  
   Cache sceneActionMatch, validateScene og totalDuration via selectors/useMemo i Zustand i stedet for å rekjøre over alle scener ved hver state-endring. Eliminerer O(scener)-arbeid på hvert tastetrykk i Script Builder for store demoer.
297. **Innholds-adressert asset-deduplisering og GC** [medium · M]  
   Lagre alle binær-assets (klipp, screenshots, voiceover) innholds-adressert (hash-navn) med referansetelling og bakgrunns-garbage-collection av foreldreløse filer. Hindrer app-data i å vokse ukontrollert over mange prosjekter/re-takes og holder disk-fotavtrykket lavt.
298. **Auto-lagring med debounce, structural sharing og diff-patches** [medium · M]  
   Erstatt full-objekt-spread + full-serialisering ved hver mutasjon med debouncet, strukturelt delt state og lagring av kun endrede scener (patch-journal). Fjerner GC-press og jank som vokser lineært med scene-antall i dagens persist()-mønster.
299. **GPU-akselererte device-mockup-overlays via skjult offscreen-compositing** [medium · L · ★differentiator]  
   Compositér device-ramme + cursor/touch/callout-overlays i et GPU-shader/canvas-pass (WebGL/wgpu) i stedet for per-frame CPU-tegning i tsx-pipelinen. Gjør overlay-rendering (i dag delvis 'kommer') skalerbar til lange høyoppløste demoer uten å tippe render-tiden.
300. **Skybacket prosjekt-sync med lokal-først cache og delta-opplasting** [high · L · ★differentiator]  
   Synk prosjekt-modell + assets til skyen lokal-først med innholds-adresserte delta-opplastinger, så store demoer deles/samarbeides på uten å laste opp alt på nytt. Løser localStorage-only-begrensningen og åpner samarbeid uten å ofre offline-ytelse.
301. **Render-telemetri og adaptiv kvalitets-/throughput-styring** [medium · M · ★differentiator]  
   Mål per-segment render-tid, encoder-throughput, minne og termisk tilstand, og juster parallellisme/oppløsning adaptivt (skru ned på throttling, opp på ledig kapasitet). Gir forutsigbar, selv-optimaliserende ytelse på alt fra MacBook Air til Studio — sjelden i denne kategorien.
302. **Pre-warm AI/site-kontekst og pre-scroll-posisjoner ved prosjekt-åpning** [medium · S]  
   Hent side-kontekst, scan-DOM og beregn startScrollPct for alle scener i bakgrunnen straks prosjektet åpnes, så Script Builder, Responsive Check og opptak starter uten ventetid. Skjuler nettverks-/analyse-latens bak idle-tid for en umiddelbar opplevelse på store prosjekter.

### Tilgjengelighet & inkludering (skjermleser, tastatur, kontrast, undertekster)

303. **Accessibility-First Scene Engine: a11y-tre i hver scene** [high · L · ★differentiator]  
   AI Director leser ekte ARIA-roller, accessible names og fokusrekkefolge fra demo_scan_dom og knytter hver Required Action til et accessibility node (ikke bare CSS-selector), slik at en demo aldri peker pa et element uten tilgjengelig navn. Det gjor demoen verifiserbart tilgjengelig fra forste klikk og er fundamentet alt annet bygger pa.
304. **Skjermleser-spor i interaktiv guide (live ARIA live-regions)** [high · M · ★differentiator]  
   buildInteractiveGuideHtml genererer hotspots som er ekte fokuserbare knapper med aria-label, role og en aria-live=polite stegteller, slik at en NVDA/VoiceOver-bruker kan navigere hele guiden uten a se den. Konkurrentenes klikk-guider er rene pixel-overlays som er usynlige for skjermlesere.
305. **Full tastaturnavigasjon i Guided Recorder og guide-output** [high · M · ★differentiator]  
   Hver Required Action far definert tastatur-ekvivalent (Tab/Enter/piltaster) og guiden eksporteres med komplett focus-trap-fri tastaturflyt + synlig focus-ring. Garanterer at demoen kan gjennomfores uten mus, som er WCAG 2.1.1-krav og noe ingen demo-verktoy leverer.
306. **Innebygd WCAG 2.2 AA-validator i Validation-steget** [high · L · ★differentiator]  
   Utvid validateScene til a kjore en axe-core-aktig regelmotor pa hver scenes screenshot/DOM-snapshot og rapportere kontrast-, navn-, fokus- og target-size-brudd med per-scene a11y-score. Gjor tilgjengelighet til en blokkerende kvalitetsport, ikke et etterpaklokt tillegg.
307. **Automatisk teksting (.srt + brente captions) med TTS-synkronisering** [high · M]  
   Koble voiceover-toggelen til ekte TTS og generer per-scene .srt med korrekt timing fra narration, samt valgfritt innbrente undertekster i video-pipelinen. Lukker det apenbare gapet (ingen lyd/TTS-kilde) og gjor hver demo dovendt-tilgjengelig som standard.
308. **Sanntids tegnspraktolk-spor (avatar eller PiP-video)** [medium · L · ★differentiator]  
   Legg til et valgfritt tegnsprak-spor per scene: enten en AI-generert signing-avatar drevet av narration eller et PiP-opptaksfelt for menneskelig tolk, montert i mockup-pipelinen. Tegnspraktolking i produktdemoer finnes praktisk talt ikke og treffer dove som har tegnsprak som forstesprak.
309. **Lydbeskrivelse (audio description)-spor for visuelle handlinger** [medium · L · ★differentiator]  
   Generer automatisk et separat audio-description-narrasjonsspor som beskriver visuelle hendelser (cursor-bevegelse, fremheving, overganger) i pausene, eksportert som alternativt lydspor. Gjor rene visuelle produktdemoer forstaaelige for blinde brukere uten a forstyrre hovednarrasjonen.
310. **Kontrast- og fargesvakhet-simulator i Device Preview** [high · S · ★differentiator]  
   Legg til toggles i Device Preview for a vise scenen gjennom protanopi/deuteranopi/tritanopi/lav-kontrast-filtre samt en sanntids kontrast-overlay pa overlayText/callouts. Lar skaperen se demoen som 8% av menn med fargeblindhet gjor, for eksport.
311. **Respekter prefers-reduced-motion i guide og video** [medium · M]  
   Interaktiv guide leser prefers-reduced-motion og slar av zoom/pan/cursor-animasjoner, og video eksporteres med en valgfri reduced-motion-variant uten raske overganger eller blinking. Beskytter brukere med vestibulaere lidelser og fotosensitiv epilepsi (WCAG 2.3.1).
312. **Flash/blink-sikkerhetsanalyse i Export (PEAT-style)** [medium · M · ★differentiator]  
   Skann den monterte videoen for fareblitz (>3 flash/sek, rod-blits) for eksport og blokker/advar med tidsstempel. Hindrer at en demo utloser anfall hos fotosensitive seere, et ansvar ingen demo-verktoy tar i dag.
313. **Plain-language AI Improve-modus + lesbarhets-score** [high · S · ★differentiator]  
   Legg til improveScript-varianten plain_language som forenkler narration til CEFR B1/lettlest-niva og viser en lesbarhetsindikator per scene. Gjor demoer forstaaelige for brukere med kognitive funksjonsnedsettelser, lav literacy og ikke-morsmalstalere.
314. **Flersprak-teksting og narrasjon med ett klikk** [high · M · ★differentiator]  
   Bruk Claude til a oversette narration + overlayText + captions til N sprak og generer separate guide-/video-varianter og .srt per sprak fra samme prosjekt. Inkludering pa tvers av sprak gjor en demo global uten reproduksjon.
315. **RTL- og bidi-stotte i overlays, captions og guide** [medium · M]  
   Hele overlay-, caption- og hotspot-tooltip-systemet far dir=auto/RTL-layout slik at arabisk, hebraisk og persisk demoer rendres korrekt speilet. Konkurrenter antar LTR og odelegger RTL-tekst.
316. **Skjermleser-vennlig redaktor-UI (selve Demo Studio)** [high · L]  
   Gjor Flow/Script/Recorder-panelene til Demo Studio fullt tastatur- og skjermleser-betjenbare med ARIA, fokus-styring og statiske ikoner (ufullstendige fanene) gjort tilgjengelige eller fjernet. Et tilgjengelighets-verktoy ma selv vaere tilgjengelig, ellers ekskluderer det skapere med funksjonsnedsettelser.
317. **Accessibility Score-badge + delbar a11y-rapport per demo** [medium · S · ★differentiator]  
   Generer en offentlig, delbar tilgjengelighetsrapport (WCAG-niva, captions ja/nei, tastatur ja/nei, kontrast-resultat) som en badge man kan legge ved demoen. Gir skapere et markedsforingsdiff og presser bransjen mot tilgjengelige demoer.
318. **Cursor- og callout-system som er tilgjengelig fra design** [medium · M]  
   Fullfor det hardkodede (kommer)-cursor/callout-laget med store, hoy-kontrast, formede (ikke bare farge) markorer og tekstede callouts som ogsa eksponeres som tekst til skjermleser/captions. Lukker et eksisterende gap pa en made som tjener bade syn og a11y samtidig.
319. **Pause-/eget-tempo og continueMode=assisted for kognitiv tilgjengelighet** [medium · M]  
   Implementer den definerte men manglende assisted-continueMode slik at guiden venter pa brukeren, tilbyr Repeat step, og aldri auto-avanserer uten samtykke. Kritisk for brukere med kognitive- eller motoriske utfordringer (WCAG 2.2.1 timing).
320. **Target-size og berorings-tilgjengelighet for mobil-demoer** [medium · S]  
   Valider og handhev minimum 24x44px hotspot-/touch-target-storrelse i iPhone/iPad-rammene og advar nar ekte elementer er for sma. Sikrer at mobile produktdemoer faktisk er bruktbare for personer med skjelvinger/motoriske vansker (WCAG 2.5.8).
321. **Tilgjengelig tekst-alternativ-eksport (HTML/PDF step-by-step)** [high · M · ★differentiator]  
   Generer en ren, semantisk, skjermleser-optimalisert tekst+bilde-versjon av demoen (overskrifter, alt-tekst pa hver scene-screenshot, nummererte steg) som likeverdig alternativ til video. Gir et WCAG-konformt alternativ for de som ikke kan bruke video eller interaktiv guide i det hele tatt.
322. **AI-generert alt-tekst og bildebeskrivelser via vision** [high · S · ★differentiator]  
   Bruk det eksisterende vision-sporet til a auto-generere presis alt-tekst for hver scene-screenshot og thumbnail i guide/PDF/HTML-eksport, redigerbart for skaperen. Lukker det vanligste a11y-bruddet (manglende alt-tekst) automatisk pa tvers av alle leveranser.

### Sikkerhet, personvern & compliance (PII-maskering i skjermbilder, GDPR, deling-tilgang)

323. **Realtime PII auto-masking layer on screenshots and recordings** [high · L · ★differentiator]  
   On-device CV+OCR (Tesseract/Apple Vision via Rust) that scans every captured frame/thumbnail for emails, names, phone numbers, card numbers, addresses and IBANs, then blurs or pixelates the matching regions before the pixels ever touch localStorage, Claude vision, or export. This is the single defining capability for the category: most demo tools leak real customer data because the recorder captures whatever is on screen.
324. **DOM-aware PII redaction during capture (not just pixels)** [high · M · ★differentiator]  
   Leverage the existing capture/scan/auto webviews to inject a redaction pass that detects sensitive DOM nodes (input values, email/tel fields, [data-pii], aria-labels, account headers) and overlays masks at the element level before screenshot/recording, giving pixel-perfect redaction tied to ScannedElement selectors rather than fuzzy image regex.
325. **Synthetic demo-data substitution mode** [high · L · ★differentiator]  
   Instead of only blurring, offer a 'fake data' mode that replaces detected PII in the live webview with realistic synthetic values (Acme Corp, jane@example.com) so demos look polished and complete rather than censored with black boxes. No competitor turns redaction into a beautification feature.
326. **Encrypted-at-rest project storage replacing plaintext localStorage** [high · M]  
   Move trrpa.demoStudio.* off plaintext localStorage into an OS-keychain-backed encrypted store (Tauri stronghold / SQLCipher), since projects now embed base64 screenshots that may contain customer PII and currently sit unencrypted on disk. Eliminates a clear GDPR/data-at-rest liability.
327. **Pre-flight PII scan with reviewable redaction report before any export/share** [high · M · ★differentiator]  
   A blocking 'Privacy Review' step that lists every detected PII instance per scene with a thumbnail crop and Keep/Mask toggle, requiring explicit sign-off before video render or guide export. Turns redaction from invisible-and-hopeful into auditable-and-accountable.
328. **Redact-before-Claude guarantee for vision and site-context** [high · M · ★differentiator]  
   Route every screenshot sent to generateSceneScript vision and every demoFetchSiteContext text payload through the redaction pipeline first, with a hard switch that blocks the Claude proxy call if redaction hasn't run. Right now raw logged-in screenshots and scraped page text go straight to a third-party model, which is the most acute compliance gap in the current code.
329. **Signed, expiring, access-controlled share links for interactive guides** [high · L]  
   Replace freely-shareable self-contained HTML with optionally gated guides: password/email-allowlist, expiry date, and revocation, backed by a lightweight Role Room endpoint. Embedded screenshots in a guide are effectively a permanent data export today with zero access control.
330. **Per-project consent & legal-basis ledger** [medium · M · ★differentiator]  
   Capture and store who authorized the demo, the legal basis for recording the target site (own product vs third-party, data-processing agreement), and target-site ToS acknowledgement, surfaced as a required field before capture starts. Directly addresses the GDPR-evidence posture the org already values for Talents/BankID.
331. **Tamper-evident audit log of capture, export, and share events** [medium · M · ★differentiator]  
   Append-only, hash-chained local log of every capture session, screenshot taken, PII detection/override, export, and share-link creation, exportable as a compliance artifact. Gives enterprises the provenance trail they need for SOC2/GDPR audits of demo content.
332. **Sensitive-route guardrails (block capture on banking/health/auth pages)** [medium · S · ★differentiator]  
   A configurable denylist + heuristic detector that warns or hard-blocks capture when the target URL or DOM signals a payment, healthcare, password, or admin-PII surface (e.g. Stripe/bank domains, type=password, SSN patterns), preventing accidental recording of regulated data.
333. **Cursor/keystroke PII protection in recordings** [medium · M · ★differentiator]  
   Suppress typed text in the recording for fields classified as sensitive (the existing 'type' actionType + auto/inject layer already knows the field), showing dots or synthetic text instead of real keystrokes so live typed credentials/PII never appear frame-by-frame.
334. **Redaction profiles per regulation (GDPR / HIPAA / PCI / CCPA)** [medium · M · ★differentiator]  
   Selectable compliance presets that tune which PII classes are detected and how aggressively (e.g. HIPAA adds medical IDs, PCI forces card masking, GDPR adds EU-specific identifiers), so a demo can be certified against a named standard rather than ad-hoc.
335. **Metadata & EXIF scrubbing on all exports** [medium · S]  
   Strip embedded metadata from rendered videos, thumbnail PNGs, and the URLs/host info baked into guides (e.g. internal staging hostnames, auth tokens in query strings), normalizing filenames so exports don't leak environment or identity details.
336. **On-device-only privacy mode with zero cloud AI** [medium · M · ★differentiator]  
   A toggle that runs the entire pipeline (flow seeding from templates, local redaction, export) without ever calling the Claude proxy or any network, for customers under strict data-residency rules who cannot send screenshots/page-text to a third-party model. A category-defining trust feature.
337. **Granular share scopes: redacted-thumbnail vs live-iframe guides** [medium · S]  
   Make explicit and policy-controllable whether a shared guide embeds frozen redacted screenshots or a live iframe of the real (possibly authenticated) site, defaulting to redacted screenshots and warning loudly when live-iframe sharing would expose the recipient's view of real data.
338. **Right-to-erasure and data-retention automation** [medium · M · ★differentiator]  
   Per-project retention policy with auto-expiry/auto-delete of captured media and a one-click 'erase all captured pixels' that purges screenshots, recordings, and share links while keeping the redacted script — satisfying GDPR erasure and minimization obligations.
339. **Watermark & provenance signing for exported demos** [low · M · ★differentiator]  
   Optionally embed a visible/invisible watermark and a cryptographic signature into rendered videos and guides identifying the creator and capture timestamp, deterring leaked-demo misuse and enabling verification that a demo is the unaltered original.
340. **Capture-window isolation & ephemeral session sandboxing** [medium · M]  
   Run the external capture/scan/verify/auto webviews in an isolated, ephemeral profile (no shared cookies/storage with the user's real browser by default, cleared on close) so the demo tool doesn't inadvertently persist the operator's authenticated sessions or expose them across captures.
341. **PII-risk scoring and confidence surfacing per scene** [low · S · ★differentiator]  
   Give each scene a privacy-risk badge (Clean / Review / High-risk) derived from detector confidence, so the operator sees at a glance which scenes need manual review — mirroring the existing Match/Warning/Unverified validation UX but for privacy.
342. **Exportable compliance certificate per finished demo** [medium · M · ★differentiator]  
   Generate a signed PDF 'privacy attestation' summarizing which redaction profile ran, PII classes detected/masked, consent ledger entry, and audit-log hash, that creators can attach when sending a demo to a regulated client — turning compliance into a sellable deliverable alongside the video and guide.

### Monetisering, pakking & vekst-loops (deling-virality, gratis-til-betalt, templates-marked)

343. **Powered-by viral watermark on free-tier guides + videos** [high · S]  
   Every exported video and interactive guide (buildInteractiveGuideHtml) on the free tier carries a subtle clickable 'Made with Demo Studio - create yours free' badge that deep-links to a pre-filled signup; removable only on paid tiers. Because guides are inherently shared with prospects, each shared artifact becomes a self-propagating acquisition channel - the core growth loop competitors like Arcade/Storylane monetize heavily.
344. **Hosted shareable guide links with view analytics** [high · L · ★differentiator]  
   Replace localStorage-only persistence with a cloud-hosted guide URL (demo.theroleroom.com/g/abc) that captures views, step drop-off, hotspot clicks and watch-completion per viewer. Sharing a link instead of an HTML file removes friction AND feeds an analytics-driven upsell ('your guide got 240 views - upgrade to see who'), turning the deliverable into a measurable, monetizable funnel asset.
345. **Template marketplace seeded by demo-type flows** [high · L · ★differentiator]  
   Turn the 8 DEMO_TYPE_TEMPLATES into a public, browsable marketplace where users publish their finished scene-flows (anonymized, URL-swappable) and others clone with one click - with optional paid premium templates and a creator revenue-share. This converts the existing deterministic flow data into a two-sided content economy and a durable SEO/discovery surface no screen-recorder competitor owns.
346. **Instant demo from URL as a free, no-signup hook** [high · M · ★differentiator]  
   Expose the URL-to-flow pipeline (demo_fetch_site_context + flowForDemoType + generateDemoFlow) as a public web tool where anyone pastes a URL and gets an auto-generated narrated demo flow in 30 seconds, gated to export/save behind signup. This 'aha before auth' top-of-funnel is the single strongest free-to-paid loop and showcases the AI Director instantly.
347. **Embeddable interactive guide widget for landing pages** [high · M · ★differentiator]  
   Ship a one-line <script> embed that renders the interactive guide inline on the customer's own website/docs (like Intercom/Storylane embeds), with the powered-by badge and lead-capture step. Embeds live on high-traffic pages and run continuously, making this the highest-leverage distribution surface and a clear B2B upgrade trigger (custom domain, no badge, gated leads).
348. **Usage-metered free tier with clear paywall lines** [high · M]  
   Define a free tier (e.g. 3 projects, 720p export, watermark, 100 guide views/mo) with metered counters surfaced in-app and at export time, so users hit a natural, value-aligned upgrade moment rather than an arbitrary trial clock. Metering on exports/views (the moment of realized value) converts far better than feature-locking the editor.
349. **Lead-capture gate as a native scene type** [high · M · ★differentiator]  
   Add an 'email gate' / CTA scene to the model (new DemoActionType + scene kind) that pauses the interactive guide to collect viewer email before revealing the payoff, piping leads to the CRM. This makes the demo itself a lead-gen machine, giving sales/marketing users a hard ROI reason to pay - a capability Loom-style recorders lack entirely.
350. **One-click multi-format repurposing into shareable cuts** [high · M]  
   Wire the currently-mockup 'AI Export Assistant' cards to actually produce a LinkedIn 1:1 cut, a 9:16 teaser, and a GIF from a single recording using the existing format/render pipeline plus startScrollPct/scene-trim data. More output formats per recording = more places the watermarked artifact spreads, multiplying both reach and perceived value-per-export.
351. **Referral loop with credit rewards built into share flow** [high · M]  
   At the share/export step, offer 'invite a teammate, both get +500 guide views / a month of Pro' with trackable invite links tied to the hosted-guide system. Embedding referral directly at the high-intent share moment (when users are already sending the artifact to others) is where viral coefficient compounds, and credits map cleanly onto the metered model.
352. **Team workspaces with seat-based billing and brand kit** [high · L]  
   Add cloud project sharing, shared template/brand-kit library (logo, colors feeding renderThumbnail + overlays), and per-seat billing aligned with the existing Role Room seat model. Collaboration is the wedge from solo-creator pricing into recurring team/enterprise revenue and dramatically increases stickiness vs single-user localStorage projects.
353. **Pre-baked branded demo packs as a premium SKU** [medium · M · ★differentiator]  
   Sell curated, industry-specific demo packs (SaaS onboarding, fintech investor, e-commerce sales) - bundles of flow templates + tone/script presets + thumbnail layouts - as one-time or subscription add-ons. Packaging the existing template engine into named, outcome-oriented products raises ARPU and gives a concrete 'what do I get' for buyers beyond raw tooling.
354. **Custom domain + full white-label for agencies** [high · M · ★differentiator]  
   Let paid users host guides on their own domain with zero Demo Studio branding and an agency mode that manages many client projects under one account. Agencies producing demos for clients are a high-LTV segment willing to pay premium for white-label, and they become a force-multiplier distribution channel producing dozens of demos.
355. **AI voiceover TTS as a metered premium feature** [high · M]  
   Resolve the unimplemented voiceover toggle by adding multi-voice TTS generation (per language in scriptMeta) billed per minute/character, auto-timed to scene durations and the .srt output. Voiceover removes the biggest 'I need a mic and to re-record' barrier to finishing a demo, increasing completion (and thus share) rates while creating a natural metered upsell.
356. **Interactive guide CTA + conversion tracking with goals** [high · M · ★differentiator]  
   Add a configurable end-of-guide CTA (book demo, start trial, buy) plus goal tracking on the hosted guide so users see conversion rate, not just views. Tying demo engagement to downstream conversions makes the product a measurable revenue tool, justifying higher pricing and giving the clearest possible upgrade ROI story.
357. **Public gallery of best demos as an SEO/discovery engine** [medium · M · ★differentiator]  
   Auto-publish opt-in showcase demos to a public gallery organized by industry and demo-type, each page indexable and linking back to 'make your own'. A growing library of real demos is evergreen organic-search acquisition (people search 'product demo examples') and social proof that compounds without paid spend.
358. **Annual/lifetime plans plus AppSumo-style launch deal** [medium · S]  
   Offer annual pricing (2 months free) and a time-boxed lifetime/AppSumo launch tier to seed early adopters and cash flow for a pre-revenue product. Lifetime deals on creator tools generate a burst of evangelists who produce watermarked demos en masse, jump-starting the viral loop before organic distribution matures.
359. **Slack/Notion/HubSpot share destinations from export** [medium · M]  
   Add one-click publish of a guide/video link to Slack, Notion, and the CRM/HubSpot directly from ExportView. Reducing share friction to the tools where teams actually live increases the number of shares per demo (the multiplier in the viral equation) and embeds Demo Studio into daily B2B workflows.
360. **Auto-localize demos into multiple languages as upsell** [medium · M · ★differentiator]  
   Leverage scriptMeta.language + Claude to one-click translate narration, overlays, and .srt into N languages, generating one shareable guide per locale. Multi-language output multiplies the distributable artifacts from a single build and is a high-value paid feature for companies selling internationally - something no screen-recorder competitor offers natively.
361. **Embedded analytics-driven upgrade nudges (PLG triggers)** [high · M]  
   Instrument key value moments (demo completed, guide hit view threshold, 2nd project, export attempt over free cap) to fire contextual in-app upgrade prompts and lifecycle emails. Product-led growth lives or dies on triggering the upgrade at the realized-value moment rather than via a generic pricing page, and the metered model already produces the needed signals.
362. **Always-up-to-date 'living demos' that re-capture on a schedule** [high · L · ★differentiator]  
   Use the Tauri WebviewWindow capture pipeline to re-run a demo's required actions on a schedule and refresh screenshots/recordings when the target site changes, keeping hosted guides perpetually current. 'Living demos' that never go stale is a sticky subscription justification (you pay to keep them fresh) and a genuine moat - one-shot recorders force a manual redo every release.

