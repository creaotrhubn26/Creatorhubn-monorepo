/**
 * creatorhub-events — Slice 9X.70
 *
 * Sentralisert GA4-event-bibliotek for alle CreatorHub-flyter. Bruker
 * `trackEvent` fra ga4-client-tracking under panseret, med konsistent
 * `creatorhub_*`-prefiks og felles params (profession, user_id).
 *
 * Hvorfor: spredte gtag-kall blir umulig å vedlikeholde. Ved å samle
 * alle event-navn her, kan Daniel se ETT sted hvilke events GA4 mottar
 * og endre navn uten å lete gjennom hele kodebasen.
 */

import { trackEvent } from './ga4-client-tracking';

const PREFIX = 'creatorhub_';

type EventParams = Record<string, unknown>;

/**
 * Lavnivå-tracking — sender til BÅDE GA4 og /api/analytics/event.
 * Backend-loggen lar admin se data inline uten å åpne GA4-konsollen.
 */
function track(eventName: string, params: EventParams = {}) {
  const fullName = `${PREFIX}${eventName}`;
  const payload = { timestamp: new Date().toISOString(), ...params };

  // 1. Send til GA4 (gtag)
  trackEvent(fullName, payload);

  // 2. Persister til backend for admin-overview (fire-and-forget)
  if (typeof window !== 'undefined' && navigator.onLine !== false) {
    try {
      const body = JSON.stringify({
        eventType: fullName,
        metadata: payload,
      });
      // sendBeacon overlever side-navigasjon; faller tilbake til fetch
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/event', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {}
  }
}

// ─── Marketplace ───────────────────────────────────────────────────
export const marketplaceEvents = {
  opened: (source: 'dashboard_button' | 'tab' | 'cta' | 'other') =>
    track('marketplace_opened', { source }),

  appViewed: (appId: string, profession?: string) =>
    track('marketplace_app_viewed', { app_id: appId, profession }),

  tierViewed: (appId: string, tierId: string, isRecommended: boolean) =>
    track('marketplace_tier_viewed', { app_id: appId, tier_id: tierId, recommended: isRecommended }),

  installClicked: (appId: string, ctaLabel?: string) =>
    track('marketplace_install_clicked', { app_id: appId, cta_label: ctaLabel }),

  installCompleted: (appId: string) =>
    track('marketplace_install_completed', { app_id: appId }),

  reviewSubmitted: (appId: string, rating: number) =>
    track('marketplace_review_submitted', { app_id: appId, rating }),
};

// ─── Marketplace admin ─────────────────────────────────────────────
export const marketplaceAdminEvents = {
  appCreated: (appId: string) =>
    track('admin_marketplace_app_created', { app_id: appId }),

  appUpdated: (appId: string, tierCount: number) =>
    track('admin_marketplace_app_updated', { app_id: appId, tier_count: tierCount }),

  appDeleted: (appId: string) =>
    track('admin_marketplace_app_deleted', { app_id: appId }),

  publishedToStripe: (appId: string, tierCount: number, errored: number) =>
    track('admin_marketplace_published_stripe', {
      app_id: appId,
      tier_count: tierCount,
      errored_count: errored,
      success: errored === 0,
    }),
};

// ─── Split sheet ──────────────────────────────────────────────────
export const splitSheetEvents = {
  wizardOpened: (profession?: string) =>
    track('split_sheet_wizard_opened', { profession }),

  wizardStepCompleted: (step: number, stepName: string) =>
    track('split_sheet_wizard_step', { step, step_name: stepName }),

  modelSelected: (model: 'equal' | 'weighted' | 'manual' | 'hybrid') =>
    track('split_sheet_model_selected', { model }),

  participantAdded: (method: 'team_picker' | 'manual', roleId: string) =>
    track('split_sheet_participant_added', { method, role_id: roleId }),

  saved: (data: { model: string; participantCount: number; totalAmount: number; profession?: string }) =>
    track('split_sheet_saved', {
      model: data.model,
      participant_count: data.participantCount,
      total_amount: data.totalAmount,
      profession: data.profession,
    }),

  overviewViewed: (sheetCount: number) =>
    track('split_sheet_overview_viewed', { sheet_count: sheetCount }),
};

// ─── Team-direktorat ──────────────────────────────────────────────
export const teamDirectoryEvents = {
  memberAdded: (hasRole: boolean, hasEmail: boolean, hasPhone: boolean) =>
    track('team_member_added', { has_role: hasRole, has_email: hasEmail, has_phone: hasPhone }),

  memberEdited: (memberId: string) =>
    track('team_member_edited', { member_id: memberId }),

  memberRemoved: (memberId: string) =>
    track('team_member_removed', { member_id: memberId }),

  pickerUsed: (pickedCount: number) =>
    track('team_picker_used', { picked_count: pickedCount }),
};

// ─── Dashboard ────────────────────────────────────────────────────
export const dashboardEvents = {
  tabChanged: (tabId: string, profession?: string) =>
    track('dashboard_tab_changed', { tab_id: tabId, profession }),

  quickActionClicked: (action: string, profession?: string) =>
    track('dashboard_quick_action', { action, profession }),

  splitSheetsModalOpened: (profession?: string) =>
    track('dashboard_split_sheets_modal_opened', { profession }),
};

// ─── Stripe / payment ─────────────────────────────────────────────
export const paymentEvents = {
  statusViewed: () => track('admin_payment_status_viewed'),
  statusRefreshed: () => track('admin_payment_status_refreshed'),
};

// ─── Customer inquiry funnel ──────────────────────────────────────
export const inquiryEvents = {
  received: (data: { source?: string; profession?: string; budget?: number; eventType?: string }) =>
    track('inquiry_received', data),
  opened: (inquiryId: string) =>
    track('inquiry_opened', { inquiry_id: inquiryId }),
  replied: (inquiryId: string, replyMethod: 'email' | 'chat' | 'sms') =>
    track('inquiry_replied', { inquiry_id: inquiryId, reply_method: replyMethod }),
  convertedToProject: (inquiryId: string, projectId?: string, amount?: number) =>
    track('inquiry_converted_to_project', { inquiry_id: inquiryId, project_id: projectId, amount }),
  lost: (inquiryId: string, reason?: string) =>
    track('inquiry_lost', { inquiry_id: inquiryId, reason }),
  splitSheetSuggested: (inquiryId: string) =>
    track('inquiry_split_sheet_suggested', { inquiry_id: inquiryId }),
};

// ─── Klient-galleri ───────────────────────────────────────────────
export const galleryEvents = {
  createdByPro: (galleryId: string, itemCount: number) =>
    track('gallery_created', { gallery_id: galleryId, item_count: itemCount }),
  viewedByClient: (galleryId: string, accessToken?: string) =>
    track('gallery_viewed_by_client', { gallery_id: galleryId, has_token: !!accessToken }),
  itemSelected: (galleryId: string, itemId: string) =>
    track('gallery_item_selected', { gallery_id: galleryId, item_id: itemId }),
  downloadRequested: (galleryId: string, itemCount: number) =>
    track('gallery_download_requested', { gallery_id: galleryId, item_count: itemCount }),
  quoteRequested: (galleryId: string, estimatedAmount?: number) =>
    track('gallery_quote_requested', { gallery_id: galleryId, estimated_amount: estimatedAmount }),
  quoteAccepted: (galleryId: string, amount: number) =>
    track('gallery_quote_accepted', { gallery_id: galleryId, amount }),
};

// ─── Chat / meldinger ─────────────────────────────────────────────
type ChatProvider = 'internal' | 'gmail' | 'google_chat' | 'evendi' | 'sms';
export const chatEvents = {
  conversationOpened: (provider: ChatProvider, conversationId?: string) =>
    track('chat_conversation_opened', { provider, conversation_id: conversationId }),
  messageSent: (provider: ChatProvider, length: number, hasAttachment: boolean) =>
    track('chat_message_sent', { provider, message_length: length, has_attachment: hasAttachment }),
  handoffToEmail: (fromProvider: ChatProvider) =>
    track('chat_handoff_to_email', { from_provider: fromProvider }),
  templateUsed: (templateId: string) =>
    track('chat_template_used', { template_id: templateId }),
};

// ─── AI-features ──────────────────────────────────────────────────
type AICategory = 'photo' | 'video' | 'audio' | 'text' | 'storyboard';
export const aiEvents = {
  started: (category: AICategory, feature: string) =>
    track('ai_started', { category, feature }),
  completed: (category: AICategory, feature: string, data: { durationMs?: number; tokens?: number; success: boolean }) =>
    track('ai_completed', { category, feature, ...data }),
  failed: (category: AICategory, feature: string, errorCode?: string) =>
    track('ai_failed', { category, feature, error_code: errorCode }),
};

// ─── Wedding-assistant program ────────────────────────────────────
export const assistantEvents = {
  invited: (weddingId: string, assistantEmail: string) =>
    track('assistant_invited', { wedding_id: weddingId, has_email: !!assistantEmail }),
  ndaSigned: (assistantId: string) =>
    track('assistant_nda_signed', { assistant_id: assistantId }),
  briefNotesSaved: (assistantId: string, length: number) =>
    track('assistant_brief_notes_saved', { assistant_id: assistantId, notes_length: length }),
  gdprAccepted: (assistantId: string) =>
    track('assistant_gdpr_accepted', { assistant_id: assistantId }),
  driveFolderLinked: (assistantId: string) =>
    track('assistant_drive_folder_linked', { assistant_id: assistantId }),
  subcontractSigned: (assistantId: string, amount?: number) =>
    track('assistant_subcontract_signed', { assistant_id: assistantId, amount }),
};

// ─── Prototype-tester program ─────────────────────────────────────
export const testerEvents = {
  invited: (testerEmail: string) =>
    track('tester_invited', { has_email: !!testerEmail }),
  sessionStarted: (sessionId: string) =>
    track('tester_session_started', { session_id: sessionId }),
  sessionCompleted: (sessionId: string, durationMin: number, feedbackCount: number) =>
    track('tester_session_completed', { session_id: sessionId, duration_min: durationMin, feedback_count: feedbackCount }),
  enterpriseOfferShown: (testerId: string) =>
    track('tester_enterprise_offer_shown', { tester_id: testerId }),
  enterpriseOfferAccepted: (testerId: string, plan: string) =>
    track('tester_enterprise_offer_accepted', { tester_id: testerId, plan }),
};

// ─── Notifications ────────────────────────────────────────────────
export const notificationEvents = {
  received: (type: string, channel: 'in_app' | 'email' | 'push' | 'sms') =>
    track('notification_received', { notification_type: type, channel }),
  clicked: (type: string, actionTaken: string) =>
    track('notification_clicked', { notification_type: type, action_taken: actionTaken }),
  dismissed: (type: string) =>
    track('notification_dismissed', { notification_type: type }),
};

// ─── Worklog ──────────────────────────────────────────────────────
export const worklogEvents = {
  entryCreated: (hours: number, projectId?: string) =>
    track('worklog_entry_created', { hours, project_id: projectId }),
  exportedPdf: (entryCount: number, totalHours: number) =>
    track('worklog_exported_pdf', { entry_count: entryCount, total_hours: totalHours }),
};

// ─── Equipment ────────────────────────────────────────────────────
export const equipmentEvents = {
  added: (category: string) =>
    track('equipment_added', { category }),
  checkedOut: (equipmentId: string, projectId?: string) =>
    track('equipment_checked_out', { equipment_id: equipmentId, project_id: projectId }),
};

// ─── Showcase publisher ───────────────────────────────────────────
export const showcaseEvents = {
  clipPublished: (clipId: string, platform: string, durationSec?: number) =>
    track('showcase_clip_published', { clip_id: clipId, platform, duration_sec: durationSec }),
  viewLogged: (clipId: string, source?: string) =>
    track('showcase_view_logged', { clip_id: clipId, source }),
};

// ─── Landing / attribution ────────────────────────────────────────
export const attributionEvents = {
  signupIntent: (data: { source?: string; medium?: string; campaign?: string; referrer?: string }) =>
    track('landing_signup_intent', data),
};
