# Content-producer (Stig) — klarhets- og resiliens-audit

> Generert av en multi-agent audit-workflow (5 dimensjoner, adversarielt verifisert) 2026-05-31 som del av PR #45.
> 42 verifiserte funn. Mål: innholdsprodusenten skal alltid forstå hva som skjedde og hvorfor.

**Status:** Offline-resiliens (prosjekt-opprett, brief, timeline/economy/reviews lesing+skriving via replay-kø) er levert i PR #45. Denne auditen dekker GJENVÆRENDE klarhetsgap.

Fikset i commit ee494425: stille mutasjons-feil i Economy/Timeline (#1/#19/#20), delt offline-aware feilmelding-helper, stepper-status-klarhet (#30/#40).

## Sammendrag per dimensjon

- **silent-failures**: 8 funn
- **offline-degradation**: 9 funn
- **confusing-states**: 9 funn
- **error-message-quality**: 8 funn
- **cross-step-logic**: 8 funn

---

## Forvirrende tilstander

### [HIGH] Blocking "Foundation" state with vague unlock condition
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:6445`
- **Stig opplever:** Stig sees "Låst til grunnlaget er klart" (Locked until foundation is ready) but doesn't understand what "grunnlag" (foundation) actually means or which specific fields must be filled. The lock appears across workflows but the unlock criteria are diffuse.
- **Rotårsak:** foundationBlockingItems are computed from missingFoundationFields, missingGoalFields, missingAudienceFields, missingLogicFields, missingReferenceFields, and missingContactFields — but the UI only shows a generic count (e.g., '5 mangler') without naming what those 5 items are in the top-level status bar. Stig sees the lock icon but not the list of what's actually missing.
- **Anbefalt fiks:** Replace generic chip label 'Låst til grunnlaget er klart' with explicit list: 'Låst: Mål mangler, Målgruppe mangler, 3 mer' or show expandable detail. Better: let users click the lock to see the exact missing fields, or show a single blocking item at a time with clear CTA to fill it.

### [HIGH] Blocking items show generic help text that doesn't explain the specific missing field
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:6449`
- **Stig opplever:** When storyboard/reviews/deliveries are locked, Stig sees blocking items listed but they show a fallback message 'Dette må fylles ut før resten av planen gir mening' (This must be filled before the rest of the plan makes sense) — which applies to all items identically. Stig doesn't know whether to fill the first blocking item or any of them.
- **Rotårsak:** foundationBlockingItems are sliced and mapped, but the detail message always falls back to a generic string. The actual blocking items have IDs and labels (e.g., 'Prosjektmål mangler', 'Merkevarenotater mangler') but those labels are only used internally; the UI renders clientGroundingRequests[index] which may be undefined or generic.
- **Anbefalt fiks:** For each blocking item, use its label instead of the fallback: 'Prosjektmål mangler — Beskriv tydelig hva prosjektet skal oppnå.' This tells Stig exactly what's missing and what to do.

### [HIGH] Content Logic steps are gated by foundation but gating rule is unclear
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:4661`
- **Stig opplever:** The 'Content Logic' brief step (missingLogicFields: hook, CTA, audience, objective) is part of foundationBlockingItems, but Stig doesn't know if it's critical for the foundation or optional. When she fills 'Mål og leveranse' and 'Målgruppe', the foundation lock doesn't lift — then she notices missingLogicFields are also part of the blocker.
- **Rotårsak:** missingLogicFields are mixed into foundationBlockingItems equally with goal/audience/contact fields, but Content Logic is a separate mode ('content_logic' vs 'activation_plan'). Stig doesn't see that filling 'Content Logic' is mandatory for unlock, not optional.
- **Anbefalt fiks:** Separate foundation fields from Content Logic fields visually. Show 'Grunnlaget krever: Mål, Målgruppe, Tidsrammer. Content Logic krever: Hook, CTA, Budskap.' This clarifies priority and dependencies.

### [HIGH] Budget and Phase Plan approval states show blocked status without unlock instructions
- **Fil:** `role-room/components/producer/ProducerEconomyPanel.tsx:74`
- **Stig opplever:** In the Economy step, budget and phase items show status 'Blokkert' (Blocked) but Stig doesn't see a reason or a way to unblock them. Is she waiting for client approval? Does she need to fill a missing field? Should she contact someone?
- **Rotårsak:** Status is set to 'blocked' but there's no metadata attached explaining why (e.g., 'blocked_reason: "awaiting_client_approval"' or 'blocked_reason: "missing_budget_category"'). The UI renders status without context.
- **Anbefalt fiks:** When status is 'blocked', show the reason inline: 'Blokkert — venter på klientgodkjenning' or 'Blokkert — budsjettategori mangler'. Add a link to the blocking action.

### [MEDIUM] "Venter klient" badge appears without clear path to move past it ✅ (fikset)
- **Fil:** `role-room/components/ContentProducerWorkflowStepper.tsx:204`
- **Stig opplever:** The workflow stepper shows a badge 'Venter klient' (Waiting for client) on the 'Klient' step. Stig doesn't see a way to send the request, check its status, or understand how long it will take. The badge is purely informational with no interaction.
- **Rotårsak:** The approvalStatus is purely visual — the stepper only shows the badge but provides no link to the review panel, no way to resend, and no estimated timeline. The stepper is read-only; all workflow actions happen elsewhere.
- **Anbefalt fiks:** Make the 'Klient' step badge clickable to jump to the review panel, or add a tooltip explaining 'Venter klient — sent 2 dager siden' (Waiting for client — sent 2 days ago) with a link to 'Se beslutningspunkter' (See decision points).

### [MEDIUM] Account Access tiles show "Ikke koblet" without explaining why or how to fix
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:6676`
- **Stig opplever:** In the 'accounts' workspace, Stig sees tiles for Google, Meta, LinkedIn showing 'Ikke koblet' (Not connected) but the tiles don't explain what she should do. Should she click the tile? Is a button missing? Does she need to wait for client?
- **Rotårsak:** The account entry tiles show status but no action. The UI doesn't include a button to initiate OAuth, send an access request, or wait-for-client message. The 'detail' field may say 'Tilgangen er ikke avklart ennå' (Access not yet clarified) but doesn't direct action.
- **Anbefalt fiks:** Each account tile should have a clear action: either '[Koble konto]' (Connect account) if it's producer-owned, or '[Be om tilgang]' (Request access) if waiting for client, or '[Venter på klient]' (Waiting for client) with a timer/date.

### [MEDIUM] Delivery workspace empty state doesn't show how to create files
- **Fil:** `role-room/components/producer/ProducerExportHandoffPanel.tsx:1540`
- **Stig opplever:** In the Delivery (Levering) step, Stig sees 'Ingen leveransefiler er skrevet ennå' (No delivery files written yet). She doesn't see a button to create them or understand that she needs to use a separate feature 'Skriv leveransearbeidsområde' (Write delivery workspace).
- **Rotårsak:** The empty state message says 'Bruk "Skriv leveransearbeidsområde" for å opprette faktiske prosjektfiler' (Use "Write delivery workspace" to create actual project files) but this refers to a feature/button that may be elsewhere in the UI or not visible in this context.
- **Anbefalt fiks:** Replace text message with an action: 'Leveransearbeidsområdet er tomt. [Generer leveransefiler fra planen]' with a prominent button that shows what will happen (auto-fill based on content calendar).

### [MEDIUM] Save button stays disabled after changes with no feedback
- **Fil:** `role-room/components/producer/ProducerClientPlanningPanel.tsx:662`
- **Stig opplever:** Stig edits the Client Planning (Klientplan) panel, types in fields, but the 'Lagre plan' (Save plan) button stays disabled. She doesn't know why — are her changes invalid? Did the save fail? Is she still editing?
- **Rotårsak:** The button is disabled={saving || !dirty}. If saving is true, the button disables but there's no loading indicator or message explaining what's happening. If dirty is false (changes match the original), the button disables silently.
- **Anbefalt fiks:** Add a tooltip to the disabled button: 'Alle endringer er lagret' (All changes saved) if dirty is false, or show a loading spinner + 'Lagrer...' (Saving...) if saving is true.

### [LOW] Empty state lacks actionable next step after foundation is complete
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:6568`
- **Stig opplever:** After Stig fills the foundation brief, the UI shows 'Når produksjonsgrunnlaget er klart, kan du sende storyboard, manus eller shotlist videre' (When foundation is ready, you can send storyboard, manuscript or shotlist forward). But it's only shown in a detail panel, not as a prominent button. Stig completes the brief and sees no clear "Next" action.
- **Rotårsak:** The transition from Brief workspace to Production (storyboard/shotlist/manuscript) is passive — the UI removes the lock but doesn't guide Stig to the next action. The button labels ('Åpne storyboard', 'Åpne shotlist') appear in the sidebar but may be hidden on mobile or behind a collapsed section.
- **Anbefalt fiks:** Show a prominent call-to-action banner when foundation is complete: 'Grunnlaget er klart! Hva vil du gjøre neste? [Storyboard] [Shotlist] [Manus]' in the main panel, not just in sidebar actions.

## Kryss-stegs-logikk

### [HIGH] Delivery and Economy steps never marked complete in workflow stepper
- **Fil:** `role-room/utils/contentProducerWorkflow.ts:47`
- **Stig opplever:** Stig completes delivery exports and economy budgeting work, but the workflow stepper continues to show steps 5 and 6 as uncompleted (numbers instead of checkmarks). Other steps 1-4 show checkmarks, making it appear that Stig never finished, even though the work is done.
- **Rotårsak:** deriveCompletedWorkflowSteps() function (lines 47-57) only includes brief/story/storyboard/approval in the returned array. Delivery and economy are never added to completedSteps, regardless of workflow status.
- **Anbefalt fiks:** Extend deriveCompletedWorkflowSteps to return delivery/economy when status='approved'. Example: if (status === 'approved') { return ['brief', 'story', 'storyboard', 'approval', 'delivery', 'economy']; }

### [HIGH] No workflow status beyond 'approved' for delivery/economy completion
- **Fil:** `role-room/services/producerWorkflowService.ts:2838`
- **Stig opplever:** Stig finishes all delivery and economy work, but the project status badge in the stepper (and elsewhere) continues showing 'Godkjent' even though more phases are complete. There's no acknowledgment that delivery/economy are done.
- **Rotårsak:** deriveProducerWorkflowProjectStatus() derives status from review counts only (pendingReviews, approvedReviews, changesRequestedReviews). It never looks at delivery or economy completion states. The status caps at 'approved' and cannot transition further.
- **Anbefalt fiks:** Add delivery/economy completion tracking to ProducerWorkflowProjectMeta and deriveProducerWorkflowProjectStatus. Consider adding a 'completed' status when all reviews are approved AND delivery/economy phases are marked ready.

### [HIGH] No visual warning or disabled state for accessing steps out of order
- **Fil:** `role-room/components/ContentProducerWorkflowStepper.tsx:143`
- **Stig opplever:** Stig clicks on the 'Levering' (delivery) step button before sending the project to the client for approval. The button responds and opens the delivery panel as if it's a valid action, with no warning that this step shouldn't be accessed yet.
- **Rotårsak:** The stepper button (lines 140-219) has no disabled state, no 'aria-disabled', and no conditional logic based on step prerequisites. All steps are always clickable.
- **Anbefalt fiks:** Add logic to disable buttons for steps that depend on prior completion. Add aria-disabled and visual styling (opacity/cursor) for locked steps. Optionally show a tooltip explaining why a step is locked.

### [HIGH] Completion state discontinuity between status='approved' and delivery/economy work
- **Fil:** `role-room/services/producerWorkflowService.ts:2838`
- **Stig opplever:** Stig gets client approval (status='approved'), and briefly sees 4 checkmarks in the stepper. Then Stig moves to Delivery and completes all exports. The stepper still shows 4 checkmarks and status 'Godkjent', giving no signal that more progress has been made. Stig wonders: 'Is the project done? Do I need to do anything in Economy?'
- **Rotårsak:** The workflow status is derived purely from review states and never advances beyond 'approved'. There's no signal that Stig has made progress in delivery or economy phases because these phases don't affect the status.
- **Anbefalt fiks:** Either: (1) add 'delivery_complete' and 'economy_complete' states, or (2) track delivery/economy readiness in producerWorkflowMeta and expose it via the stepper or a separate progress indicator.

### [MEDIUM] Unmapped project_room workspaces show wrong active step in stepper
- **Fil:** `role-room/utils/contentProducerWorkflow.ts:32`
- **Stig opplever:** If a new sub-workspace is added to the project_room panel (e.g., 'timeline', 'planning_notes', 'reference_materials'), Stig navigates into it, but the stepper continues to highlight the 'Brief' step (step 1) instead of showing the appropriate step or no step at all.
- **Rotårsak:** deriveActiveWorkflowStep() at line 32-35 checks for 'storyboard' and 'manuscript'/'shotlist' workspaces specifically, then defaults to 'brief' for all other project_room workspaces. Any new workspace value will incorrectly map to 'brief'.
- **Anbefalt fiks:** Return null for unmapped workspaces instead of defaulting to 'brief'. Explicitly list all valid project_room workspaces: case 'project_room': if (workspace === 'storyboard') return 'storyboard'; if (workspace === 'manuscript' || workspace === 'shotlist') return 'story'; if (workspace === 'brief') return 'brief'; return null;

### [MEDIUM] No feedback when moving between steps in stepper
- **Fil:** `role-room/components/CastingPlannerPanel.tsx:6500`
- **Stig opplever:** Stig clicks from Brief → Story → Storyboard. Each click works, but there's no toast, flash, or other confirmation that the step changed. The panel changes, but if Stig is distracted, they may not notice they're in a different step.
- **Rotårsak:** handleSelectWorkflowStep (line 6500-6527) calls openContentProducerPlannerSurface() without any feedback. No toast, no progress indicator, no 'Step changed' message.
- **Anbefalt fiks:** Add a brief toast or banner message (e.g., 'Now in: Story') when a step is selected. Or highlight the active step in the stepper with a subtle animation or 'pulse' effect.

### [MEDIUM] Economy and Delivery step buttons always clickable even before approval
- **Fil:** `role-room/components/ContentProducerWorkflowStepper.tsx:140`
- **Stig opplever:** Stig is still in the Brief step, hasn't sent anything for approval yet, and clicks the 'Levering' (Delivery) button. The panel opens and shows delivery options, but logically Stig shouldn't be exporting deliveries before the project is approved. No warning appears.
- **Rotårsak:** ContentProducerWorkflowStepper passes every step click to handleSelectWorkflowStep without any prerequisite validation. The handler (line 6520-6521) opens the delivery surface unconditionally.
- **Anbefalt fiks:** Check prerequisites before allowing navigation. In handleSelectWorkflowStep, add a guard: if (step === 'delivery' && currentProject?.producerWorkflowStatus !== 'approved') { showWarning('Levering er ikke tilgjengelig før klient har godkjent'); return; }

### [MEDIUM] Approval badge state transitions are not clearly labeled ✅ (fikset)
- **Fil:** `role-room/components/ContentProducerWorkflowStepper.tsx:204`
- **Stig opplever:** The Approval step shows a badge with states: 'Planlegging' (Planning), 'Venter klient' (Waiting for Client), 'Endringer ønsket' (Changes Requested), 'Godkjent' (Approved). Stig sees 'Venter klient' and thinks the step is waiting, not knowing if they initiated this wait or if the client is reviewing.
- **Rotårsak:** The badge labels (lines 89-93 in APPROVAL_BADGE_CONFIG) don't distinguish between Stig's actions and client actions, or between 'step in progress' vs 'step blocked' vs 'step complete'.
- **Anbefalt fiks:** Rename 'Venter klient' to 'Sendt til godkjenning' (Submitted for Approval) and adjust styling. Add a tooltip explaining: 'Prosjektet ble sendt til klient. Venter på tilbakemelding.' for awaiting_client state.

## Feilmelding-kvalitet

### [HIGH] Bare HTTP status codes displayed to user (no context)
- **Fil:** `role-room/components/producer/FeedPostDetailPanel.tsx:267`
- **Stig opplever:** Stig publishes a post to Facebook and sees error 'HTTP 403' with no explanation of what went wrong, what permission is missing, or what to do next.
- **Rotårsak:** Fallback shows `body?.error || 'HTTP ' + response.status` when error response body doesn't have an error field, exposing raw HTTP status codes instead of human-readable messages.
- **Anbefalt fiks:** Replace `HTTP ${response.status}` with status-specific messages like: 403→'Ingen tilgang til denne Facebook-siden. Sjekk dine rettighetern.', 429→'For mange forespørsler. Vent noen minutter før du prøver igjen.', etc.

### [HIGH] Timeline item creation throws unhandled error with no user feedback ✅ (fikset)
- **Fil:** `role-room/components/producer/ProducerTimelinePanel.tsx:696`
- **Stig opplever:** Stig creates a new timeline item (e.g., 'Shoot day'). If the backend call fails, the form clears immediately (line 706-712) as if it succeeded, but the item never appears in the list. Stig thinks it saved but it didn't.
- **Rotårsak:** handleCreate awaits createItem() but has no try/catch. If createItem() throws (e.g., network error, validation), the error propagates uncaught, form state is reset anyway, and no error message is shown. The useProducerTimeline hook sets error state but it's not displayed in the create form area.
- **Anbefalt fiks:** Wrap createItem in try/catch, show error toast on failure, and don't reset form until success. Example: `try { await createItem(...); setTitle(''); } catch(e) { enqueueSnackbar(e.message || 'Kunne ikke opprette tidslinjeelement'); }`

### [HIGH] Economy item creation throws unhandled error with silent failure ✅ (fikset)
- **Fil:** `role-room/components/producer/ProducerEconomyPanel.tsx:215`
- **Stig opplever:** Stig enters budget item details and clicks 'Add budget line'. Form clears, but if network fails, the item never appears. Stig has no idea the save failed — form was cleared as if success happened.
- **Rotårsak:** handleCreate() awaits createItem() but lacks error handling. Form is reset (line 225-227) regardless of success/failure. The hook error state exists (line 68) but no error UI is shown near the create form.
- **Anbefalt fiks:** Wrap in try/catch with toast feedback: `try { await createItem(...); setCategory(''); } catch(e) { enqueueSnackbar('Kunne ikke opprette økonomi-element: ' + e.message); }`

### [HIGH] Timeout error message lacks actionable guidance
- **Fil:** `role-room/components/producer/ProducerExportHandoffPanel.tsx:131`
- **Stig opplever:** Stig downloads the client package PDF. After a few seconds, they see 'Klientpakken tok for lang tid å laste.' Stig doesn't know if they should retry, if the network is slow, or if there's a server issue.
- **Rotårsak:** Generic timeout error message with no guidance. Error is shown but doesn't suggest retry, network troubleshooting, or indicate if it's a transient issue.
- **Anbefalt fiks:** Expand message: 'Klientpakken tok for lang tid å laste. Dette kan skyldes dårlig nettilkobling. Prøv igjen eller kontakt support hvis problemet vedvarer.'

### [HIGH] Missing error feedback for timeline/economy sync operations that silently fail
- **Fil:** `role-room/components/producer/ProducerClientReviewPanel.tsx:1313`
- **Stig opplever:** Stig makes a change that triggers background syncing. If ensurePlanningClientReviews fails, only a diagnostic log is created (line 1314). Stig sees no error message and has no idea the sync failed.
- **Rotårsak:** Multiple void promises with .catch() handlers that log diagnostics but don't show user-facing errors. No toast, no error state, no indication the operation failed.
- **Anbefalt fiks:** Show non-blocking toast or banner for sync failures: `.catch((syncError) => { enqueueSnackbar('Kunne ikke synkronisere endringer.', {variant: 'warning'}); logRoleRoomDiagnostic(...); })`

### [MEDIUM] Feed plan refresh error message includes technical placeholder 'ukjent feil'
- **Fil:** `role-room/components/producer/RoleRoomFeedPlannerPanel.tsx:338`
- **Stig opplever:** Stig refreshes the AI feed strategy. Backend returns an error without a details field. Stig sees 'Refresh feilet: ukjent feil' (unknown error). This is clearly a fallback that wasn't meant to be shown to users.
- **Rotårsak:** Fallback text 'ukjent feil' (unknown error) appears when result.error is missing/empty. This should be caught earlier or given a more helpful default message.
- **Anbefalt fiks:** Use a meaningful fallback: result.error ?? 'Strategioppdateringen kunne ikke fullføres. Prøv igjen.'

### [MEDIUM] Generic catch-all error for AI recommendation lacks entitlement context
- **Fil:** `role-room/components/producer/FeedPostDetailPanel.tsx:402`
- **Stig opplever:** Stig clicks 'Get AI recommendation' for a post. Depending on the error, they see either a specific message ('AI-anbefaling krever aktiv Role Room-pakke') or a generic one ('Kunne ikke hente AI-anbefaling'). The generic message gives no hint what went wrong.
- **Rotårsak:** Fallback message 'Kunne ikke hente AI-anbefaling' doesn't distinguish between network errors, permissions, account issues, or service outages.
- **Anbefalt fiks:** Add error type hints: if (caught instanceof Error && caught.message.includes('401')) { setAiError('Logg inn på nytt for å bruke AI-anbefaling'); } else if (...network...) { ... } else { setAiError(...); }

### [MEDIUM] No feedback when clearing an error state — user may not notice recovery
- **Fil:** `role-room/components/producer/RoleRoomFeedPlannerPanel.tsx:142`
- **Stig opplever:** Stig sees a save error message. They retry the action. Error clears, but there's no positive feedback (like 'Lagret!' or a success toast). Stig must check the 'Lagret' timestamp text to confirm success.
- **Rotårsak:** Error is cleared (setSaveError(null)) but no success toast or confirmation message is shown. Only the timestamp footer updates, which is subtle and easy to miss.
- **Anbefalt fiks:** Show a brief success toast: on save success, enqueueSnackbar('Feed-planen er lagret.', {variant: 'success', autoHideDuration: 2000})

## Offline-degradering

### [HIGH] File upload operations silently fail with backend-level errors without offline/retry guidance
- **Fil:** `/Users/danielqazi/Creatorhubn-monorepo/.claude/worktrees/stig-content-producer-e2e/frontend/client/src/contexts/ProjectContext.tsx:921`
- **Stig opplever:** Stig tries to export a client package (ProducerExportHandoffPanel) and uploads it. If backend is down, the file upload fails with 'Failed to upload project file' but NO indication whether network is unreachable, backend is down, or it will auto-retry when online. The error just stops the flow.
- **Rotårsak:** uploadProjectFile (line 921) catches all errors and throws a generic 'Failed to upload project file' message without distinguishing between offline/network errors and actual backend errors. No retry queue, no 'will sync when online' feedback, no offline detection.
- **Anbefalt fiks:** Detect fetch/network errors vs HTTP errors. For network errors (TypeError 'Failed to fetch'), set error to 'Du er offline. Pakken vil lagres lokalt og lastes opp når du er tilkoblet igjen.' For HTTP errors, include status code. Use same offline-resilient pattern as castingService.saveProject (replay queue + localStorage fallback).

### [HIGH] Account Access Vault operations (save/revoke/reveal) fail with no offline fallback or user guidance
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:3564`
- **Stig opplever:** Stig enters a password or secret into the Vault tab, clicks Save, and if backend is unreachable, the error message is the raw API error (e.g. 'Request failed (0)' or network timeout). No explanation that this is critical data that CANNOT work offline, no guidance on retry, nothing saved locally.
- **Rotårsak:** roleRoomAccessVaultApi.upsertSecret (castingApiService line 2896) directly throws backend errors via apiRequest(). There's no catch/fallback. All vault operations (save, revoke, reveal) inherit this pattern and show errors directly without context. These operations legitimately NEED backend but don't say so.
- **Anbefalt fiks:** Wrap vault operations in try-catch that detects offline (network error) vs backend error. For offline: 'Vault kerer internettilkobling. Du kan ikke lagre secrets mens offline. Prøv igjen når du har forbindelse.' For backend error (50x): 'Vault-tjenesten er midlertidig nede. Prøv igjen senere.' Include a clear 'Retry' button that retries immediately.

### [HIGH] Google Workspace sync fails silently when backend unavailable, with misleading 'Google Workspace er aktivert, men prosjektet kunne ikke fullføre automatisk oppsett ennå' message
- **Fil:** `role-room/components/producer/ProducerGoogleWorkspacePanel.tsx:277`
- **Stig opplever:** Stig has Google Workspace linked. Backend is down. Auto-bootstrap fails. The message says 'Google Workspace er aktivert, men prosjektet kunne ikke fullføre automatisk oppsett ennå.' This makes Stig think the integration is broken or needs manual action, when actually the backend is just temporarily down and it will retry when restored.
- **Rotårsak:** On line 277, the catch handler sets a generic error 'Google Workspace er aktivert, men...' that doesn't distinguish between network/offline errors and actual integration failures. No indication this is transient or will be retried.
- **Anbefalt fiks:** Detect network errors and show: 'Du er offline eller backend er utilgjengelig. Auto-oppsett av Google Workspace prøver igjen automatisk.' For other errors: 'Google Workspace-oppsett feilet: [error]. Prøv 'Etabler Drive & Kalender' manuelt eller kontakt support.'

### [HIGH] Delivery package/workspace export hangs with vague timeout message if backend is slow or offline
- **Fil:** `role-room/components/producer/ProducerExportHandoffPanel.tsx:124`
- **Stig opplever:** Stig clicks 'Skriv til prosjektfiler' or 'Skriv leveransearbeidsområde'. If backend is unreachable, the UI shows a loading spinner for 12 seconds (line 122), then displays 'Kunne ikke skrive klientpakken til prosjektets leveranseflyt.' (line 827). No indication WHY (offline? 500 error?) or what to do next. Is it safe to retry?
- **Rotårsak:** handleBuildAndUploadPackage (line 803) calls uploadProjectFile which throws on network failure. The timeout is 12 seconds (line 122). The catch handler (line 825-827) converts all errors to the same 'Kunne ikke skrive...' message without distinguishing offline/retryable vs permanent failures.
- **Anbefalt fiks:** Detect offline vs HTTP errors in the timeout/catch. For offline: 'Du er offline. Pakken kan ikke lastes opp til backend. Når du er tilkoblet igjen, klikk 'Skriv til prosjektfiler' på nytt.' For 5xx: 'Backend-tjenesten er utilgjengelig (5xx). Prøv igjen om noen minutter.' For 4xx: 'Pakke-generering feilet (4xx). Sjekk at alle påkrevde felt er fylt ut.'

### [HIGH] Marketing Plan post updates (draft, publish, save) throw raw backend errors without offline context
- **Fil:** `role-room/components/producer/PostEditDialog.tsx:81`
- **Stig opplever:** Stig edits a marketing plan post (hook, script, caption, status, schedule), clicks Save. If backend is down, the dialog shows an Alert with the raw error message (e.g. 'Request failed (0)' or a timeout). No context that this is temporary/will retry, no indication Stig should try again.
- **Rotårsak:** handleSave (line 75) calls roleRoomAgentService.updateMarketingPlanPost (line 81) which uses apiRequest(). Network errors throw directly without retry or offline-friendly messaging. The error display (line 123) shows e.message raw.
- **Anbefalt fiks:** Catch network/timeout errors separately in handleSave and show: 'Endringen kunne ikke lagres (offline/timeout). Prøv igjen.' For other errors: 'Feil ved lagring: [error]. Prøv igjen eller kontakt support.' Include auto-retry with exponential backoff or manual retry button.

### [HIGH] Client intake/grounding data failures result in timeout without clear offline vs backend error messaging
- **Fil:** `role-room/components/producer/ProducerExportHandoffPanel.tsx:533`
- **Stig opplever:** In 'Eksport og overlevering' panel, Stig's intake/grounding info loads. If backend is slow or down, the section times out (12 sec, line 122) and shows 'Kunne ikke hente klientens input-data' (line 561). Stig doesn't know why or what to do. Can they continue exporting without waiting?
- **Rotårsak:** withClientPackageInputTimeout (line 124-138) wraps all client input fetches in a 12-second timeout. The timeout handler rejects with generic 'tok for lang tid å laste' message (line 131). No distinction between offline, slow network, or backend down. No fallback to cached/stale data.
- **Anbefalt fiks:** Provide option to 'Bruk sist kjente versjon' when timeout occurs. Show banner: 'Klientens input tok lang tid å laste. Du kan eksportere med sist lagrede data, men det kan være utdatert. Prøv igjen når forbindelsen er bedre.' Allow user to proceed or retry.

### [HIGH] Project agreement signature/approvals fetch fails silently when backend unavailable, no offline fallback shown
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:2720`
- **Stig opplever:** In delivery workflow section, Stig sees agreement signatures. If backend is down, the load fails (line 2724-2735). The status section just shows as empty without a banner saying 'Kunne ikke hente godkjenningsstatus. Offline eller backend nede.' Stig might think agreements are missing.
- **Rotårsak:** loadClientWorkspace (line 2700+) calls projectAgreementsApi.getAgreements() which fails on network error. The catch block (line 2724-2735) sets clientWorkspaceError but the UI might not prominently show it if the panel is still loading other data.
- **Anbefalt fiks:** Show a clear alert in the Agreements section when offline: 'Godkjenningsstatus kunne ikke lastes. Viser sist kjente status. Når forbindelsen er tilbake, åpne panelet på nytt.'

### [MEDIUM] Client material fetch falls back to localStorage silently without UI feedback that offline data is being shown
- **Fil:** `role-room/services/producerWorkflowService.ts:1708`
- **Stig opplever:** Stig looks at the Client Materials section (Levering phase). If backend is down, fetchClientMaterials (line 1700-1712) falls back to localStorage and returns cached materials silently. Stig doesn't know if the list is stale or current. If a new material was just uploaded before going offline, it won't appear.
- **Rotårsak:** fetchClientMaterials wraps backend call in try-catch (line 1707) and silently falls back to readClientMaterialsFromStorage() (line 1711). The console.warn goes to dev tools only. No UI badge/banner to warn user 'Viser cached materiale fra [timestamp]'.
- **Anbefalt fiks:** Return a tuple with the data and sync status: {data, syncStatus: 'current' | 'offline_cache' | 'error'}. In ProducerMediaPanel or delivery export panel, show a banner when syncStatus !== 'current': ⚠ 'Noen materiale kan være utdatert (offline). Når du har forbindelse, åpne panelet på nytt for å synkronisere.'

### [LOW] Brand Guide (logoUrl, colors, fonts) edits in ProducerClientPlanningPanel persist locally but with no indication they're offline-safe
- **Fil:** `role-room/components/producer/ProducerClientPlanningPanel.tsx:2070`
- **Stig opplever:** Stig edits the brand guide (logo, colors, fonts). If backend is down, changes appear to save (state updates) but there's no feedback that this is being queued/will sync. If Stig refreshes immediately, they see the changes were lost. Confusing.
- **Rotårsak:** Brand guide edits (logoUrl, colors, fonts) are part of producerPlanning which calls castingService.saveProject(). This HAS offline persistence via replay queue (producerWorkflowService line 1708-1711). But the UI doesn't show 'saved locally, will sync when online' feedback like other services do.
- **Anbefalt fiks:** Add a badge/indicator next to 'Merkevareguide' section showing sync status: ✓ 'Synkronisert', ⏳ 'Avventer synkronisering (offline)', or ⚠ 'Synkfeil — prøver igjen'. Use emitProducerWorkflowEvent to track sync state.

## Stille feil

### [HIGH] ProducerEconomyPanel: Silent failures on add/edit/delete budget items ✅ (fikset)
- **Fil:** `role-room/components/producer/ProducerEconomyPanel.tsx:213`
- **Stig opplever:** Stig adds a budget line, clicks 'Legg til linje' (Add line), sees the button return to normal state. But the line doesn't appear and there's no error message. He thinks it might have worked but isn't sure. If the API fails (e.g., offline), the user gets no feedback at all—just silence.
- **Rotårsak:** handleCreate, handleSaveItem, and handleDeleteItem use await but have no try-catch blocks. If createItem/updateItem/removeItem throw, the promise rejection goes unhandled. The hook exposes `error` state for load failures, but not for individual item mutations. No toast or error Alert is shown on failure.
- **Anbefalt fiks:** Wrap createItem/updateItem/removeItem calls in try-catch, and call enqueueSnackbar with variant 'error' on failure. Example: `try { await createItem(...); enqueueSnackbar('Linje lagt til.', {variant: 'success'}); } catch(e) { enqueueSnackbar('Kunne ikke legge til linje.', {variant: 'error'}); }`

### [HIGH] FeedPostDetailPanel: Silent failure when loading Facebook Pages list
- **Fil:** `role-room/components/producer/FeedPostDetailPanel.tsx:235`
- **Stig opplever:** Stig lands on the Feed Post detail page and wants to publish to a Facebook Page. The page list fetch fails (network error, auth issue, etc.). The UI renders an empty page list silently. Stig sees 'Velg en Facebook Page først' validation error when trying to publish, but doesn't know WHY the list is empty. No error banner appears.
- **Rotårsak:** At line 227-235, the fetch for `/api/role-room/facebook/pages` has a `.catch(() => { /* silently ignore */ })` handler that swallows all errors without logging or updating UI state. If the fetch fails, fbPages stays empty and fbPublishStatus never displays the actual error.
- **Anbefalt fiks:** Replace the silent catch with error state update: `.catch((e) => { setFbLoadError('Kunne ikke hente Facebook Pages'); console.error(e); })` and render an error message in the UI if fbLoadError is set.

### [HIGH] ProducerClientPlanningPanel: ensurePlanningClientReviews failure only logs diagnostic, no UI feedback
- **Fil:** `role-room/components/producer/ProducerClientPlanningPanel.tsx:298`
- **Stig opplever:** Stig edits the client planning and saves. The planning saves locally, but the async ensurePlanningClientReviews call fails (e.g., backend unreachable). Only a diagnostic log is written; Stig sees the plan saved successfully, unaware that review synchronization failed. Client approval workflows may be out of sync.
- **Rotårsak:** Line 298 calls `.catch((syncError) => { logRoleRoomDiagnostic(...) })` which only logs to diagnostics. No error state is set, no toast shown. The promise is fire-and-forget (`void`), and the component never tells Stig that review sync failed.
- **Anbefalt fiks:** Set an error state for sync failures: `void promise.catch((syncError) => { setSyncError('Kunneikke synkronisere klientpunkter'); logRoleRoomDiagnostic(...); })` and display a warning Alert in the render if syncError is set.

### [HIGH] ProducerClientReviewPanel: ensureClientGroundingReviews failure only logs diagnostic, silently drops sync
- **Fil:** `role-room/components/producer/ProducerClientReviewPanel.tsx:1325`
- **Stig opplever:** Stig views the Client Review panel, which automatically calls ensureClientGroundingReviews to sync client intake and materials for approval. If this sync fails, Stig never sees the failure. The panel displays stale data and Stig doesn't know the client's latest grounding wasn't loaded.
- **Rotårsak:** Line 1325 calls `.catch((syncError) => { logRoleRoomDiagnostic(...) })` which is silent. No error state, no toast, no warning. The panel renders as if everything loaded successfully, but client data is stale.
- **Anbefalt fiks:** Add state for sync errors: `const [syncError, setSyncError] = useState<string | null>(null)` and update it in the catch block. Display a Warning Alert in the panel if syncError is set, explaining that client data may be stale.

### [HIGH] ProducerMediaPanel: Offline queue fallback for planning draft save lacks visibility
- **Fil:** `role-room/services/castingService.ts:1997`
- **Stig opplever:** Stig saves planning edits while offline or during a backend outage. The save queues locally (correctly), but Stig sees no indication that it's queued. He thinks the save succeeded fully. Later when connectivity returns, he might not realize sync happened, or sync might silently fail again without him knowing.
- **Rotårsak:** At line 1997, when saveProjectToRemote fails, the code calls `queueProjectChange(project, reason, message).catch((queueError) => { console.warn(...) })`. The queue operation silently swallows errors. The component's UI doesn't distinguish between 'saved & synced' and 'saved locally, queued for sync'.
- **Anbefalt fiks:** Return sync status from saveProject/saveProjectToDb and expose it to the component: return `{success: false, queued: true}` on queue fallback. Display a banner: 'Endringene er lagret lokalt og venter på internettforbindelse.' until sync succeeds.

### [HIGH] castingService: saveProject queuing failure only warns to console, blocks offline recovery
- **Fil:** `role-room/services/castingService.ts:2052`
- **Stig opplever:** Stig saves a project change while offline. The save queues (good). But if queueProjectChange itself fails (storage quota exceeded, IndexedDB error), the error is only console.warn'd. Stig's change is lost and he never learns why.
- **Rotårsak:** Line 1997: `await queueProjectChange(project, reason, message).catch((queueError) => { console.warn(...) })` silently logs a warning. No error is propagated to the caller or stored. The component never knows the queue failed.
- **Anbefalt fiks:** Log the queue failure and expose it: either throw or return a status tuple. Example: `{saved: true, synced: false, queuedSuccessfully: false, queueError?: string}` so the component can warn the user if queueing fails.

### [MEDIUM] ProducerMediaPanel: Client material file upload failure only shows error state briefly
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:5499`
- **Stig opplever:** Stig uploads a client material file (e.g., brand guide PDF). The upload fails due to file size or network issue. The error 'Kunne ikke laste opp filen til prosjektet.' appears briefly via setError, but if Stig clicks elsewhere or scrolls, the error disappears before he finishes reading it. No persistent warning or toast.
- **Rotårsak:** The catch block at line 5499 calls `setError(...)` which updates component error state. But this state is cleared by other actions (e.g., opening a different material, navigating panels). The error is not sticky and can disappear before the user notices.
- **Anbefalt fiks:** Use `enqueueSnackbar('Kunne ikke laste opp filen til prosjektet.', {variant: 'error', autoHideDuration: 6000})` instead of setError, which shows a persistent notification with a guaranteed timeout. Keep setError for optional persistent UI state if needed.

### [MEDIUM] ProducerMediaPanel: Google Workspace integration failures only in console, no UI warning
- **Fil:** `role-room/components/producer/ProducerMediaPanel.tsx:2712`
- **Stig opplever:** Stig navigates to the Google Workspace panel. The status check fails silently (auth revoked, rate limited). No error appears in the UI. The panel renders an empty or stale state. Stig assumes Google Workspace is not set up, when in fact the check failed.
- **Rotårsak:** Line 2712: `googleWorkspaceApi.getStatus(projectId).catch(() => null)` silently returns null on error. The component has no way to distinguish between 'not set up' and 'check failed'. No error state is set.
- **Anbefalt fiks:** Return a distinct failure state: `.catch((e) => ({ error: 'failed', message: e.message }))` and render a diagnostic message if status.error is set. Or set an error state and display an Alert in the Google Workspace section.

