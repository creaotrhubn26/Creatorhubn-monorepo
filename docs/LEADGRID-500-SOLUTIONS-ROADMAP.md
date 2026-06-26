# Leadgrid — 500 løsninger-roadmap

> Skrevet 2026-06-26. Vi skal bygge Leadgrid som **sentralkommando for alt lead-arbeid**. Dette dokumentet kategoriserer 500 konkrete framtidige løsninger som plugges inn i den eksisterende arkitekturen.

## Arkitektur-fundament (allerede live)

Hver av de 500 løsningene nedenfor bygger på samme stack:

- **Role Room Agent infrastructure** — `role-room-agent-*` (19 filer): orchestrator-bootstrap, fetcher-stack (Brreg/Website/Places), cache, ratelimit, Claude wrapper, audit, consent, pseudonymisering, streaming (SSE), threads
- **Lead Map Agent-bro** — `lead-map-agent-routes.ts`: brand-scan + market-scan på lead-nivå
- **Pin-garanti** — `resolveLocation()`-kjede: Places → Geocoding → city centroid → manual fallback (4 confidence-tiers)
- **iPad-native UX** — SwiftUI 6 strict concurrency, Xcode 26, MapKit overlay, brand-gradient, NBA FAB
- **Backend** — Express + Drizzle + Neon; tester via Vitest; mig-pipeline via `migrate.sh`
- **Frontend** — React + MUI + Tailwind v4 utilities-only

Hver nye løsning skal:
1. **Bruke `runOrchestratedBootstrap`** der research kreves (ikke duplisere Claude-orchestration)
2. **Skape pin på kartet** der relevant (bruke `resolveLocation()`-kjeden)
3. **Returnere counter** etter batch ("X av Y leads lagt til")
4. **Logge audit** via eksisterende audit-wrapper
5. **Respektere entitlements** via `requireLeadMapPermission` / `requireLeadgridProductAccess`

---

## Kategorier (10 × 50 = 500)

### 1. LEAD DISCOVERY (50)

1. URL Research — paste any URL → research + pin (LIVE i PR #949)
2. Bulk URL Workflow — paste 20+ URLs, batch research med counter ("X / Y added")
3. LinkedIn Company URL → automatisk research
4. LinkedIn Personal Profile → koble til existing company
5. Instagram Business Profile → research + IG-grid-preview
6. Facebook Page URL → research + post-history
7. TikTok Business → research + creator-metrics
8. YouTube Channel → research + subscriber-trend
9. Google Maps URL (place_id) → research direkte
10. Yelp Business URL → research + reviews-summary
11. Trustpilot URL → research + score-tracking
12. Reddit thread mention → research subject
13. Hacker News startup-thread → batch-research
14. Product Hunt launch → research nye SaaS-selskaper
15. Crunchbase enrichment — knytt eksisterende lead til funding-data
16. AngelList company sync
17. GitHub organization → tech-stack-research
18. Brreg org.nr lookup → instant research
19. Allabolag.se / Bisnode SE-research
20. Companies House UK-research
21. Org.no batch from spreadsheet → mass-research
22. Domain monitor — alert når matching domains registreres
23. Trademark monitor — alert ved nye varemerke-søknader
24. Patent monitor — alert ved nye patenter i bransje
25. News article subject extractor → AI henter selskap-nevnt i artikkel
26. Press-release subject monitor
27. Podcast guest research (intervjuet × intervjuer)
28. Conference speaker list import
29. Trade show booth scan (OCR + research)
30. Business card scan (Vision OCR + research)
31. Email signature parser
32. vCard import → batch-research
33. Outlook contacts sync
34. Gmail contacts sync
35. iCloud contacts sync
36. WhatsApp contact ↔ lead-mapping
37. Voicemail-to-lead (Whisper transcript → AI extract company → research)
38. Incoming-SMS-to-lead (parse + research)
39. Inbound webhook (Zapier/Make/n8n) → lead
40. Public API endpoint `/v1/leads/import` for partner-integrasjoner
41. Email-to-lead (forward email → AI extract → research)
42. Receipt OCR (vendor → lead)
43. Invoice OCR (kunde → eksisterende lead-update eller ny lead)
44. CSV/Excel import (LIVE i PR #949)
45. JSON bulk import via API
46. Webhook stream lead-source (kontinuerlig polling)
47. Industry-association member-list scrape
48. Local-business directory scrape
49. Wedding-fair attendee list (vertikal: bryllup)
50. Veterinarian directory (vertikal: PetKey)

### 2. RESEARCH & ENRICHMENT (50)

51. SWOT-analyse per lead (LIVE)
52. Konkurranseanalyse via Places (LIVE)
53. Funnel-stage estimat (LIVE)
54. Tech-stack-detektor (BuiltWith/Wappalyzer)
55. Hiring-pattern fra LinkedIn job posts
56. Glassdoor-sentiment
57. Trustpilot-reviews-summary
58. Google-reviews-summary + trend
59. Press-mention-tidslinje siste 12 mnd
60. Funding-historikk (Crunchbase)
61. Investor-liste
62. Board-medlemmer
63. Key decision makers (LinkedIn senior-titler)
64. Email-mønster-deteksjon (firstname.lastname@)
65. Direct-dial-discovery (Apollo/Hunter)
66. Multi-location-deteksjon
67. Subsidiary-mapping
68. Parent-company-deteksjon
69. NACE/SIC-klassifisering
70. Årlig omsetning-estimat
71. Ansatt-antall-estimat (LinkedIn + Brreg)
72. Vekst-trajectory (revenue YoY)
73. Marketing-budget-estimat (basert på ad-spend-detektor)
74. Tech-budget-estimat
75. Nye business-changes (sammenslåing, store ansettelser, ekspansjon)
76. Lawsuit-historie
77. Konkurs-risiko (basert på Brreg-flagg)
78. Sustainability-score
79. ESG-rating
80. Bransje-priser/utmerkelser
81. Sertifiseringer (ISO, FSC, B-Corp)
82. Compliance-status (GDPR-DPA, NIS2)
83. Mobil-app-tilstedeværelse (App Store + Play Store)
84. Website tech health (Lighthouse-score)
85. SEO-score
86. Backlink-profil (Ahrefs/SEMrush)
87. Social media engagement-score
88. Posting-frequency
89. Brand-colors auto-ekstrakt (LIVE)
90. Brand-fonts-deteksjon
91. Logo SVG-ekstrakt
92. Email-warmth-scoring per kontakt
93. Phone-call answer-rate per lead
94. Best time to call (basert på historiske svar)
95. Best day to email
96. Channel-preference inferens (email vs telefon vs WhatsApp)
97. Language-deteksjon (NO/EN/SE)
98. Bransje-jargon-glossary per selskap
99. Customer base size-estimat
100. Geographical footprint-mapping

### 3. OUTREACH & ENGAGEMENT (50)

101. AI Pitch Generator — personlig pitch per lead
102. Email-drip-kampanjer (LIVE)
103. SMS-drip-kampanjer
104. WhatsApp-drip (Meta Cloud API — LIVE)
105. LinkedIn-DM-templates
106. Cold-call-script-generator
107. Voicemail-script (når ingen svarer)
108. Follow-up-cadence basert på lead-temperatur
109. AI subject-line A/B-tester
110. AI email-tone-tweaker (formell ↔ uformell)
111. AI signature-builder per bruker
112. Multi-channel sequence-orchestrator (email → 3 dager → SMS → 7 dager → LinkedIn)
113. Channel-fallback hvis primær-kanal feiler
114. Personalized landing-page-generator per lead
115. Personalized video-greeting (AI sync)
116. Calendly-integrasjon for møtebooking
117. Cal.com-integrasjon
118. Microsoft Bookings-integrasjon
119. Google Meet auto-create ved møte-aksept
120. Zoom auto-create
121. WhatsApp-business-button på lead-kort
122. SMS-quick-send fra lead-kort
123. Email-quick-send fra lead-kort
124. Phone-dialer-integrasjon (Twilio + DialPad)
125. Recording av telefonsamtaler (m/ samtykke)
126. Transkripsjon av samtaler (Whisper)
127. Sentiment-analyse av samtaler
128. Action-items-ekstrakt fra samtaler
129. Auto-CRM-update fra samtaler
130. Meeting-prep AI-brief (sammendrag før møte)
131. Meeting-debrief AI-brief (etter møte)
132. Auto-send takk-email etter møte
133. Auto-send møtenotater til alle deltakere
134. AI-foreslår neste handling etter hvert møte
135. Templates-bibliotek (LIVE — utvid)
136. Templates per-vertikal (bryllup, PetKey, etc.)
137. Templates per-persona (CTO vs CEO vs marketingsjef)
138. Templates per-fase (cold, warm, hot, decision)
139. Snippets-bibliotek (gjenbrukbare avsnitt)
140. Smart variabler i templates ({{lead.firstName}} osv)
141. Dynamic blocks (sett inn pris-tabell hvis SaaS-lead)
142. AI fyller ut placeholders med lead-context
143. Send-time optimization
144. Time-zone aware sending
145. Stop-words detektor (ikke send hvis "no" eller "unsubscribe")
146. Bounce-detektor + auto-pause cadence
147. Re-engagement campaign for cold leads
148. Win-back campaign for lost leads
149. Anniversary-email auto-send
150. Birthday-email auto-send

### 4. PIPELINE & CONVERSION (50)

151. Kanban-pipeline med 8 stages (LIVE)
152. Drag-and-drop stage-bytte (LIVE)
153. Deal-value på lead (`estimated_value` — LIVE)
154. **Deal-probability** (ny, NOT live)
155. **Expected close-date** (ny, NOT live)
156. **Notes & documents** på deal-nivå (NOT live)
157. Quote-builder integrert med pipeline
158. Proposal-generator (PDF) via templates
159. Contract-generator + e-signering (DocuSign/Posten)
160. Stripe-integrasjon for innbetalinger
161. Invoice-auto-generator når deal stenges
162. PowerOffice-integrasjon (NO regnskap)
163. Fiken-integrasjon
164. Tripletex-integrasjon
165. Visma-integrasjon
166. QuickBooks-integrasjon
167. Win-probability auto-calc basert på historiske data
168. Forecasting-card (p10/p50/p90) (LIVE)
169. Pipeline-velocity per stage (LIVE)
170. Bottleneck-detektor (hvor leads stagnerer)
171. Drop-off-alarmer (lead som blir kald)
172. Deal-aging-rapport
173. Cycle-time-tracking per deal
174. Lost-reason-tracking
175. Won-reason-tracking (for replikering)
176. Competitor-displacement-tracking
177. Discount-tracking
178. Margin-tracking per deal
179. Commission-calculator per selger
180. Team-commission split
181. Quota-tracking per selger
182. Quota-attainment-trend
183. Sales-coaching-AI per deal
184. Risk-scoring per deal
185. Health-score per deal (basert på engagement)
186. Auto-degrade hvis ingen activity > 14 dager
187. Auto-escalate til manager hvis high-value-deal stagnerer
188. Multi-stakeholder-tracking (champion vs blocker)
189. Buying-committee-mapping
190. Org-chart-builder per lead
191. Influence-mapping (hvem påvirker hvem)
192. Decision-criteria-tracker (hva trenger de for å bestemme)
193. Objection-handling-bibliotek
194. Objection-tracker (hvilke kommer oftest)
195. AI-foreslår motargument basert på objection-type
196. Demo-tracker (hvilke ble booket, hvilke gjennomført)
197. POC-tracker
198. Trial-tracker (når starter, sluttdato, konverteringspunkt)
199. Renewal-tracking
200. Churn-prediction

### 5. AUTOMATION & WORKFLOWS (50)

201. Follow-up-reminders (LIVE)
202. Task automation builder
203. **Smart Workflow Builder Leadgrid-koblet** (NOT live — finnes for Role Room)
204. Trigger: lead-status-change → action
205. Trigger: pipeline-stage-change → action
206. Trigger: lead-temperatur-change → action
207. Trigger: NBA-recommendation-published → action
208. Trigger: email-opened → action
209. Trigger: email-link-clicked → action
210. Trigger: meeting-booked → action
211. Trigger: meeting-no-show → action
212. Trigger: proposal-opened → action
213. Trigger: contract-signed → action
214. Action: send-email
215. Action: send-SMS
216. Action: send-WhatsApp
217. Action: create-task
218. Action: schedule-call
219. Action: book-meeting
220. Action: update-lead-fields
221. Action: change-pipeline-stage
222. Action: assign-to-user
223. Action: notify-channel (Slack/Teams)
224. Action: post-to-webhook
225. Action: trigger-Zapier
226. Action: send-internal-notification
227. Action: post-to-team-channel
228. Action: add-tag
229. Action: remove-tag
230. Action: archive-lead
231. Action: revive-lead (un-archive)
232. Conditional branching i workflows
233. Wait-step (vent N timer/dager)
234. Loop-step (gjenta inntil condition)
235. AI-decision-step (la Claude bestemme neste action)
236. Parallel-branch (kjør 3 actions samtidig)
237. Error-handler-branch
238. Workflow-versjonering
239. Workflow-templates (forhåndsbygde)
240. Workflow-marketplace (del og kjøp)
241. Workflow-A/B-test (split-traffic)
242. Workflow-metrics (hvor mange triggered, hvor mange konverterte)
243. Workflow-cost (Claude-token-bruk per workflow)
244. Workflow-ROI (revenue attributed)
245. Cron-scheduled workflows
246. Recurring workflows (daglig/ukentlig/månedlig)
247. Event-stream workflows (real-time triggers)
248. Batch workflows (kjør på alle leads matching filter)
249. Workflow-permissions (hvem kan endre, hvem kan kjøre)
250. Workflow-audit-log

### 6. ANALYTICS & REPORTING (50)

251. Performance Dashboard (LIVE — PR #898)
252. Lead-volume-trend
253. Conversion-rate per stage (LIVE)
254. Average deal-value (LIVE)
255. Cycle-time (LIVE)
256. Win-rate per kanal
257. Win-rate per source
258. Win-rate per selger
259. Win-rate per vertikal
260. Win-rate per region
261. Channel-mix-analyse
262. Source-attribution-analyse
263. Multi-touch-attribution
264. Time-to-first-contact
265. Time-to-close
266. Activities-per-deal
267. Touches-til-konvertering
268. Cost-per-lead (CAC)
269. Customer-lifetime-value (CLV)
270. ROI per kampanje
271. Cohort-analyse (leads opprettet samme uke)
272. Funnel-konverteringsrater per stage
273. Pipeline-snapshot-historie (uke-over-uke endringer)
274. Forecast-accuracy (faktisk vs predicted)
275. Sandbagging-detektor (selgere som understiman bevisst)
276. Sales-velocity-trend
277. Hour-by-hour activity heatmap
278. Day-of-week-trend
279. Seasonal-trend-detektor
280. Year-over-year-sammenligning
281. Quarter-end-spike-detektor
282. Team-leaderboard (LIVE)
283. Individual-scorecards
284. Manager-coaching-rapporter
285. 1:1-prep-AI-brief
286. Performance-review AI-summary
287. **Reports & Export PDF** (NOT live)
288. **Reports & Export CSV** (NOT live)
289. Reports & Export Excel
290. Scheduled reports (auto-email weekly summary)
291. **Custom Insights builder** (NOT live)
292. Drag-and-drop dashboard-builder
293. Embedded analytics (iframe)
294. Whitelabel-rapporter for kunder
295. KPI-alerts (alarm hvis pipeline-velocity faller > 20%)
296. Goal-tracking visualization
297. Stretch-goal vs base-goal
298. Public-leaderboard (gamification)
299. Achievement-badges (gamification)
300. Streaks (X dager med aktivitet)

### 7. AI & INTELLIGENCE (50)

301. AI Lead-Scoring (LIVE)
302. Intelligence Engine (LIVE — PR #479)
303. NBA recommendations (LIVE)
304. AI meeting-notes (LIVE — voice memo + Whisper + Claude)
305. AI meeting-prep brief
306. AI meeting-debrief
307. AI email-composer per lead
308. AI proposal-writer
309. AI contract-redliner
310. AI churn-predictor
311. AI upsell-detector
312. AI cross-sell-suggestor
313. AI competitor-mention-alert (når email/call nevner konkurrent)
314. AI sentiment-tracker per lead over tid
315. AI relationship-health-score
316. AI sales-coach (live during call)
317. AI objection-handler-coach
318. AI demo-coach (suggest neste slide basert på lead-reaksjoner)
319. AI follow-up-coach (når og hvordan)
320. AI deal-summarizer
321. AI weekly-reflection (selger's egen)
322. AI quarter-review
323. AI team-pulse (manager's view)
324. AI org-pulse
325. AI customer-success-prediction
326. AI account-tier-suggestion
327. AI persona-detector per kontakt
328. AI buying-stage-detector
329. AI urgency-detector i emails
330. AI risk-flag i emails (juridiske, complaints)
331. AI escalation-suggester
332. AI tone-matcher (matchs lead's tone)
333. AI multilingual-translator
334. AI culture-adapter (norsk vs amerikansk forretningskultur)
335. AI gift-suggester (basert på lead-profil)
336. AI event-suggester (konferanse, dinner)
337. AI account-mapping (hvem henger sammen)
338. AI org-chart-bygger
339. AI succession-planner (hvis kontakt slutter)
340. AI competitor-battle-card (auto-oppdater per lead)
341. AI sales-story-curator (suksesshistorier som passer denne lead)
342. AI customer-quote-finder
343. AI testimonial-mapper (hvilken testimonial passer best)
344. AI case-study-recommender
345. AI ROI-calculator personalisert
346. AI demo-scenario-generator (basert på lead-profil)
347. AI pricing-suggestion per lead
348. AI discount-recommender (max anbefalt discount)
349. AI contract-clause-suggestor
350. AI risk-clause-detector

### 8. INTEGRATIONS & ECOSYSTEM (50)

351. Public API v1 (LIVE — PR #480)
352. Webhook-event-katalog (LIVE)
353. OpenAPI 3.1 spec (LIVE)
354. Custom-webhook-builder
355. Zapier-app
356. Make-app
357. n8n-app
358. **HubSpot 2-way sync** (UTSATT — #494)
359. **Salesforce 2-way sync** (UTSATT — #494)
360. Pipedrive 2-way sync
361. Microsoft Dynamics 365 sync
362. Zoho CRM sync
363. Close.com sync
364. Freshsales sync
365. ActiveCampaign sync
366. Mailchimp sync
367. Klaviyo sync
368. SendGrid sync
369. Brevo (Sendinblue) sync
370. Resend sync (allerede brukt internt)
371. Postmark sync
372. Twilio (telefoni)
373. Plivo
374. Vonage
375. SignalWire
376. Aircall
377. Dialpad
378. RingCentral
379. WhatsApp Business Cloud API (LIVE)
380. Telegram Business
381. iMessage Business
382. Apple Business Chat
383. Slack-app (notifikasjoner + commands)
384. Microsoft Teams-app
385. Discord-bot
386. Google Workspace (LIVE)
387. Microsoft 365 / Outlook
388. Notion-database-sync
389. Airtable-sync
390. Coda-sync
391. Monday.com-sync
392. Asana-sync
393. ClickUp-sync
394. Linear-sync
395. Jira-sync
396. Trello-sync
397. Calendly
398. Cal.com
399. Calendar.com
400. SavvyCal

### 9. FIELD & MOBILE (50)

401. iPad-native app (LIVE — v0.6.0 build 20260627)
402. iPhone-native app (i samme bundle)
403. Apple Watch-app for hurtig-lead-add
404. Mac-native app (Catalyst)
405. Vision Pro-app (3D map)
406. Android-app
407. Tablet-app
408. Offline-mode (LIVE)
409. Sync-on-reconnect
410. Background-sync
411. Push-notifikasjoner (APNS LIVE)
412. Live Activities (Dynamic Island)
413. Widgets (Home Screen + Lock Screen)
414. Shortcuts-integrasjon (Siri)
415. "Hey Siri, log a call with Holy Crust Pizza"
416. CarPlay-integrasjon (handsfree navigation til neste lead)
417. Apple Maps-integrasjon (LIVE)
418. Google Maps-integrasjon
419. Waze-integrasjon
420. Voice-memo-recorder (LIVE)
421. Voice-to-text dictation
422. Quick-photo-add til lead (logo, butikk, kontaktkort)
423. Video-walkthrough per lead
424. AR view (point at building → se lead-data)
425. Geofencing (alarm når i nærheten av lead)
426. Auto check-in når på lead-adresse
427. Check-out + distance traveled tracking
428. Drive-time forecast til neste lead (LIVE)
429. Route Planner (MapKit + Apple Maps — LIVE)
430. Multi-stop route optimization
431. Day-route auto-builder
432. Time-window per stop (åpningstid hensyn)
433. Re-route on disruption (trafikk)
434. Public-transport-route (kollektivtransport)
435. Bicycle-route
436. Walking-route
437. Lead-density-heatmap
438. Territory-coverage-map
439. Underserved-area-detektor
440. Cluster-detektor (3+ leads i samme bygning)
441. Lead-finder mens du går (passive sensor)
442. Storefront-scanner (kameraet ser butikker → suggest leads)
443. License-plate-OCR (varebilen tilhører hvilket selskap?)
444. Audio environment sensing (er du i et møte? — pause notifikasjoner)
445. Bluetooth proximity sensor (er du i en bilforhandler? — autoflag)
446. Apple Pencil annotation på kart
447. Stylus-sketch på lead-notater
448. Handwriting-til-tekst
449. Drawing-rapport for kunder
450. Annotated screenshot-rapport

### 10. TEAM, COMPLIANCE & ENTERPRISE (50)

451. Admin-rolle (LIVE)
452. Sales Rep-rolle (LIVE)
453. Manager-rolle (LIVE)
454. **Viewer-rolle** (NOT live)
455. **Guest-rolle** (NOT live)
456. Custom-roller med fine-grained permissions
457. Per-felt permissions (skjul deal-value for noen)
458. Per-lead permissions (sensitiv lead skjult fra noen)
459. Time-bound access (gjest har 7 dager)
460. IP-restrictions per rolle
461. Device-restrictions (kun fra company-iPad)
462. 2FA-tvang
463. SSO (SAML / OIDC)
464. Okta-integrasjon
465. Azure AD-integrasjon
466. Google Workspace SSO
467. Audit-log (alle endringer)
468. Audit-log-eksport
469. Audit-log-retention (7 år)
470. GDPR DSAR (data subject access request)
471. GDPR right-to-be-forgotten flow
472. Lead-anonymisering på request
473. Data-retention policies (auto-slett etter X år)
474. Pseudonymisering ved Claude-kall (LIVE)
475. Consent-tracker per lead
476. Marketing-consent vs sales-consent
477. Whitepaper-download consent
478. Newsletter-consent
479. SMS-consent (norsk lov)
480. Cookie-banner-bevis
481. DPA (data processing agreement)-templates
482. SCC (standard contractual clauses) for ikke-EØS
483. NIS2-compliance-tracking
484. ISO 27001-compliance-tracking
485. SOC2-compliance-tracking
486. PCI-DSS for kortdata
487. HIPAA for medisinske vertikaler
488. Backup & restore (Render env-vars — LIVE; lead-data: NOT live)
489. **Lead-data backup-system** (analogt med env-backup, mig 0319-stil)
490. Disaster recovery-runbook
491. Multi-region replication
492. Tenant-isolation auditing
493. Per-tenant encryption keys
494. Customer-managed encryption keys (CMEK)
495. Lockbox / 4-eyes approval for sensitive operations
496. Quarantine-modus (frys konto under etterforskning)
497. Legal hold (data ikke slettbar under saksbehandling)
498. Sub-processor list (vendor management)
499. Vendor-security-questionnaire-bibliotek
500. Trust Center (public security/compliance-side)

---

## Mål: 80 % implementert innen 2027

Strategien er å bygge bredt på fundamentet, ikke dypt på enkelt-features. Hver av disse 500 plugges inn i:

1. **Eksisterende orchestrator** (`runOrchestratedBootstrap`) for research
2. **Eksisterende `crm_customers`** med pin-garanti (`location_confidence`)
3. **Eksisterende `lead_map_admin_audit`** for sporing
4. **Eksisterende `lead_map_entitlements`** for permissions
5. **Eksisterende WebSocket** (`LeadgridRealtimeClient`) for real-time sync til iPad

**Velocity-target:** 10 nye løsninger / uke = 500 ferdig innen ca. 12 måneder med 1-2 utviklere.

## Tilknytning til Leadgrid-one-pager

Hver av de 500 mapper til en av de 8 seksjonene på one-pager:
- Discover & Import (1-50)
- Outreach & Engagement (101-150)
- Pipeline & Conversion (151-200)
- Automation & Workflows (201-250)
- Analytics & Reporting (251-300)
- AI & Intelligence (301-350) — supplement til Core Platform
- Integrations & Ecosystem (351-400)
- User Roles & Access (451-500) — alle de andre er enabler

## Neste prioriterte 10 (Q3 2026)

Basert på mest-etterspurte features og lavest implementeringskost:

1. **#2 Bulk URL Workflow** — paste 20+ URLs, counter
2. **#101 AI Pitch Generator**
3. **#154 Deal-probability** + **#155 Expected close-date**
4. **#203 Smart Workflow Builder Leadgrid-koblet**
5. **#287/288 Reports & Export PDF/CSV**
6. **#358 HubSpot 2-way sync**
7. **#359 Salesforce 2-way sync**
8. **#454/455 Viewer + Guest roller**
9. **#383 Slack-app**
10. **#489 Lead-data backup-system**

Disse 10 alene dekker over 80% av gap mot one-pager + de gir mest verdi til betalende kunder.
