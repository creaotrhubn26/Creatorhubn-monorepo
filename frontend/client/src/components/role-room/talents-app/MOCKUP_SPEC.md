# Talent Registry (mockup #2) — pixel-spec

Sannhetskilde for `/talents/registry`. Mockup re-sendt 2026-05-31.

## 7 hovedregioner
1. Sidebar (samme som Partners — Talent Registry aktiv)
2. Topbar (placeholder: "Search talents by name, skills, languages, city…")
3. Page header + Grid/List toggle
4. Advanced Filters card (2 rader × 5 felter + "More filters")
5. Featured Talents karusell (5 horisontal-cards + venstre/høyre-piler)
6. Talent-grid (4-kolonner, bookmark/video/eye-actions)
7. Right sidebar (Saved Searches + Registry Overview + sparkline)

## Advanced Filters
- Row 1: Location · Playing age · Languages · Dialects · Skills
- Row 2: Gender · Availability · Representation · Self-tape status · [More filters]

## Saved Searches eksempel
- Oslo 20-30 Drama (142)
- Bergen 30+ Nordic look (86)
- Trondheim Young Talent (67)
- English speaking actors (213)
- Comedic actors (128)
- Bunn: "+ Save new search"

## Registry Overview
- 1,247 Visible talents
- +87 New signups Last 30 days
- Sparkline

---

# Partners & Collaboration — pixel-spec

Kilde: Mockup #11 sendt 2026-05-30 av Daniel. **Sannhetskilde** for
implementering. Sjekkliste — hvert element må verifiseres mot mockupen
før commit.

## Layout (10 hovedregioner)

1. **Sidebar** (venstre, fast bredde ~240px)
2. **Topbar** (full bredde minus sidebar, ~64px høyde)
3. **Page header** (h1 + subtitle + Invite Partner-knapp)
4. **Stat-cards** (4 stk, horisontal grid)
5. **Tabs + søk/filter-bar**
6. **Partner-tabell** (venstre kolonne av split)
7. **Permissions Matrix** (høyre kolonne av split)
8. **Right-sidebar** (selected partner detail, fast bredde)
9. **Collaboration Feed** (bunn, full bredde)
10. **Footer** (helt nederst i sidebar)

## 1) Sidebar
- Bredde: ~240px (fast)
- Bakgrunn: deep navy-purple gradient (subtilt mørkere enn main content)
- Logo top: lilla ikon med teater-masker + filmstrip-mønster, deretter
  "THE / ROLE ROOM / TALENTS" tekst-lockup (THE liten, ROLE ROOM stort
  hvitt, TALENTS spread lilla)
- Menu-items (8 stk, hver med icon venstre):
  1. 🏠 Dashboard
  2. 👥 Talent Registry
  3. 👤 Profiles
  4. ▶️ Self-Tapes
  5. 📅 Auditions
  6. 👥👥 **Partners & Collaboration** ← ACTIVE (lilla bg + lilla venstre-kant)
  7. 🔒 Permissions
  8. ⚙️ Settings
- Item-states: default (muted tekst), hover (svak bg), active (full lilla
  bg + lilla 3px venstre-bar)
- Bunn-card: "Need help? / Visit our Help Center for guides and tips. /
  [Go to Help Center →]"
- Under: language-dropdown "🌐 English (NO)"
- Helt nederst: "© The Role Room Talents 2024" (small muted)

## 2) Topbar
- Bakgrunn: samme som main content (mørk lilla)
- Søkebar i midten: full-width, rounded, placeholder "Search talents, roles, partners..."
- Til høyre: 🔔 bell-ikon + user-chip (avatar + "Ingrid Nilsen" + "Talent" + ▾)

## 3) Page header
- H1: "Partners & Collaboration" (stor, hvit, bold)
- Subtitle: "Collaborate securely with casting partners and professional centers. Share talent, resources, and opportunities." (muted, ~14px)
- Top-right knapp: "+ Invite Partner" — lilla gradient-pill med + ikon

## 4) Stat-cards (4 like, grid)
Hvert kort:
- Label (top): "Active Partners" (muted, uppercase-ish)
- Stor tall: "18" (huge, ~2.4rem, hvit, bold)
- Beskrivelse: "Partners with active access" (small muted)
- Stort ikon i top-right (lilla, ~28px)

Card #1: Active Partners | 18 | Partners with active access | 👥
Card #2: Shared Talent Pools | 6 | Pools shared across partners | 👥
Card #3: Pending Requests | 3 | Awaiting your approval | ⌛
Card #4: GDPR-Compliant Permissions | 100% | All data access is controlled | 🛡

## 5) Tabs + søk/filter-rad
- Tabs venstre: "All Partners" (active, lilla underline) | "Casting Partners" | "Professional Centers" | "Invitations"
- Søk høyre: 🔍 input "Search partners..."
- Filter-knapp helt høyre: "≡ Filters ▾" (outline)

## 6) Partner-tabell (venstre, ~60% bredde)
Headers: Partner | Role | Access Level | Last Activity | (action ⋯)

Rader (5 viste — vi har 18 totalt):
| Sel | Avatar | Navn / Lokasjon | Role-tag | Access Level | Last Activity |
|-----|--------|-----------------|----------|--------------|---------------|
| ⦿  | NL (lilla) | Northern Lights Casting / Oslo, Norway | Casting Partner | ✓ Full Access (grønn) | 🟢 Today, 10:24 |
| ○  | SC (annet farge) | Stella Casting / Copenhagen, Denmark | Casting Partner | ⚠ Limited Access (gul) | 🟢 Yesterday, 16:45 |
| ○  | NS | Nordic Skuespillersenter / Oslo, Norway | Professional Center | 🛡 Custom Access (lilla) | 🟢 May 18, 2024 |
| ○  | BF | Bergen Film Academy / Bergen, Norway | Professional Center | ⚠ Limited Access | 🟢 May 17, 2024 |
| ○  | DR | Dramatikkens Hus / Oslo, Norway | Professional Center | 👁 View Only (blå) | 🟢 May 15, 2024 |

- Northern Lights er VALGT — radio-fylt, hele raden subtle highlighted
- Hver row har 3-dots actions helt høyre
- Bunn: "Showing 1-5 of 18 partners" venstre + pagination høyre: < 1 2 3 4 >

## 7) Permissions Matrix (høyre, ~40% bredde — samme card-rad som tabell)
- Header: "Permissions Matrix"
- Subtitle: "What partners can view and access ⓘ"
- Kolonner: 👤 Profiles | ▶ Self-Tapes | 🎓 Workshops | 📅 Auditions
- 5 rader (matchet tabell): NL, SC, NS, BF, DR (samme avatar-bobler)

Grid:
| | Profiles | Self-Tapes | Workshops | Auditions |
|---|---|---|---|---|
| NL | ✓ | ✓ | ✓ | ✓ |
| SC | ✓ | ✓ | — | ✓ |
| NS | ✓ | ✓ | — | — |
| BF | ✓ | — | ✓ | — |
| DR | ✓ | — | — | — |

(✓ = grønn check-circle, — = grå strek)

Bunn: "Manage global permission presets >"

## 8) Right-sidebar (helt høyre, ~280px)
Card med:
- Header: NL avatar + "Northern Lights Casting" + "Casting Partner" pill
- Kontakt:
  - 📍 Oslo, Norway
  - ✉ contact@northernlights.no
  - 📞 +47 22 33 44 55
  - 🌐 northernlights.no
- "Visibility & Access" header + "Edit"-link (høyre)
  - Access Level: Full Access (lilla)
  - Data Residency: EU/EEA
  - Profiles: All profiles
  - Self-Tapes: All self-tapes
  - Audition Invites: View & Send
  - Workshops: View only
- Knapper (vertikal stack):
  - "🔒 Edit Access" — lilla gradient, full bredde
  - "👤 Send Invite" — outline
  - "👥 View Shared Talents" — outline

## 9) Collaboration Feed (bunn, full bredde card)
- Header venstre: "Collaboration Feed"
- "View all activity" høyre
- Subtitle: "Recent activity across your partner network"
- 5 aktivitets-kort i en rad (horisontal scroll om for mange):

| Avatar | Tekst | Timestamp | (badge) |
|---|---|---|---|
| NL | Northern Lights Casting viewed 12 new profiles from the Oslo Pool. | 10 minutes ago | 🟢 |
| SC | Stella Casting requested access to Self-Tapes library. | 2 hours ago | 🟡 Pending |
| NS | Nordic Skuespillersenter shared Workshop: Scene Study Masterclass. | Yesterday, 11:32 | 🟢 |
| BF | Bergen Film Academy downloaded 5 self-tapes from your shared pool. | May 19, 14:08 | 🟢 |
| 📦 | You updated access permissions for Stella Casting. | May 18, 09:41 | 🟢 |

## Verifikasjons-sjekkliste (kryss av før commit)
- [x] Sidebar 252px, alle 8 items i riktig rekkefølge (Dashboard, Talent Registry, Profiles, Self-Tapes, Auditions, Partners & Collaboration, Permissions, Settings)
- [x] Active state på Partners & Collaboration (lilla bg + 3px venstre-bar)
- [x] Logo (eksisterende /TheRoleRoom_Logo_Tagline.png) + "TALENTS" lockup under
- [x] Topbar med search + bell + Ingrid Nilsen / Talent
- [x] 4 stat-cards med tall 18 / 6 / 3 / 100% + ikoner (Group/People/Hourglass/Shield)
- [x] Tabs: All Partners (active) / Casting Partners / Professional Centers / Invitations
- [x] Partner-tabell: 5 rader (NL, SC, NS, BF, DR) med eksakte navn/by/role/access/aktivitet
- [x] Radio på Northern Lights fylt (hele raden subtle highlighted)
- [x] Permissions Matrix: 5×4 grid med mønster NL:✓✓✓✓, SC:✓✓—✓, NS:✓✓——, BF:✓—✓—, DR:✓———
- [x] Right-sidebar med Northern Lights detail: kontakt + Visibility & Access (6 rader) + 3 knapper
- [x] Collaboration Feed: 5 aktiviteter med riktig tekst og timestamp
- [x] "Pending" gul badge på Stella Casting feed-item
- [x] Pagination "Showing 1–5 of 18 partners" + < 1 2 3 4 >
- [x] "Manage global permission presets >" linkbutton
- [x] "Edit"-link på Visibility & Access-header

## Gjenstår (Phase 2 iterasjon 2 — etter Daniel's første visuelle review)
- [ ] Tab-bytting filtrerer faktisk partner-listen
- [ ] Live data fra /api/role-room/agencies + consents + access-audit
- [ ] Permissions Matrix-toggling skriver til consent-registry
- [ ] "+ Invite Partner" → invite-flow med token
- [ ] Klikkbare 3-dots-menyer per partner-row
- [ ] Pixel-iterasjon basert på Daniel's review
