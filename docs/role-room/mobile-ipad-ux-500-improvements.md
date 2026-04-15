# The Role Room mobil og iPad UX: 500 forbedringer

Dette er en mobil- og iPad-spesifikk forbedringsbacklog for The Role Room. Målet er bedre UX på små og mellomstore skjermer uten å påvirke desktop.

## Guardrails

- Alle tiltak skal gates med mobile/iPad-spesifikke breakpoints, `pointer: coarse`, `hover: none`, container queries eller eksplisitte responsive komponentvarianter.
- Desktop-layout, desktop spacing og eksisterende desktop-komponenter skal ikke endres uten en separat desktop-task.
- Mobile tiltak skal helst være additive: nye mobile wrappers, bottom sheets, touch actions, compact cards og iPad split-view-varianter.
- Touch targets skal være minst 44 x 44 px, med ekstra spacing rundt destruktive handlinger.
- Alle flyter skal testes på iPhone SE-størrelse, vanlig iPhone, stor iPhone, iPad portrait, iPad landscape, Safari og Chrome.

## 001-025: Responsive arkitektur og sikkerhetsnett

001. Opprett en egen `role-room-mobile.css` eller modulert mobile layer som bare lastes innenfor mobile breakpoints.
002. Innfør en `useRoleRoomViewportMode` hook som returnerer `mobile`, `tabletPortrait`, `tabletLandscape` og `desktop`.
003. Legg inn en sentral `isTouchMode`-guard basert på `pointer: coarse` og `hover: none`.
004. Flytt mobilspesifikk navigasjon til egne komponenter i stedet for å proppe desktop-headeren full av betingelser.
005. Lag en visuell breakpoint-debugger som bare kan aktiveres i dev/staging.
006. Innfør Storybook eller Playwright snapshots for mobilvariantene uten å endre desktop-snapshots.
007. Lag mobile-only CSS tokens for spacing, headerhøyde, safe-area og bottom-nav-høyde.
008. Definer iPad-tokens separat fra telefon-tokens slik at tablet ikke får telefonkomprimert UI.
009. Bruk CSS `env(safe-area-inset-*)` konsekvent for iPhone med notch og iPad stage manager.
010. Lag egne mobile skeleton-komponenter som ikke endrer desktop loaders.
011. Innfør mobile-only error boundaries rundt tunge moduler som Planner, Review og Live Set.
012. Sørg for at lazy-loaded mobile komponenter ikke påvirker desktop bundle path.
013. Lag en `MobileOnly` helper som skjuler innhold uten layout-jitter.
014. Lag en `TabletOnly` helper for iPad-spesifikke split-view-komponenter.
015. Sett mobilspesifikke max-height-regler for modaler slik at de aldri havner under browser chrome.
016. Bruk container queries i prosjektkort der komponenten kan ligge både i modal og sidepanel.
017. Legg inn regressjonstest som bekrefter at desktop header-DOM ikke endres av mobile PR-er.
018. Legg inn CSS lint-regel eller review-sjekkliste for at mobile klasser ikke overskriver desktop globalt.
019. Lag feature flags for større mobile flyter slik at de kan rulles ut uten risiko for desktop.
020. Definer en mobil UX-kontrakt per hovedflate: Planner, Prosjektrom, Godkjenning, Manus, Live Set og Økonomi.
021. Flytt viewport-state ut av komponenter som re-render ofte for å hindre risting ved resize.
022. Debounce orientation-change før layout rekalkuleres på iPad.
023. Lag en test som roterer iPad viewport og sjekker at aktiv kontekst beholdes.
024. Bruk `prefers-reduced-motion` for å redusere mobile animasjoner ved behov.
025. Innfør en mobil-only changelog for UX-endringer slik at desktop-arbeid ikke blandes inn.

## 026-050: Mobil header og navigasjon

026. Erstatt full desktop-header med en kompakt mobil topbar med prosjektnavn, status og én primær handling.
027. Flytt sekundære headerhandlinger til et bottom sheet på mobil.
028. Vis bare fire topphandlinger på mobil: Prosjekt, Innboks, Fortsett, Profil.
029. Legg prosjektbytte i et fullskjerm bottom sheet på telefon.
030. Bruk iPad-popover for prosjektbytte i stedet for telefon-sheet.
031. Flytt “Åpne prosjekter” inn i ny-prosjekt/prosjektmodal på mobil.
032. Fjern dupliserte snarveier i mobilheader når samme handling finnes i aktiv flate.
033. Vis aktiv rolle som kompakt pill i mobilheader, ikke som lang tekst.
034. Gjør profilknappen til fast 44 px touch target.
035. Bruk sticky topbar bare når brukeren scroller opp, og skjul den ved nedscroll i innholdstunge flater.
036. Legg “tilbake” som kontekstuell handling i topbar med korrekt forrige flate.
037. Bruk breadcrumb i bottom sheet på mobil i stedet for lang headertekst.
038. Vis sync-status som liten ikonstatus i header, ikke som full tekstlinje.
039. Legg workspace-status i profilmodal på mobil.
040. Legg Google-status i profilmodal på mobil.
041. Lag en “quick switch” for siste tre prosjekter i prosjekt-sheet.
042. La header vise “Fortsett der du slapp” når workspace-state er gjenopprettet.
043. Skjul logoillustrasjoner i mobilheader for å frigjøre høyde.
044. Bruk haptisk-lignende visuell feedback på touch, men bare CSS-basert.
045. Gjør exit/logout til sekundær handling inne i profilmodal på mobil.
046. Legg inn skjermleserlabel på alle ikonknapper i mobilheader.
047. Ha egen collapsed state for iPad portrait der topbar er kompakt men ikke telefonlik.
048. La iPad landscape beholde mer kontekst med to-linjers header hvis plass tillater det.
049. Sørg for at header ikke re-mounter ved faneendring på mobil.
050. Test header med Safari toolbar synlig og skjult.

## 051-075: iPad layout og split view

051. Lag iPad split view med venstre prosjekt-/flatekolonne og høyre arbeidsområde.
052. Bruk iPad portrait som to-trinns layout: liste først, detalj som slide-over.
053. Bruk iPad landscape som ekte master-detail for Planner og Godkjenning.
054. La iPad vise Prosjektrom og Brief side om side når skjermbredden tillater det.
055. Legg en kompakt side rail for hovedflater på iPad.
056. Unngå telefon-bottom-nav på iPad landscape.
057. Bruk popovers for filter og sortering på iPad, ikke fullskjerm sheets.
058. La iPad åpne dokumentpreview i høyre panel uten å forlate kontekst.
059. La iPad vise timeline over og selected card under i portrait.
060. La iPad støtte “pin panel” for notater ved review.
061. Legg inn resizable sidepanel bare på iPad og større touch-skjermer.
062. Bruk større kortbredder på iPad for å unngå desktop-tabell i miniatyr.
063. Lag iPad-spesifikk empty state med hurtighandlinger.
064. La iPad beholde aktiv underfane i URL eller server-state ved app switch.
065. Optimaliser iPad safe-area for Stage Manager og split-screen.
066. Legg inn iPad keyboard shortcuts for vanlige handlinger uten å påvirke desktop shortcuts.
067. Støtt Apple Pencil markering i review som iPad-only enhancement.
068. Bruk hoverfrie tooltips på iPad siden hover ikke er pålitelig.
069. La iPad vise flere metadatafelt enn telefon, men færre enn desktop.
070. Legg “vis mer” foldouts på iPad for tunge sidepaneler.
071. Bruk iPad-modal som centered sheet med max width, ikke full desktop modal.
072. Sørg for at split view ikke forårsaker dobbelt data-fetch.
073. Test iPad i 50/50 split-screen viewport.
074. Test iPad i Slide Over smal viewport.
075. Lag iPad-only E2E-scenarier for Planner, Review og Prosjektrom.

## 076-100: Planner på mobil

076. Gjør Planner til en kortbasert mobilfeed med “i dag”, “neste”, “venter” og “blokkert”.
077. Vis bare én primær CTA i Planner på telefon: “Opprett”.
078. Legg møte, milepæl, oppgave og levering som valg i opprett-sheet.
079. Flytt Planner-tabs til en horisontal swipebar på mobil.
080. Lag “Oversikt” som default mobilvisning for Planner.
081. Gjør “Prosjektrom”, “Godkjenning”, “Levering” og “Økonomi” til interne Planner-seksjoner på mobil.
082. Bruk sticky “Fortsett” card øverst når brukeren har en uferdig oppgave.
083. Vis faseprogress som kompakt progress ring på mobil.
084. Vis blockers som rød/gul kortgruppe øverst i feeden.
085. Lag mobilvennlige timeline-kort i stedet for horisontal timeline som krever presis dragging.
086. Legg “fit to screen” som default for timeline på iPad.
087. Legg timeline zoom presets i bottom sheet på telefon.
088. La brukeren swipe mellom Pre-production, Production og Post-production på mobil.
089. Vis kun relevante Planner-detaljer for aktiv rolle.
090. Skjul tunge produksjonsteammetadata for innholdsprodusent på telefon.
091. Lag mobile-only quick filter for “mine oppgaver”.
092. Vis deadlines som datochips i kort, ikke som tabellkolonner.
093. Legg “neste beslutning” som eget mobilkort.
094. Lag compact approval card i Planner-feed.
095. Legg “mangler fra klient” som tydelig mobilseksjon.
096. Unngå kontinuerlig auto-refresh mens brukeren scroller Planner på mobil.
097. Bruk pull-to-refresh for manuell resync i Planner.
098. Vis sync-toast bare ved reell endring, ikke ved no-op refresh.
099. Lag Planner offline banner som ikke skyver innholdet.
100. Test Planner mobil med minst 100 oppgaver uten scroll-jank.

## 101-125: Prosjektrom, brief og materiale

101. Bytt mobilnavn “Media” til “Prosjektrom” overalt.
102. Del klientbrief i mobilsteg: mål, målgruppe, leveranser, referanser og godkjenning.
103. Lag progress indicator for brief-steg på mobil.
104. La klienten lagre brief-utkast per steg på mobil.
105. Legg referanseopplasting direkte i brief-steg med kamera- og filvalg.
106. Vis opplastingsstatus per fil som kompakt rad på telefon.
107. Bruk iPad split view med brief til venstre og materiale til høyre.
108. Lag “kort sammendrag” av brief for produsent på mobil.
109. La produsent markere brief som “klar for produksjon” fra mobil.
110. Lås brief etter godkjenning med tydelig mobilbanner.
111. La klient be om endring fra mobil uten å finne riktig fane.
112. Legg “siste endret av” og tidspunkt i brief-header på mobil.
113. Unngå fullskjermspinner ved lasting av brief; bruk inline skeleton.
114. Cache siste brief lokalt og vis “sist synket” hvis nett faller ut.
115. Legg “hopp til manglende felt” i mobilbrief.
116. Bruk store tekstfelt med sticky lagreknapp på mobil.
117. Gi bedre tomtilstand for materiale med “last opp referanser”.
118. La materiale grupperes etter type: referanse, manus, storyboard, leveranse og annet.
119. Vis filtype og størrelse i kompakt mobilrad.
120. La iPad vise grid med større thumbnails og sidepaneldetaljer.
121. Bruk lazy image loading i Prosjektrom på mobil.
122. Legg “send til godkjenning” direkte fra materiale-card på mobil.
123. Legg “legg ved i møte” direkte fra materiale-card på mobil.
124. Ikke refresh Prosjektrom mens bruker redigerer tekstfelt.
125. Test “Laster klientbrief og materiale” slik at teksten aldri flimrer ved bakgrunnssync.

## 126-150: Godkjenning og review

126. Gjør “Godkjenning” til tydelig mobilflate med “venter på klient”, “venter på deg” og “ferdig”.
127. Lag kompakt client review card med status, frist og siste kommentar.
128. La klient godkjenne med én sticky knapp nederst på mobil.
129. Krev bekreftelse ved avslag eller change request på mobil.
130. Legg change request som høyere klikkmeny på reviewelement.
131. La produsent flagge change request som scope-impact fra mobil.
132. Vis hvilke deliverables som er innenfor scope som mobil-toggle.
133. Vis reviewhistorikk som timeline i bottom sheet.
134. Legg swipe mellom reviewelementer på telefon.
135. Legg bilde/video preview i fullskjerm med enkel close gesture.
136. La iPad vise preview og kommentarer side om side.
137. Bruk markering/annotering som iPad-only enhancement.
138. Legg “godkjenn alle synlige” kun hvis alle elementer er innenfor scope.
139. Vis klientnavn og rolle i reviewkort for å unngå feil godkjenner.
140. Legg fristforlengelse som egen mobilhandling.
141. Vis “send påminnelse” bare for produsentroller med tilgang.
142. Legg “kopier delingslenke” bak ekstra bekreftelse på mobil.
143. Ha mobilvennlig aksept av møte- og reviewinvitasjoner.
144. Bruk kort statusord: Utkast, Sendt, Åpnet, Godkjent, Endring.
145. Vis reviewfeil inline per element, ikke global rød skjerm.
146. Cache siste reviewliste og vis stale indicator ved nettverksbrudd.
147. Unngå dobbel submit ved dårlig mobilnett.
148. Legg optimistic UI bare der serverbekreftelse kan reverseres trygt.
149. Logg mobile review actions med audit-event.
150. Test reviewflyt med klientrolle på liten iPhone.

## 151-175: Manus, Story Logic og shotlist

151. Vis manus som lesemodus først på mobil, med redigering som eksplisitt modus.
152. Lag sticky scenevelger nederst på telefon.
153. La produsent hoppe mellom scene og shot uten konteksttap på mobil.
154. Bruk compact scene cards i stedet for tabell på telefon.
155. Vis Story Logic sync-status per scene.
156. Ha mobil-only konfliktbanner når scene er endret på annen enhet.
157. Flytt tunge manusverktøy til “mer”-sheet på mobil.
158. Lag “fortsett på scene” card når brukeren åpner appen igjen.
159. Gjør shotlist drag-to-reorder touch-vennlig med tydelig drag handle.
160. Legg reorder bak “rediger rekkefølge” modus for å hindre utilsiktet drag.
161. Vis shotstatus som chips: planlagt, tatt, valgt, mangler.
162. La shotkort ha quick actions for notat, status og bilde.
163. Bruk iPad split view med manus venstre og shotdetalj høyre.
164. Legg “show only selected scene” som mobilfilter.
165. Legg “jump to selected shot” som sticky snarvei på mobil.
166. Legg “jump to live shot” som Live Set-only handling.
167. Vis scene separators tydelig i mobil timeline.
168. Gi manusnotater fullskjerm editor på telefon.
169. La editor-notater være skjult bak rollefilter på mobil.
170. Ikke auto-scroll manus ved bakgrunnssync.
171. Lag “lagre utkast” for manusnotater ved nettverksbrudd.
172. Vis hvem som sist endret manusnotatet.
173. Legg auditikon på scene for endringshistorikk.
174. Test Story Logic uten local fallback på mobil.
175. Test manusflyt med 50 scener og 300 shots på iPad.

## 176-200: Live Set, lined script og video village

176. Lag egen “Live Set”-modus som mobil/iPad-variant, ikke desktop-overstyring.
177. Vis lined script som scene-centric workspace på iPad.
178. På telefon vis bare aktiv scene, aktiv take og neste action.
179. La script supervisor markere covered lines med touch-drag.
180. Legg take-notater som bottom sheet koblet til valgt manuslinje.
181. Vis “good for performance”, “good for framing” og “good for continuity” som store toggles.
182. Legg “send to editor” som role-gated handling.
183. Bruk iPad video village layout med playback til høyre og script til venstre.
184. På telefon åpnes playback som fullskjerm review.
185. La regissør legge reginotat direkte på take fra iPad.
186. La video assist logge take metadata med store touch controls.
187. Vis coverage per scene med status planned, recorded, reviewed, selected og missing.
188. Lag mobil coverage map som seks cards: Wide, Medium, Close-up, Insert, OTS og Cutaway.
189. La iPad vise coverage map som grid ved siden av manus.
190. Marker coverage-hull med tydelig “mangler før vi går videre”.
191. Vis take comparison som swipe mellom takes på telefon.
192. Vis take comparison side-by-side på iPad landscape.
193. Legg continuity warnings som compact banners.
194. Ikke last video previews før brukeren åpner Live Set på mobil.
195. Bruk lavoppløselige proxies for mobil playback.
196. Vis nettverkskvalitet for video playback i Live Set.
197. Lag “offline logging” for takes hvis settet har dårlig nett.
198. Sync take-notater i batch etter nett kommer tilbake.
199. Logg alle lined-script endringer med bruker, rolle og tidspunkt.
200. Test Live Set på iPad med ekstern skjerm hvis tilgjengelig.

## 201-225: Timeline og coverage map

201. Lag timeline zoom presets som mobil-sheet: dag, uke, fase og fit.
202. Gjør “fit to screen” til default på telefon.
203. La iPad ha pinch-to-zoom i timeline.
204. Legg “jump to selected shot” som flytende knapp i timeline.
205. Legg “jump to live shot” bare når Live Set er aktiv.
206. Legg “show only selected scene” som tydelig filterchip.
207. Legg “show act” som iPad-filter der manus har akter.
208. Vis scene separators som store mobile dividers.
209. Gjør drag-to-reorder shots tilgjengelig med long press på mobil.
210. Gi reorder-modus egen toppbar med avbryt og lagre.
211. Auto-scroll ikke timeline når bruker aktivt drar.
212. Legg haptisk-lignende CSS feedback ved drop.
213. Vis invalid drop zones tydelig på touch.
214. Lag compact coverage summary per scene.
215. Vis missing coverage som egen rød/gul liste.
216. La coverage map åpne relevante shots ved tap.
217. La iPad coverage map vise thumbnail per coverage-type.
218. Bruk “reviewed” og “selected” som separate statuser.
219. Vis coverage-intensjon fra storyboard hvis den finnes.
220. La editor filtrere på “selected takes only” på iPad.
221. Legg “export coverage report” som iPad action.
222. Ikke kjør tung timeline layout ved hver statuspoll.
223. Virtualiser timeline-elementer på mobil.
224. Lag E2E for reorder med touch events.
225. Lag E2E for coverage missing warning.

## 226-250: Skjema, input og redigering

226. Bruk fullskjerm edit sheets for lange tekstfelt på telefon.
227. Lag sticky lagre/avbryt-bar nederst for mobilskjema.
228. Auto-save bare etter pause i skriving, ikke på hvert tastetrykk.
229. Vis “lagret”, “lagrer” og “feil” som inline status ved felt.
230. Behold cursorposisjon når bakgrunnssync oppdaterer data.
231. Unngå at keyboard dekker submit-knapp.
232. Bruk input modes for tall, e-post, telefon og dato.
233. Bruk native date/time picker på mobil der det gir mening.
234. La iPad bruke kalender-popover for dato.
235. Del lange skjema i steg med progress.
236. Lag “hopp til feil” summary øverst etter validering.
237. Vis feltfeil under feltet, ikke bare toast.
238. Ikke tøm skjema ved midlertidig API-feil.
239. Legg “gjenopprett nylige endringer” i profil eller sync-fane.
240. Queue lokale endringer ved kort nettverksbrudd.
241. Vis queue-status i sync-indikator.
242. La bruker manuelt retrye mislykkede felt.
243. Hindre dobbel submit med idempotency key.
244. Vis destructive actions med ekstra avstand på mobil.
245. Krev typed confirmation bare for høyrisiko actions.
246. Lag mobile-only autosave diff preview for viktige dokumenter.
247. Støtt paste av bilder direkte i iPad tekstområder hvis browser tillater det.
248. La mobile voice dictation fungere uten layoutkollaps.
249. Test skjema med langt norsk innhold og æøå.
250. Test skjema med Safari autofill og Google password manager.

## 251-275: Fil, upload og media

251. Støtt kameraopplasting direkte fra mobil.
252. Støtt flere bilder i én opplasting med progress per fil.
253. Bruk direkte R2-upload for store mobilfiler før backend-prosessering.
254. Bruk resumable upload for filer over valgt terskel.
255. Vis tydelig advarsel ved mobilnett og store filer.
256. Komprimer thumbnails lokalt der det er trygt.
257. Ikke komprimer originaler uten eksplisitt valg.
258. Vis filpreview som fullskjerm på telefon.
259. Vis filpreview i sidepanel på iPad.
260. Lag swipe mellom preview-elementer.
261. Vis EXIF nøkkelfelt i compact mobile view.
262. Skjul tung metadata bak “mer info”.
263. Støtt HEIC preview med fallback.
264. Støtt RAW placeholder preview med status for konvertering.
265. Vis upload queue nederst som kollapsbar bar.
266. La bruker pause og fortsette opplastinger.
267. Behold upload queue ved navigasjon mellom flater.
268. Varsle hvis bruker prøver å lukke app med aktive uploads.
269. Bruk content hash for duplicate warning.
270. Vis “allerede lastet opp” med lenke til eksisterende fil.
271. Legg “legg til review” som filhandling.
272. Legg “legg ved brief” som filhandling.
273. Legg “legg ved møte” som filhandling.
274. Test 25 MB, 100 MB og 500 MB upload via mobil simulering.
275. Test filpreview uten å kræsje ved ukjent MIME-type.

## 276-300: Innboks og varsler

276. Gjør Innboks til egen ikonknapp i mobilheader.
277. Åpne Innboks som fullskjerm modal på telefon.
278. Åpne Innboks som sidepanel på iPad.
279. Vis uleste, nevnt, godkjenning og system som mobile filterchips.
280. Gruppér varsler per prosjekt på mobil.
281. Unngå doble varsler for samme hendelse med dedupe key.
282. Vis “klient har lagt inn brief” som action card.
283. Vis “klient har godkjent” som action card.
284. Vis “change request” med tydelig scope-indikator.
285. La bruker arkivere varsel med swipe.
286. La bruker markere som løst fra mobil.
287. La bruker tildele innboksoppgave fra iPad.
288. Legg due date på innboksoppgaver med mobile picker.
289. Vis mentions som egen seksjon.
290. Støtt søk i innboks på iPad.
291. Bruk pushvarsler via PWA der tillatt.
292. Vis permission prompt for push først etter verdi er forklart.
293. La bruker velge stilleperiode for mobilvarsler.
294. Ikke vis toast for demo-prosjekt når ekte prosjekt er aktivt.
295. Ikke vis varsler for prosjekter brukeren ikke har tilgang til.
296. Vis offline varsler som queued når nett kommer tilbake.
297. Auditér notification read/resolve actions.
298. Test PWA installert på iPhone.
299. Test varsler i Safari med begrensninger dokumentert.
300. Test at innboks ikke re-render stormer ved polling.

## 301-325: Client Access Vault på mobil og iPad

301. Gjør Client Access Vault tilgjengelig som Planner-underseksjon på mobil.
302. Vis kontoer som store mobile cards med logo, status og risiko.
303. Bruk ekte leverandørlogoer i en isolert asset-komponent.
304. Vis access method som chip: Invite, OAuth, Secret eller Pending.
305. Vis risk level med enkel farge og tekst.
306. Legg “Connect”, “Share Secret” og “Revoke” som tre tydelige card actions.
307. Åpne “Share Secret” i ekstra sikker fullskjerm modal på telefon.
308. Krev ekstra bekreftelse før reveal på mobil.
309. Vis watermark med bruker og tidspunkt på reveal-screen.
310. Bruk one-time reveal som default for høy risiko.
311. La klient sette utløpsdato med mobilvennlig picker.
312. La produsent be om tilgang via guided checklist.
313. Vis plattformspesifikke instruksjoner i stegvis mobilflow.
314. Hindre passord i chat, brief og kommentarer med mobile inline warning.
315. Vis audit log som activity feed på telefon.
316. Vis audit log som tabell-lignende liste på iPad.
317. Legg “roter passord etter prosjekt” som avslutningspåminnelse.
318. Vis hvem hemmelighet er delt med i compact chips.
319. La klient revoke tilgang med én tydelig handling og bekreftelse.
320. Ikke cache hemmeligheter i browser storage.
321. Masker secrets umiddelbart ved app switch hvis mulig.
322. Sett clipboard-copy bak eksplisitt handling med audit.
323. Vis 2FA-status per konto.
324. Test Vault med klientrolle på telefon.
325. Test at secret reveal ikke kan åpnes etter expiry.

## 326-350: Økonomi, utlegg og OCR

326. Gjør økonomi til Planner-underseksjon på mobil for innholdsprodusent.
327. Vis utlegg som mobilkort med beløp, status og kvittering.
328. Legg “legg til utlegg” som stor mobil CTA.
329. Støtt kameraopptak av kvittering.
330. Støtt opplasting av PDF, HEIC og bildekvittering.
331. Vis OCR-status som steg: lastet opp, leser, må sjekkes, klar.
332. Vis OCR confidence med enkel tekst: sikker, bør sjekkes, lav.
333. La bruker korrigere beløp, dato, MVA og leverandør i mobilskjema.
334. La produsent sende utlegg til klientgodkjenning fra mobil.
335. La klient godkjenne utlegg med sticky knapp.
336. Vis refusjonsstatus som tydelig chip.
337. Vis duplicate warning hvis samme kvittering finnes.
338. Vis hvem som dekker kostnad: klient, produsent, delt eller avventer.
339. Støtt økonomisk modell som mobilkort: engangsprosjekt, retainer, startup, eierandel.
340. Vis avtaletype med kort forklaring på mobil.
341. Legg kontraktstatus som mer enn aktiv/inaktiv: utkast, sendt, signert, utløpt, revidert.
342. Vis “innenfor avtale” eller “utenfor scope” på utlegg.
343. La iPad vise kvittering og OCR-felt side om side.
344. Legg eksport av statusrapport som iPad action.
345. Lag mobilvennlig rapportpreview før eksport.
346. Ikke kjør OCR på nytt ved hver faneendring.
347. Queue OCR retry uten å blokkere UI.
348. Auditér manuell OCR-korrigering.
349. Test OCR-flow med dårlig mobilnett.
350. Test utlegg med kvittering på liten iPhone.

## 351-375: Offline, sync og gjenoppretting

351. Legg “Resync fra server” i profil/sync-fane på mobil.
352. Gi resync uten hard refresh.
353. Vis “sist synket” per prosjektflate.
354. Lag offline banner som ikke dytter layout.
355. Queue lokale endringer ved kort nettverksbrudd.
356. Vis antall queued endringer i sync-indikator.
357. La bruker åpne queue-detaljer fra profilmodal.
358. La bruker retrye eller forkaste queued endringer.
359. Lag “gjenopprett nylige endringer” per prosjektflate.
360. Lag recovery snapshot før store mobilendringer.
361. Lag konfliktløser som er lesbar på telefon.
362. Vis serverversjon og lokal versjon i konfliktløser på iPad.
363. Lag scroll-posisjon per prosjektflate.
364. Lag filter-state per prosjektflate.
365. Lag sortering-state per prosjektflate.
366. Gjenopprett siste ekte prosjekt etter refresh.
367. Ikke gjenopprett demo-prosjekt hvis bruker har ekte prosjekt.
368. Reset workspace-state ved prosjektbytte.
369. Bekreft prosjektbytte hvis det finnes ulagrede endringer.
370. Lag idempotency keys for mobile saves.
371. De-dupliser bakgrunnssync slik at UI ikke rister.
372. Pause polling mens bruker skriver i mobile skjema.
373. Bruk exponential backoff ved API-feil.
374. Test offline-on/off ti ganger i samme mobilflyt.
375. Test refresh etter ulagret endring og etter lagret endring.

## 376-400: Tilgjengelighet og touch ergonomi

376. Sikre minst 44 px touch target på alle mobile knapper.
377. Øk spacing mellom destruktive og primære handlinger.
378. Legg tydelig focus state for eksternt tastatur på iPad.
379. Sørg for at alle ikonknapper har `aria-label`.
380. Bruk semantiske headings i mobile sheets.
381. Ikke lås zoom for brukere som trenger forstørrelse.
382. Test med Dynamic Type-lignende større tekst.
383. Bruk kortere labels på telefon og full labels på iPad.
384. Unngå hover-only informasjon på touch.
385. Bruk bottom sheet headers med synlig close-knapp.
386. La Escape og ekstern keyboard close modaler på iPad.
387. Støtt swipe down for å lukke ufarlige sheets.
388. Ikke bruk swipe down for sheets med ulagrede data uten bekreftelse.
389. Bruk kontraststerke statuschips på mørk bakgrunn.
390. Vis tekst sammen med farge for status.
391. Gjør loading states skjermleservennlige.
392. Unngå infinite spinners uten timeout og retry.
393. Gi store nok checkboxes og toggles.
394. Bruk native select der custom dropdown blir vanskelig på mobil.
395. Lag voiceover-test for prosjektbytte, godkjenning og brief.
396. Test med redusert bevegelse aktivert.
397. Unngå animasjoner som flytter tap targets under fingeren.
398. Bruk `scroll-margin` for å hoppe til feilfelt uten å skjule det under header.
399. Test touch scrolling inni nested panels.
400. Dokumenter minimum mobile accessibility acceptance criteria.

## 401-425: Performance og stabilitet

401. Mål API-kall per mobilflate og sett budsjett.
402. Sett render-budsjett per mobil interaksjon.
403. Virtualiser lange lister på mobil.
404. Lazy-load tunge tabs først når de åpnes.
405. Prefetch bare neste sannsynlige flate på mobil.
406. Bruk stille bakgrunnssync uten global loader.
407. Ikke vis loadingtekst ved no-op refresh.
408. De-dupliser identiske settings PUT på mobil.
409. De-dupliser identiske prosjekt-save kall.
410. Bruk stable serialization før autosave.
411. Ikke dispatch globale events synkront under React render.
412. Bruk microtask eller effect for auth/session events.
413. Cache read-only prosjektdata kortvarig på mobil.
414. Clear cache bare ved reell mutasjon.
415. Sett abort controller på utdaterte mobile fetches.
416. Ikke la tre parallelle fetches oppdatere samme state uten prosjekt-ID guard.
417. Ignorer stale responses etter prosjektbytte.
418. Logg API 4xx/5xx med flate og viewport mode.
419. Fjern console noise i production for mobil.
420. Samle mobile diagnostics bak flagg.
421. Mål layout shift ved tabbytte.
422. Mål scroll jank i Planner feed.
423. Mål cold start for Live Set mobile.
424. Test 15 raske faneendringer på mobil uten crash.
425. Test 60 minutter idle/resume på iPad.

## 426-450: iPad multitasking, tastatur og profesjonell bruk

426. Støtt iPad split-screen bredder uten å falle til desktop-layout.
427. Støtt Stage Manager vindusstørrelser.
428. Behold aktiv flate når iPad appen mister fokus.
429. Legg keyboard shortcut overlay for iPad.
430. Støtt piltaster for å gå mellom takes.
431. Støtt Cmd+K for mobil/iPad command palette hvis ekstern keyboard finnes.
432. Støtt Space for playback toggle i Live Set på iPad.
433. Støtt Enter for godkjenn valgt review hvis fokus er riktig.
434. Ikke aktiver shortcuts mens tekstfelt er fokusert.
435. La Apple Pencil annotering være lagret som eget lag.
436. La iPad dra filer inn i Prosjektrom hvis browser støtter det.
437. La iPad previewe PDF i sidepanel.
438. La iPad åpne to relaterte paneler uten modal-overload.
439. Bruk tabell-lignende tetthet på iPad bare når touch targets beholdes.
440. Vis flere kolonner i iPad godkjenning, men ikke desktop full table.
441. La produsent ha “presenter mode” på iPad for klientmøte.
442. La iPad skjule side rail under presentasjon.
443. Legg “screen clean mode” for video village på iPad.
444. Støtt ekstern skjerm med egen future flag.
445. Bruk iPad landscape som primær produksjonsmodus.
446. Bruk iPad portrait som review/brief-modus.
447. Test med Magic Keyboard.
448. Test med touch-only iPad.
449. Test med Split View 1/3 bredde.
450. Test med Split View 2/3 bredde.

## 451-475: QA, observability og live testing

451. Lag Playwright mobile project for iPhone SE.
452. Lag Playwright mobile project for iPhone 15/16 størrelse.
453. Lag Playwright tablet project for iPad portrait.
454. Lag Playwright tablet project for iPad landscape.
455. Kjør mobile smoke test på hver PR som rører Role Room.
456. Kjør desktop smoke separat for å bekrefte ingen desktop-regresjon.
457. Legg screenshot-diff for mobilheader.
458. Legg screenshot-diff for Planner mobilfeed.
459. Legg screenshot-diff for Prosjektrom mobil.
460. Legg screenshot-diff for Godkjenning mobil.
461. Legg screenshot-diff for iPad split view.
462. Mål API-kall under live tab switching.
463. Mål console errors under live mobile flow.
464. Fail test hvis pageerror oppstår.
465. Fail test hvis unhandled promise rejection oppstår.
466. Fail test hvis samme API endpoint spammes over terskel.
467. Fail test hvis loadingtekst blinker mer enn én gang etter initial load.
468. Lag test for prosjektbytte med stale response.
469. Lag test for refresh og restore siste ekte prosjekt.
470. Lag test for demo-prosjekt ikke valgt automatisk.
471. Lag test for brief loading uten layout shift.
472. Lag test for review approve på mobil.
473. Lag test for upload queue på mobil.
474. Lag test for offline queue på mobil.
475. Lag test for iPad orientation change.

## 476-500: Rollout, produktkvalitet og prioritering

476. Start med en mobile stability pass før nye store UX-endringer.
477. Prioriter header, prosjektbytte og loading-jitter først.
478. Prioriter Planner mobilfeed som hovedhjem etter stabilitet.
479. Prioriter Godkjenning mobil fordi klienter sannsynligvis bruker telefon.
480. Prioriter Prosjektrom brief-steg for klientopplevelse.
481. Prioriter Innboks modal i header for rask handlingsflyt.
482. Prioriter iPad split view for profesjonelle produksjonsbrukere.
483. Prioriter Live Set iPad etter at manus og shotlist er stabilt.
484. Rull ut mobile UI bak feature flag per rolle.
485. Rull ut klientmobil først for brief og godkjenning.
486. Rull ut produsentmobil etter intern QA.
487. Rull ut iPad production mode separat fra telefon.
488. Definer “no desktop regression” som release gate.
489. Krev før/etter-screenshots for mobil og desktop i PR.
490. Krev live Playwright-pass for minst én telefon og én iPad viewport.
491. Krev at console er ren for pageerror før deploy.
492. Krev at API-kall ikke øker over budsjett før deploy.
493. Krev at loading states ikke flimrer ved resync.
494. Dokumenter kjente mobile begrensninger per release.
495. Lag “mobile known issues” i admin diagnostics.
496. Bruk analytics for å se hvilke mobile flater som faktisk brukes.
497. Mål time-to-approve for klient på mobil.
498. Mål time-to-find-project for produsent på mobil.
499. Mål crash-free mobile sessions.
500. Hold mobil/iPad backlog separat og lukk tiltak kun når de er testet på reell viewport.
