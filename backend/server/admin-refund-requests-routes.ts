/**
 * admin-refund-requests-routes.ts
 *
 * Setup-funksjon for /api/admin/refund-requests/* og tilhørende
 * notifikasjons-endpoint. Admin-flow for å håndtere refund-forespørsler
 * fra brukere — godkjenning utløser Stripe-refund + subscription-cancel,
 * avvisning logger og varsler.
 *
 * 4 endpoints:
 *   GET    /api/admin/refund-requests                       — list pending/all
 *   POST   /api/admin/refund-requests/:id/approve           — Stripe refund + cancel
 *   POST   /api/admin/refund-requests/:id/reject            — record rejection
 *   POST   /api/admin/notifications/refund-action           — log admin handling
 *
 * **Tilgang:** Alle 4 krever `requireAdminSession`.
 *
 * Modulen er pass-through på alle deps — alle Stripe-helpers, mail-
 * helpers og compat-store-helpers blir værende i index.ts (sterkt
 * entangled med resten av billing-stacken).
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupAdminRefundRequestsRoutes } from "./admin-refund-requests-routes";
 *
 *   setupAdminRefundRequestsRoutes({
 *     app,
 *     requireAdminSession,
 *     ...alle helpers...
 *   });
 */

import type express from "express";

import { readNumber, readString } from "./_shared";

// Pass-through-typer (eier sannheten i index.ts). Vi typer dem løst her
// fordi vi ikke leser felt-internt utenom det handleren allerede gjør.

/* eslint-disable @typescript-eslint/no-explicit-any */
// Re-eksportert som any-shape — den faktiske typen i index.ts har felter
// med ulik nullability og ID som number. Modulen bruker disse som pass-
// through-objekter, så vi typer dem løst.
export type CompatRefundRequestRecord = any;
export type AdminSession = any;

export interface AdminRefundRequestsRoutesDeps {
  app: express.Application;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => any;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  listCompatRefundRequestRecords: () => Promise<any[]>;
  readCompatRefundRequestRecord: (id: any) => Promise<any>;
  writeCompatRefundRequestRecord: (record: any) => Promise<void>;
  mapCompatRefundRequestForAdmin: (record: any) => any;
  readCompatPaymentStatusRecord: (id: any) => Promise<any>;
  findCompatPaymentStatusRecord: (transactionId: any) => Promise<any>;
  markCompatPaymentRecordRefunded: (paymentRecord: any, info: any) => Promise<any>;
  updateCompatPaymentHistoryRefundState: (paymentRecord: any, info: any) => Promise<any>;
  getCreatorHubStripeClient: () => any;
  resolveCreatorHubStripeCheckoutRecordFromCompatPayment: (paymentRecord: any) => Promise<any>;
  resolveCreatorHubStripeRefundTarget: (input: any) => Promise<any>;
  clearCreatorHubStripeSubscription: (subscription: any, options?: any) => Promise<any>;
  resolveCreatorHubBillingRecipientContext: (checkoutRecord: any) => Promise<any>;
  sendCreatorHubRefundApprovedEmail: (input: any) => Promise<any>;
  sendCreatorHubRefundRejectedEmail: (input: any) => Promise<any>;
  getDefaultCreatorHubPublicOrigin: () => string;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function setupAdminRefundRequestsRoutes(
  deps: AdminRefundRequestsRoutesDeps,
): void {
  const {
    app,
    requireAdminSession,
    isRecord,
    listCompatRefundRequestRecords,
    readCompatRefundRequestRecord,
    writeCompatRefundRequestRecord,
    mapCompatRefundRequestForAdmin,
    readCompatPaymentStatusRecord,
    findCompatPaymentStatusRecord,
    markCompatPaymentRecordRefunded,
    updateCompatPaymentHistoryRefundState,
    getCreatorHubStripeClient,
    resolveCreatorHubStripeCheckoutRecordFromCompatPayment,
    resolveCreatorHubStripeRefundTarget,
    clearCreatorHubStripeSubscription,
    resolveCreatorHubBillingRecipientContext,
    sendCreatorHubRefundApprovedEmail,
    sendCreatorHubRefundRejectedEmail,
    getDefaultCreatorHubPublicOrigin,
  } = deps;

  app.get("/api/admin/refund-requests", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const refundRequests = (await listCompatRefundRequestRecords()).map(
        mapCompatRefundRequestForAdmin,
      );
      res.json({ refundRequests });
    } catch (error) {
      console.error("Error fetching admin refund requests:", error);
      res.status(500).json({ error: "Could not fetch refund requests" });
    }
  });

  app.post("/api/admin/refund-requests/:id/approve", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const refundRequest = await readCompatRefundRequestRecord(req.params.id);
      if (!refundRequest) {
        return res.status(404).json({ error: "Refund request not found" });
      }
      if (refundRequest.status !== "pending") {
        return res.status(409).json({
          error: "Refund request is already processed",
          request: mapCompatRefundRequestForAdmin(refundRequest),
        });
      }

      const paymentRecord =
        (refundRequest.paymentId
          ? await readCompatPaymentStatusRecord(refundRequest.paymentId)
          : null) ||
        (await findCompatPaymentStatusRecord(refundRequest.transactionId));
      if (!paymentRecord) {
        return res.status(404).json({ error: "Payment not found for refund request" });
      }

      let stripeRefundId: string | null = null;
      let cancellationWarning: string | null = null;

      if (
        refundRequest.paymentProvider === "stripe" ||
        paymentRecord.paymentMethod === "stripe"
      ) {
        const stripe = getCreatorHubStripeClient();
        if (!stripe) {
          return res.status(503).json({
            error: "Stripe refunds are not configured on the server.",
          });
        }

        const creatorHubCheckout =
          await resolveCreatorHubStripeCheckoutRecordFromCompatPayment(paymentRecord);
        const refundTarget = await resolveCreatorHubStripeRefundTarget({
          stripe,
          paymentRecord,
          checkoutRecord: creatorHubCheckout,
        });
        if (!refundTarget?.paymentIntentId && !refundTarget?.chargeId) {
          return res.status(409).json({
            error:
              "Fant ikke et refunderbart Stripe-betalingsgrunnlag for denne betalingen.",
          });
        }

        const refund = await stripe.refunds.create({
          ...(refundTarget.paymentIntentId
            ? { payment_intent: refundTarget.paymentIntentId }
            : { charge: refundTarget.chargeId }),
          amount: refundRequest.amountMinor,
          reason: "requested_by_customer",
          metadata: {
            creatorhub_refund_request_id: String(refundRequest.id),
            creatorhub_payment_id: paymentRecord.id,
            creatorhub_transaction_id: paymentRecord.transactionId,
            creatorhub_plan_id: paymentRecord.planId || "",
            creatorhub_user_id: paymentRecord.userId || "",
          },
        });
        stripeRefundId = refund.id || null;

        const subscriptionId =
          refundTarget.subscriptionId ||
          creatorHubCheckout?.stripeSubscriptionId ||
          refundRequest.stripeSubscriptionId;
        if (subscriptionId && creatorHubCheckout) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            if (
              subscription.status !== "canceled" &&
              subscription.status !== "incomplete_expired"
            ) {
              const cancelledSubscription = await stripe.subscriptions.cancel(
                subscriptionId,
              );
              await clearCreatorHubStripeSubscription(cancelledSubscription, {
                suppressFailureEmail: true,
                suppressCancellationEmail: true,
                failureMessage:
                  "Abonnementet ble avsluttet etter godkjent refundering.",
              });
            }
          } catch (cancelError) {
            cancellationWarning =
              cancelError instanceof Error
                ? cancelError.message
                : "Stripe refund ble gjennomført, men abonnementet kunne ikke avsluttes automatisk.";
            console.error(
              "CreatorHub refund subscription cancellation failed:",
              cancelError,
            );
          }
        }
      }

      const processedAt = new Date().toISOString();
      await markCompatPaymentRecordRefunded(paymentRecord, {
        refundReason: refundRequest.reason,
        refundedAt: processedAt,
        stripeRefundId,
        refundRequestId: refundRequest.id,
      });

      const approvedRequest: CompatRefundRequestRecord = {
        ...refundRequest,
        status: "approved",
        processedAt,
        processedByUserId: adminSession.userId,
        processedByEmail: adminSession.email,
        processedByName: adminSession.name,
        rejectionReason: null,
        stripeRefundId,
        stripePaymentIntentId: refundRequest.stripePaymentIntentId,
        stripeChargeId: refundRequest.stripeChargeId,
      };
      await writeCompatRefundRequestRecord(approvedRequest);

      if (approvedRequest.userEmail) {
        const creatorHubRecord =
          await resolveCreatorHubStripeCheckoutRecordFromCompatPayment(paymentRecord);
        const recipient =
          creatorHubRecord &&
          creatorHubRecord.email &&
          creatorHubRecord.planName
            ? await resolveCreatorHubBillingRecipientContext(creatorHubRecord)
            : {
                email: approvedRequest.userEmail,
                recipientName:
                  [approvedRequest.firstName, approvedRequest.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() || "CreatorHub-medlem",
              };
        if (recipient.email) {
          await sendCreatorHubRefundApprovedEmail({
            recipientEmail: recipient.email,
            recipientName: recipient.recipientName,
            planName: approvedRequest.planName || paymentRecord.planName,
            amountMajor: approvedRequest.amountMajor,
            currency: approvedRequest.currency,
            creatorHubUrl: getDefaultCreatorHubPublicOrigin(),
          }).catch((error) => {
            console.error("CreatorHub refund approval email failed:", error);
          });
        }
      }

      res.json({
        success: true,
        request: mapCompatRefundRequestForAdmin(approvedRequest),
        warning: cancellationWarning,
      });
    } catch (error) {
      console.error("Error approving refund request:", error);
      res.status(500).json({ error: "Could not approve refund request" });
    }
  });

  app.post("/api/admin/refund-requests/:id/reject", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const refundRequest = await readCompatRefundRequestRecord(req.params.id);
      if (!refundRequest) {
        return res.status(404).json({ error: "Refund request not found" });
      }
      if (refundRequest.status !== "pending") {
        return res.status(409).json({
          error: "Refund request is already processed",
          request: mapCompatRefundRequestForAdmin(refundRequest),
        });
      }

      const rejectionReason =
        readString((isRecord(req.body) ? req.body.reason : null)) ||
        "Refunderingen ble ikke godkjent.";
      const processedAt = new Date().toISOString();
      const rejectedRequest: CompatRefundRequestRecord = {
        ...refundRequest,
        status: "rejected",
        processedAt,
        processedByUserId: adminSession.userId,
        processedByEmail: adminSession.email,
        processedByName: adminSession.name,
        rejectionReason,
      };
      await writeCompatRefundRequestRecord(rejectedRequest);

      const paymentRecord =
        (refundRequest.paymentId
          ? await readCompatPaymentStatusRecord(refundRequest.paymentId)
          : null) ||
        (await findCompatPaymentStatusRecord(refundRequest.transactionId));
      if (paymentRecord) {
        await updateCompatPaymentHistoryRefundState(paymentRecord, {
          refunded: false,
          refundReason: refundRequest.reason,
          refundedAt: null,
          refundRequestId: refundRequest.id,
          refundRequestStatus: "rejected",
          refundRequestedAt: refundRequest.requestedAt,
        });
      }

      if (rejectedRequest.userEmail) {
        const recipientName =
          [rejectedRequest.firstName, rejectedRequest.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "CreatorHub-medlem";
        await sendCreatorHubRefundRejectedEmail({
          recipientEmail: rejectedRequest.userEmail,
          recipientName,
          planName:
            rejectedRequest.planName || paymentRecord?.planName || "CreatorHub Plan",
          rejectionReason,
          creatorHubUrl: getDefaultCreatorHubPublicOrigin(),
        }).catch((error) => {
          console.error("CreatorHub refund rejection email failed:", error);
        });
      }

      res.json({
        success: true,
        request: mapCompatRefundRequestForAdmin(rejectedRequest),
      });
    } catch (error) {
      console.error("Error rejecting refund request:", error);
      res.status(500).json({ error: "Could not reject refund request" });
    }
  });

  app.post("/api/admin/notifications/refund-action", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const body = isRecord(req.body) ? req.body : {};
      res.json({
        success: true,
        action: readString(body.action) || null,
        count: readNumber(body.count) || 0,
        timestamp: readString(body.timestamp) || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error logging refund notification action:", error);
      res.status(500).json({ error: "Could not log refund notification action" });
    }
  });
}
