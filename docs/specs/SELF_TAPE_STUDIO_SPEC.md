# Self-Tape Studio — E2E Pixel-Perfect Spec

**Status:** Klar for implementasjon
**Forrige session:** Mockup analysert, spec skrevet 2026-06-05
**Mål:** Pikselperfekt match med Daniels mockup + komplett E2E-flyt
**URL:** `/talents/self-tapes`

---

## 1. Overordnet vision

Self-Tape Studio er talentens **opptaks-arbeidsbenk**. En profesjonell selvopptak-flyt fra prosjekt → manus → opptak → AI-feedback → submission. Designet er en **3-kolonne dark mode dashboard** med tydelig visuell hierarki.

**Brand-fargene:**
- Bakgrunn: `#0c0a09` / `#150b2e` (mørk lilla)
- Card-bg: `palette.bgCard` (eksisterende fra theme.ts)
- Accent: lilla→pink gradient (#a855f7 → #d946ef)
- Suksess: #34d399 (grønn)
- Advarsel: #fbbf24 (gul)

---

## 2. 3-kolonne layout

```
┌─────────────┬──────────────────────────┬──────────────────┬──────────────┐
│             │                          │                  │              │
│  Sidebar    │     Video + actions      │  Script + AI     │ Submission   │
│  (eksist.)  │     + take history       │  Take Mgmt       │ Targets      │
│             │     + status cards       │                  │ + History    │
│             │                          │                  │              │
└─────────────┴──────────────────────────┴──────────────────┴──────────────┘
   240px              flex 1 (~52%)            360px             320px
```

**Responsive breakpoints:**
- `> 1400px`: full 3-kolonne
- `1100–1400px`: høyre kolonne kollapser til drawer (knapp øverst)
- `< 1100px`: alt blir 1-kolonne stacked, video-player får 16:9 aspect ratio

---

## 3. Datamodell (DB-migrate 230 + 231)

### 3.1 `talent_selftape_projects` (migrate 230)

```sql
CREATE TABLE talent_selftape_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id       UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  poster_url      TEXT,                -- Cloudflare R2-URL
  poster_color    VARCHAR(7),          -- fallback bg
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','submitted','archived')),
  role_name       VARCHAR(120),         -- "Sara"
  role_type       VARCHAR(60),          -- "Supporting"
  scene_label     VARCHAR(80),          -- "Scene 3"
  sides_pages     SMALLINT,             -- 2 (antall sider)
  sides_content   TEXT,                 -- markdown av manus
  brief_url       TEXT,                 -- View Brief-link
  source_casting_project_id VARCHAR(255), -- koble til casting_projects (Phase 9 partnership)
  source_partnership_id UUID REFERENCES agency_production_partnerships(id) ON DELETE SET NULL,
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX talent_selftape_projects_talent_idx ON talent_selftape_projects(talent_id, status);
CREATE INDEX talent_selftape_projects_demo_idx ON talent_selftape_projects(is_demo) WHERE is_demo = TRUE;
```

### 3.2 `talent_selftape_takes` (migrate 230)

```sql
CREATE TABLE talent_selftape_takes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES talent_selftape_projects(id) ON DELETE CASCADE,
  take_number     SMALLINT NOT NULL,    -- 1, 2, 3, ...
  duration_ms     INT NOT NULL,         -- 58000 = 00:58
  thumbnail_url   TEXT,                 -- 1st-frame thumbnail (R2)
  video_url       TEXT,                 -- Cloudflare Stream URL
  stream_uid      VARCHAR(64),          -- CF Stream UID for player
  hls_manifest    TEXT,                 -- HLS .m3u8
  status          VARCHAR(20) NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('uploading','processing','ready','failed')),
  notes           TEXT,                 -- "Add Take Note"
  metadata        JSONB DEFAULT '{}'::jsonb,
                  -- {resolution: "1080p", fps: 24, codec: "h264", file_size_bytes: ...}
  ai_feedback_id  UUID REFERENCES talent_selftape_ai_feedback(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, take_number)
);

CREATE INDEX talent_selftape_takes_project_idx ON talent_selftape_takes(project_id, take_number DESC);
```

### 3.3 `talent_selftape_ai_feedback` (migrate 230)

```sql
CREATE TABLE talent_selftape_ai_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id         UUID NOT NULL REFERENCES talent_selftape_takes(id) ON DELETE CASCADE,
  model_version   VARCHAR(40),          -- "claude-opus-4-7" eller "gpt-4o-vision"

  -- 5 kategorier (matcher mockup)
  eye_line        JSONB,                -- {grade: "Great"|"Good"|"Needs work", note: "..."}
  pacing          JSONB,
  sound           JSONB,
  lighting        JSONB,
  performance     JSONB,

  -- Tekniske sjekker (vises i sub-cards under videoen)
  camera_check    JSONB,                -- {status: "all_good", resolution, frame_rate, stability}
  audio_check     JSONB,                -- {status, input_level, background_noise, clarity}
  framing_check   JSONB,                -- {status, headroom, eye_line, lighting}

  overall_grade   VARCHAR(20),          -- "Great"|"Good"|"Needs work"
  detailed_md     TEXT,                 -- markdown for "View detailed feedback"-modal

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX talent_selftape_ai_feedback_take_idx ON talent_selftape_ai_feedback(take_id);
```

### 3.4 `talent_selftape_submissions` (migrate 231)

```sql
CREATE TABLE talent_selftape_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES talent_selftape_projects(id) ON DELETE CASCADE,
  take_id         UUID NOT NULL REFERENCES talent_selftape_takes(id),

  -- 3 target-typer (matcher mockup)
  target_type     VARCHAR(40) NOT NULL
                   CHECK (target_type IN ('agency_direct','private_link','role_specific')),

  -- Felles
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','ready','submitted','viewed','shortlisted','passed')),
  deadline_at     TIMESTAMPTZ,

  -- Agency direct
  agency_org_id   UUID REFERENCES agency_orgs(id),
  agency_preferred BOOLEAN DEFAULT FALSE,

  -- Private link
  private_token   VARCHAR(64),          -- random token for unauthenticated viewing
  private_expires_at TIMESTAMPTZ,

  -- Role-specific (via casting_project + casting_role)
  casting_project_id VARCHAR(255),
  casting_role_id    VARCHAR(255),

  submitted_at    TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,

  metadata        JSONB DEFAULT '{}'::jsonb,
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, target_type, agency_org_id, casting_role_id)
);

CREATE INDEX talent_selftape_submissions_project_idx
  ON talent_selftape_submissions(project_id, status);
CREATE INDEX talent_selftape_submissions_private_token_idx
  ON talent_selftape_submissions(private_token) WHERE private_token IS NOT NULL;
```

### 3.5 `talent_selftape_submission_events` (migrate 231)

Audit-spor: når noen ser/laster ned/kommenterer en submission.

```sql
CREATE TABLE talent_selftape_submission_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES talent_selftape_submissions(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL,
                  -- 'viewed', 'downloaded', 'shortlisted', 'passed', 'commented'
  actor_user_id   VARCHAR(255),
  actor_label     VARCHAR(120),         -- "Casting director — Stella"
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Backend-endepunkter

Ny fil: `backend/server/talent-selftapes-routes.ts`

### 4.1 Projects

| Method | Path | Hva |
|---|---|---|
| GET | `/api/role-room/talents/selftapes/projects` | Liste mine prosjekter |
| POST | `/api/role-room/talents/selftapes/projects` | Lag prosjekt |
| GET | `/api/role-room/talents/selftapes/projects/:id` | Hent prosjekt + tilkoblet take/feedback/submission state |
| PATCH | `/api/role-room/talents/selftapes/projects/:id` | Oppdater (name, role, scene, sides...) |
| DELETE | `/api/role-room/talents/selftapes/projects/:id` | Soft-delete (status='archived') |

### 4.2 Takes

| Method | Path | Hva |
|---|---|---|
| GET | `/api/role-room/talents/selftapes/projects/:projectId/takes` | Liste takes for prosjekt |
| POST | `/api/role-room/talents/selftapes/projects/:projectId/takes/init-upload` | Init CF Stream upload-URL |
| POST | `/api/role-room/talents/selftapes/projects/:projectId/takes/finalize` | Etter upload → marker som ready, generer thumbnail, kjør AI |
| PATCH | `/api/role-room/talents/selftapes/takes/:takeId` | Oppdater notes/metadata |
| DELETE | `/api/role-room/talents/selftapes/takes/:takeId` | Slett take |
| POST | `/api/role-room/talents/selftapes/takes/:takeId/select` | Marker som "current" for prosjekt |

### 4.3 AI Feedback

| Method | Path | Hva |
|---|---|---|
| POST | `/api/role-room/talents/selftapes/takes/:takeId/feedback/regenerate` | Re-run AI |
| GET | `/api/role-room/talents/selftapes/takes/:takeId/feedback` | Hent feedback for take |

**AI-integrasjon:**
- Bruk Claude Opus 4.7 (1M context) med video-frames + lyd-transkript
- Eller GPT-4o-vision som fallback
- Output JSON-schema for hver kategori (eye_line/pacing/sound/lighting/performance)
- Cache i `ai_feedback`-tabellen

### 4.4 Submissions

| Method | Path | Hva |
|---|---|---|
| GET | `/api/role-room/talents/selftapes/projects/:projectId/submissions` | Liste targets |
| POST | `/api/role-room/talents/selftapes/projects/:projectId/submissions` | Add target |
| PATCH | `/api/role-room/talents/selftapes/submissions/:id` | Toggle enabled, sett deadline, etc. |
| POST | `/api/role-room/talents/selftapes/submissions/:id/send` | Send/submit (fire-and-forget e-post via Resend) |
| POST | `/api/role-room/talents/selftapes/submissions/:id/rotate-link` | Roter private link |
| GET | `/api/role-room/talents/selftapes/submissions/:id/history` | Submission-events (Viewed/Shortlisted/etc) |

### 4.5 Public viewing (private link)

| Method | Path | Hva |
|---|---|---|
| GET | `/api/public/selftape/:token` | Vis self-tape via privat link (no auth) |
| POST | `/api/public/selftape/:token/track-view` | Logg viewing-event |

---

## 5. Komponent-struktur

```
frontend/client/src/components/role-room/talents-app/pages/
  SelfTapeStudioPage.tsx                          ← hovedside (3-kolonne layout)

frontend/client/src/components/role-room/talents-app/components/selftape/
  SelfTapeProjectInfoCard.tsx                     ← poster + role/scene/sides + "View Brief"
  SelfTapeVideoPlayer.tsx                         ← player + controls + progress
  SelfTapeRecordButton.tsx                        ← "Record New Take" (åpner opptaks-modal)
  SelfTapeRecorderDialog.tsx                      ← getUserMedia + MediaRecorder
  SelfTapeUploadButton.tsx                        ← drag-drop / file picker → CF Stream
  SelfTapePreviousTakesStrip.tsx                  ← thumbnails 1-5 med highlighted current
  SelfTapeStatusCards.tsx                         ← Camera/Audio/Framing (3 sub-cards)
  SelfTapeScriptCard.tsx                          ← manus med highlighted aktiv linje
  SelfTapeTakeManagement.tsx                      ← radio-list med varigheter
  SelfTapeAIFeedbackCard.tsx                      ← 5 kategorier med grade-badges
  SelfTapeAIFeedbackDetailModal.tsx               ← "View detailed feedback"
  SelfTapeSubmissionTargets.tsx                   ← 3 target-cards
  SelfTapeAlmostReadyCard.tsx                     ← "You're almost ready"-gradient-card
  SelfTapeSubmissionHistory.tsx                   ← viewed/shortlisted-liste
  SelfTapeProjectLibraryDialog.tsx                ← Project Library-modal (alle prosjekter)
  SelfTapeNewProjectDialog.tsx                    ← + New Project-flyt

frontend/client/src/components/role-room/services/
  roleRoomSelfTapesService.ts                     ← API-shim
```

---

## 6. Detaljert spec per komponent

### 6.1 SelfTapeProjectInfoCard

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [POSTER]  Project          [View Brief] →                │
│  64x80    Northern Lights  ● Active                       │
│           ─────────────                                   │
│           Role        Scene       Sides                   │
│           Sara        Scene 3     2 pages                 │
└──────────────────────────────────────────────────────────┘
```

**Detaljer:**
- Poster: 64×80px (4:5 ratio), `borderRadius: 8px`, `objectFit: cover`
- Project-label: small caps `palette.textMuted`, 0.7rem
- Project navn: 1.1rem fontWeight 800
- "Active" pill: `bgcolor: rgba(52,211,153,0.16)`, `color: #34d399`, prikk-ikon, fontWeight 700
- Role/Scene/Sides: 3 kolonner med små label-tekster + verdier i fontWeight 600
- "View Brief"-knapp: outlined, with chevron-icon

### 6.2 SelfTapeVideoPlayer

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Current Take: Take 3                          [⚙ tool]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│         [VIDEO 16:9, autoplay=false, loop=false]         │
│                                                          │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░  (progress)      │
│  ⏸  ⏪10  ⏩10  🔊  00:21 / 01:12      1x  ⚙  ⛶          │
└──────────────────────────────────────────────────────────┘
```

**Detaljer:**
- Video-aspect: 16:9 forced (kan også støtte 9:16 vertical)
- "Current Take: Take X" header: 0.85rem `textMuted`
- Tool-icon top-right: 28×28 IconButton (åpner sidewise menu med "Replace video", "Add annotations", "Download")
- Progress-bar: lilla→pink gradient med drop-shadow `0 0 8px rgba(168,85,247,0.4)`
- Klikk på progress hopper til position. Hover viser tidsstempel-tooltip
- Controls-rad: pause/play (toggle), -10s, +10s, volum (0-100 slider on hover), tidsstempel-tekst, hastighet (dropdown: 0.5x/0.75x/1x/1.25x/1.5x/2x), settings (kvalitet/captions), fullscreen
- Keyboard: SPACE (play/pause), J/L (-10/+10s), K (pause), ↑↓ (volum), F (fullscreen)

### 6.3 SelfTapeRecordButton + SelfTapeRecorderDialog

**Recorder-flow:**
1. Klikk "Record New Take" → modal åpnes med 3 steg:

   **Steg 1: Tilgang**
   - "Vi trenger tilgang til kamera + mikrofon"
   - Knapp: "Gi tilgang" → `navigator.mediaDevices.getUserMedia({video: true, audio: true})`

   **Steg 2: Justering**
   - Live-preview (mirror-effekt, 720p)
   - Camera selector (hvis flere)
   - Mic level-meter
   - Lighting/framing tips (sidebar, animert)
   - Knapp: "Start opptak (3s nedtelling)"

   **Steg 3: Opptak**
   - 3..2..1 nedtelling (stor lilla)
   - Stor opptaks-indikator: rød prikk + "REC 00:00"
   - "Pause" + "Stopp opptak"-knapper
   - Maks-grense: 5 minutter

   **Steg 4: Forhåndsvisning**
   - Avspilling av opptaket
   - Knapper: "Bruk denne" (uploader til CF Stream) | "Ta om" | "Avbryt"

**Tekniske detaljer:**
- `MediaRecorder` med VP9 codec hvis støttet, fallback til H.264
- Bitrate: 6 Mbps (1080p) eller 3 Mbps (720p)
- Upload skjer via CF Stream Direct Upload (init-upload returnerer signed URL)
- Progress-bar under opplasting
- Etter opplasting: backend kjører `finalize` → AI-feedback genereres async

### 6.4 SelfTapePreviousTakesStrip

**Layout:** 5 cards horisontalt scrollable, hver med:
- Nummer-badge top-left (lilla pill)
- 16:9 thumbnail med play-overlay
- Varighet bottom-right
- Tre-prikker meny: "Slett", "Set as current", "Add note"
- **Current take** har lilla border + lett glow

**Animasjon:** Hover → translateY(-2px) + skygge

### 6.5 SelfTapeStatusCards (Camera / Audio / Framing)

**Layout:** 3 like cards, hver:
```
┌─────────────────────────┐
│ 📷 Camera     All good  │
│                          │
│ Resolution    1080p     │
│ Frame Rate    24 fps    │
│ Stability     Good      │
└─────────────────────────┘
```

**Detaljer:**
- Ikon top-left: 24px outlined
- Header: 0.95rem fontWeight 700
- "All good"-pill: grønn, bgcolor `rgba(52,211,153,0.16)`, color `#34d399`
- Rader: label venstre (`textMuted` 0.85rem), verdi høyre med farge (Good=grønn, Low/Clear/On Mark=grønn)
- Hvis status er "needs_work" → ikon + verdi blir oransje/rød

**Grader-mapping:**
- "Great" / "Good" / "Clear" / "Low" / "On Mark" / "Well Lit" → `#34d399` (grønn)
- "Fair" / "Could be better" → `#fbbf24` (gul)
- "Poor" / "Too dark" / "Too noisy" → `#f87171` (rød)

### 6.6 SelfTapeScriptCard

**Layout:**
```
┌──────────────────────────────────┐
│ Script / Scene    View Full Script→│
├──────────────────────────────────┤
│ Scene 3                  2 pages  │
│                                   │
│ SARA                              │
│ I didn't think you'd actually    │
│ come.                             │
│                                   │
│ ALEX                              │
│ I said I would.                  │
│                                   │
│ ┌───────────────────────────┐    │
│ │ SARA  (highlighted lilla) │    │
│ │ You said a lot of things. │    │
│ │ Not all of them true.     │    │
│ └───────────────────────────┘    │
│                                   │
│ ALEX                              │
│ I know.                           │
│                                   │
│ SARA                              │
│ Do you?                           │
└──────────────────────────────────┘
```

**Detaljer:**
- Karakter-navn: small caps `textMuted` 0.78rem letterSpacing 0.1em
- Dialog-tekst: 0.95rem lineHeight 1.5
- **Highlighted linje** (aktiv during avspilling):
  - `bgcolor: rgba(168,85,247,0.18)`
  - `borderLeft: 3px solid #a855f7`
  - `borderRadius: 8px`
  - `padding: 12px 16px`
- Hvis brukeren spiller av video → highlight følger lyd (via lyd-transkript-tidsstempler)
- "View Full Script" → åpner sidekol-drawer med fullt manus (markdown rendered)
- Max-height: 360px med scroll

### 6.7 SelfTapeTakeManagement

**Layout:**
```
┌──────────────────────────────────┐
│ Take Management        5 takes    │
├──────────────────────────────────┤
│  ⚪ 1   Take 1            00:58   │
│  ⚪ 2   Take 2            01:05   │
│  ● 3   Take 3            01:12   │  ← valgt
│  ⚪ 4   Take 4            00:47   │
│  ⚪ 5   Take 5            01:01   │
│                                   │
│ + Add Take Note                   │
└──────────────────────────────────┘
```

**Detaljer:**
- Radio-button + nummer + label + varighet
- Valgt rad: `bgcolor: rgba(168,85,247,0.10)`, border-left lilla
- Klikk på rad → bytt current take + last video-player
- "+ Add Take Note" → modal med textarea (synker `notes`-feltet)

### 6.8 SelfTapeAIFeedbackCard

**Layout:**
```
┌──────────────────────────────────────┐
│ ✨ AI Feedback             [Beta]    │
├──────────────────────────────────────┤
│ 👁 Eye Line     Great eye…   [Great] │
│ 🎯 Pacing       Nice rhythm… [Good]  │
│ 🔊 Sound        Audio is…    [Great] │
│ 💡 Lighting     Well bal…    [Great] │
│ 🎭 Performance  Emotional…   [Good]  │
│                                       │
│ View detailed feedback         →     │
└──────────────────────────────────────┘
```

**Detaljer:**
- Header har AI-sparkle-ikon (AutoAwesomeOutlined) + "Beta"-pill (lilla soft)
- Hver rad:
  - Ikon 18px (left)
  - Kategori-navn 0.85rem fontWeight 600
  - Trunkert note (max 50 chars) i `textMuted`
  - Grade-pill høyre:
    - "Great" → `#34d399` på `rgba(52,211,153,0.16)`
    - "Good" → `#fbbf24` på `rgba(251,191,36,0.16)`
    - "Needs work" → `#f87171` på `rgba(248,113,113,0.16)`
- Klikk på rad → expand med full note
- "View detailed feedback" → modal med markdown-rendered full analyse + tidsstempler i video

**AI-prompt-template (Claude Opus 4.7):**
```
Du er en profesjonell skuespiller-coach. Analyser denne self-tape:
- Video-frames: [base64 hver 2s]
- Audio-transkript: [...]
- Karakter: Sara (Supporting i Northern Lights)
- Scene: [manus]

Returner JSON med 5 kategorier:
- eye_line: {grade, note} — øyekontakt + tilstedeværelse
- pacing: {grade, note} — rytme, pauser, timing
- sound: {grade, note} — lyd-kvalitet
- lighting: {grade, note} — lys-balanse
- performance: {grade, note} — emosjonell intent + autentisitet

Også teknisk:
- camera_check: {resolution, frame_rate, stability}
- audio_check: {input_level, background_noise, clarity}
- framing_check: {headroom, eye_line, lighting}

Grade: "Great" | "Good" | "Needs work"
Note: max 60 chars
detailed_md: 200-300 ord markdown med konkrete forbedringspunkter
```

### 6.9 SelfTapeSubmissionTargets

3 cards (Agency Direct / Private Link / Role-Specific). Hver:

**Agency Direct:**
```
┌─────────────────────────────────┐
│ [S] Stella Casting       [Toggle]│
│     ★ Preferred  Direct submission│
│                                  │
│ Deadline       Status            │
│ May 31, 2024   ● Ready           │
└─────────────────────────────────┘
```
- Logo: 36px avatar med agency-fargen
- "★ Preferred": gold-badge `#fbbf24`
- Toggle: MUI Switch lilla
- Status-prikk: grønn (Ready), gul (Pending), rød (Error)

**Private Link:**
```
┌─────────────────────────────────┐
│ 🔗 Private Link          [Toggle]│
│     Shareable link for agents…  │
│                                  │
│ [📋 Copy Link]              ...  │
└─────────────────────────────────┘
```
- Klikk "Copy Link" → kopierer URL + toast "Link kopiert!"
- "..."-meny: "Roter token", "Sett utløpsdato", "Slett link"

**Role-Specific:**
```
┌─────────────────────────────────┐
│ 📁 Role-Specific Submission [Toggle]│
│    Submit directly to this role    │
│                                    │
│  Role      Sara – Supporting       │
│  Project   Northern Lights         │
│                                    │
│  [Review & Submit]            ...  │
└─────────────────────────────────┘
```
- "Review & Submit"-knapp: lilla gradient (samme som Foreslå-knappen, Phase 9.10)
- Klikk → åpner submission checklist modal

### 6.10 SelfTapeAlmostReadyCard

```
┌───────────────────────────────────┐
│ 🛡 You're almost ready!            │
│                                    │
│ Review your take, check the       │
│ feedback, and submit with         │
│ confidence.                       │
│                                    │
│ [Go to Submission Checklist  →]  │
└───────────────────────────────────┘
```

- Bakgrunn: `linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(217,70,239,0.12) 100%)`
- Border: `1px solid rgba(168,85,247,0.42)`
- Shield-ikon: lilla 24px
- CTA-knapp: gradient lilla→pink med chevron

### 6.11 SelfTapeSubmissionHistory

```
┌───────────────────────────────────┐
│ Submission History     View all → │
├───────────────────────────────────┤
│ The Silent Echo                    │
│ Role: Ada                          │
│ Submitted May 10, 2024  ● Viewed   │
├───────────────────────────────────┤
│ Echoes Within                      │
│ Role: Livia                        │
│ Submitted Apr 28, 2024 ● Shortl.   │
└───────────────────────────────────┘
```

**Status-badges:**
- "Viewed" → `#38bdf8` blå
- "Shortlisted" → `#34d399` grønn med ★-ikon
- "Passed" → `#9ca3af` grå
- "Pending" → `#fbbf24` gul

---

## 7. Routing + Navigasjon

**URL-strukturer:**
- `/talents/self-tapes` → Default (åpner siste/aktive prosjekt)
- `/talents/self-tapes?project=<uuid>` → Spesifikt prosjekt
- `/talents/self-tapes?project=<uuid>&take=<uuid>` → Spesifikk take
- `/talents/self-tapes/new` → Wizard for nytt prosjekt
- `/talents/self-tapes/library` → Project Library-side

**Demo-modus:**
- `?demo=1` triggers `is_demo=TRUE` fixture
- Demo-bruker (Phase 9.9) får predefinert prosjekt "Northern Lights" med 5 takes + AI-feedback + 3 submissions
- Migrasjon 232: seed demo-data

---

## 8. State management

**Per-side state (useState i SelfTapeStudioPage):**
- `currentProjectId: string | null`
- `currentTakeId: string | null`
- `takes: SelfTapeTake[]`
- `aiFeedback: AIFeedback | null`
- `submissions: SelfTapeSubmission[]`
- `submissionHistory: SubmissionEvent[]`
- `recorderOpen: boolean`
- `projectLibraryOpen: boolean`
- `newProjectOpen: boolean`

**Service-laget:** `roleRoomSelfTapesService.ts` cacher med React Query (eller egen `react-query`-wrapper hvis ikke installert).

**Polling:** Etter `finalize` → poll AI-feedback hvert 5s (max 5 min) til status `ready`.

---

## 9. Pikselperfekt mockup-mapping

### Sidebar (eksist. TalentsAppShell)
- "Self-Tapes" får nå `ready: true` (er disabled i dag)
- Når aktiv: lilla highlight (eksist. styling)

### Header (hovedkolonne top)
- Title: "Self-Tape Studio" — `fontSize: 1.8rem, fontWeight: 800, palette.textPrimary, lineHeight: 1.15`
- Subtitle: "Record, review, and perfect your audition." — `palette.textMuted, fontSize: 0.9rem, mt: 0.6`
- Knappe-rad høyre:
  - "Project Library": outlined, mørk lilla border, chevron-ikon
  - "+ New Project": filled lilla gradient (samme som Foreslå-knappen)

### Spacing
- Hovedpadding: 3 (24px)
- Card-padding: 2.4 (~19px)
- Card-gap: 2 (16px)
- Sub-card-gap (Camera/Audio/Framing): 1.2 (~10px)

---

## 10. E2E test-flyt (Playwright)

`docs/specs/selftapes-e2e-checklist.md`:

1. Talent åpner `/talents/self-tapes?demo=1` → ser Northern Lights-prosjekt
2. Klikk "Record New Take" → modal med kamera-tillatelse
3. Mock `getUserMedia` → tar opp 5 sek → klikk "Stopp"
4. "Bruk denne" → upload progress → finalize
5. AI-feedback dukker opp innen 30 sek
6. Klikk "View detailed feedback" → markdown-modal åpnes
7. Slå PÅ "Stella Casting"-target → Submit
8. Klikk "Copy Link" på Private Link → utklippstavle har URL
9. Åpne `/api/public/selftape/:token` i ny tab → video spilles uten innlogging
10. Sjekk Submission History: ny entry "Viewed" innen 10 sek

---

## 11. Implementasjons-rekkefølge (klar for neste session)

**Fase A (backend, 2-3 timer):**
1. Migrate 230 (projects + takes + ai_feedback)
2. Migrate 231 (submissions + events)
3. Migrate 232 (demo-seed)
4. `talent-selftapes-routes.ts` — CRUD-endepunkter (uten AI ennå)
5. CF Stream init-upload-integrasjon
6. Service-lag i frontend

**Fase B (frontend grunnlag, 3-4 timer):**
1. SelfTapeStudioPage 3-kolonne layout
2. SelfTapeProjectInfoCard
3. SelfTapeVideoPlayer
4. SelfTapePreviousTakesStrip
5. SelfTapeStatusCards
6. SelfTapeScriptCard (mock manus først)
7. Routing + demo-data løper opp

**Fase C (opptak + upload, 2-3 timer):**
1. SelfTapeRecorderDialog (getUserMedia + MediaRecorder)
2. SelfTapeUploadButton
3. CF Stream direct upload-flyt
4. Upload-progress + finalize-handling

**Fase D (AI + submissions, 2-3 timer):**
1. AI-feedback-genereringsendepunkt (Claude Opus)
2. SelfTapeAIFeedbackCard + DetailModal
3. SelfTapeSubmissionTargets
4. Private link public-view-endepunkt
5. SelfTapeSubmissionHistory

**Fase E (polering + E2E, 1-2 timer):**
1. AlmostReady-card
2. Project Library + New Project-modal
3. Norsk lokalisering av alle strenger
4. Playwright E2E-test
5. Screenshot + video for docs/

**Estimert total tid:** 10-15 timer over 2-3 sesjoner

---

## 12. Tekniske avhengigheter

- **Cloudflare Stream:** allerede satt opp (se `cms-media-service.ts`)
- **Cloudflare R2:** for thumbnails (allerede satt opp)
- **Resend:** for submission-bekreftelse (allerede integrert)
- **Claude Opus 4.7:** for AI-feedback (krever ANTHROPIC_API_KEY)
- **MediaRecorder API:** standard browser-feature

**Ingen nye npm-deps trengs.**

---

## 13. Konsistens med eksisterende Phase 9-stack

- Bruk `palette` + `radius` fra `theme.ts`
- Bruk `cardSx` mønsteret fra AgencyPartnershipsPage
- Bruk samme gradient-knapp-stil som Phase 9.10 (PR #178)
- Bruk samme empty state-mønster (PR #191)
- Bruk samme skeleton-loading (PR #191)
- Bruk samme tooltip-stil som dashboard-KPI-er (PR #198)

---

## 14. Norsk lokalisering

Per memory `feedback_use_mui_icons_not_emoji` + dagens stavefiks (Byrå, ikke Bryå):

- "Self-Tape Studio" → "Self-tape-studio"
- "Record, review, and perfect your audition." → "Spill inn, vurder og perfeksjoner din audition."
- "Project Library" → "Prosjekt-bibliotek"
- "New Project" → "Nytt prosjekt"
- "Active" → "Aktiv"
- "View Brief" → "Se brief"
- "Current Take" → "Nåværende take"
- "Record New Take" → "Spill inn ny take"
- "Upload Video" → "Last opp video"
- "Previous Takes" → "Tidligere takes"
- "Take Management" → "Take-styring"
- "Add Take Note" → "Legg til take-notat"
- "AI Feedback" → "AI-tilbakemelding"
- "View detailed feedback" → "Se detaljert tilbakemelding"
- "Submission Targets" → "Submission-mål"
- "You're almost ready!" → "Du er nesten klar!"
- "Go to Submission Checklist" → "Åpne submission-sjekkliste"
- "Submission History" → "Submission-historikk"
- "Viewed" → "Sett"
- "Shortlisted" → "På kortliste"
- "Add target" → "Legg til mål"
- "Preferred" → "Foretrukket"
- "Ready" → "Klar"

Alle ikoner via `@mui/icons-material`. INGEN emoji i UI-tekster.

---

## 15. Åpne spørsmål til Daniel (avklares før neste session)

1. **Maks-varighet på take?** 5 min er foreslått — bekreft eller annet.
2. **Vertikal video-støtte?** Mange skuespillere tar opp i 9:16 nå.
3. **Auto-transcript via Whisper?** For å drive AI-feedback-tekst.
4. **Skal "Private Link" ha passord-mulighet?** GDPR-relevant.
5. **Skal "Shortlisted"-statusen sende push-varsel + e-post?**
6. **Project Library = kun mine prosjekter, eller skal byrå-foreslåtte casting-prosjekter også vises?** (kobling til Phase 9 partnership)

---

## 16. Vedlegg

Se også:
- `docs/partnerships-demo/README.md` — Phase 9 partnership-flyten
- `feedback_use_mui_icons_not_emoji.md` (memory)
- `feedback_vercel_prod_force.md` (memory) — for deploy-rutiner

**Mockup-referanse:** `~/Downloads/ChatGPT Image May 30, 2026, 09_42_11 PM (2).png`
