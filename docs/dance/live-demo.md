# DanceAnnotate live-demo

`frontend/client/e2e-dance-annotate.html` mounter DanceAnnotateLayout direkte med ekte open-source dansevideo. Brukes til å visuelt verifisere pixel-perfect rendering uten å gå gjennom DanceWorkspace tab-flow, tour-wizard eller auth.

## Kjør lokalt

```bash
# 1) Start vite dev-server (standardport 5001, eller 5002 hvis 5001 allerede er i bruk)
cd frontend && npm run dev

# 2) Åpne i nettleser
open http://localhost:5001/e2e-dance-annotate.html
```

Du skal se DanceAnnotate-flaten med:
- Topp-bar: logo + project-trigger + Save (med timestamp) + Export + avatar
- Venstre rail: Dashboard + CLIPS-section (1 clip) + Annotations / Statistics / Dancers / Settings + Help
- Video-frame som spiller Big Buck Bunny (10s CC-BY WebM)
- Tids-overlay øverst-venstre (`00:00:00:00` → updates ved seek)
- Timeline med 3 demo-annotations på Steps/Arms/Turns
- CATEGORY TOOLS (5 default-kategorier) + COMMON LABELS + ANNOTATION DETAILS form + SHORTCUTS panel

## Verifikasjons-spec

`frontend/e2e/dance-annotate-live-demo.spec.ts` automatiserer end-to-end-verifikasjonen:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5001 \
  npx playwright test e2e/dance-annotate-live-demo.spec.ts \
  --project=chromium --reporter=list --workers=1
```

3 tester:
1. Flate mountes med video + 3 annotations + alle hoved-komponenter
2. Klikk timeline-blokk seeker video + viser SelectedAnnotation-panel
3. Export-knapp åpner AnnotationExportOverlay med Print + CSV + Lukk

## Video-kilde

[Big Buck Bunny](https://peach.blender.org/) — CC-BY 3.0 Blender Foundation.

Hosted på [test-videos.co.uk](https://test-videos.co.uk/bigbuckbunny/webm-vp9) som stabilt test-CDN. Vi bruker WebM VP9 fordi Playwright Chromium mangler H.264-codec som standard; ekte Chrome/Safari/Firefox spiller mp4-versjoner like fint.

Tidligere forsøkt URL-er som ga 403 ved hot-link: Mixkit, Pexels CDN, Coverr.

## Hvorfor standalone-harness?

Live-demoen omgår [`react-hooks-bug-formations-tabbody`-historikken](../../scripts/lint/check-hooks-after-early-return.sh) ved å mounte `<DanceAnnotateLayout>` direkte uten å gå gjennom DanceWorkspace tab-systemet. Når den oppdages bugs i bredere kode, gir harness-en et "kjent godt" sammenligningsgrunnlag.

Den globale `FirstTimeTour`-overlayen (`zIndex: 9000`) er heller ikke aktiv i denne flaten.

## Mocks

Alle `/api/dance/*` + `/api/casting/projects` + billing-endpoints mock-es via en `window.fetch`-patch installert FØR React mount i `dance-annotate-harness.tsx`. Endrer du mock-data der, last siden på nytt.
