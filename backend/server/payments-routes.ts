import express from "express";
import crypto from "crypto";
import { readString } from "./_shared";

export interface PaymentsRoutesDeps {
  app: express.Application;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  compatHeaderString: (value: unknown) => string | null;
  compatResolveUserId: (req: express.Request) => string;
  compatResolveUserEmail: (req: express.Request) => string | null;
  buildCompatPaymentHistory: (
    userId: string,
    email: string | null,
  ) => Promise<any[]>;
  writeCompatPaymentHistory: (
    userId: string,
    history: any[],
  ) => Promise<void>;
  decorateCompatPaymentHistoryWithRefundRequests: (
    history: any[],
    userId: string,
    email: string | null,
  ) => Promise<any[]>;
  findCompatPaymentStatusRecord: (paymentId: string) => Promise<any>;
  canAccessCompatPaymentDocument: (req: express.Request, record: any) => boolean;
  buildCompatPaymentDocumentHtml: (input: {
    title: string;
    subtitle: string;
    record: any;
    historyEntry: any;
    accountingReady: boolean;
  }) => string;
  normalizeBillingPlanId: (value: unknown) => string | null;
  getCompatPlatformSubscriptionPlan: (planId: string | null) => any;
  normalizeCompatPaymentMethod: (value: unknown) => string;
  normalizeCompatAmountMinor: (amount: unknown, plan: any) => number;
  resolveCompatPaymentUserScope: (
    userId: string,
    requestId: string | null,
    email: string | null,
  ) => string;
  recordCompatPaymentCompletion: (record: any) => Promise<void>;
  readCompatLatestPaymentStatusRecord: (userId: string) => Promise<any>;
  buildCompatPaymentStatusResponse: (record: any) => any;
  writeCompatPaymentStatusRecord: (record: any) => Promise<void>;
  writeCompatFikenMvaStatus: (userId: string, status: any) => Promise<void>;
  readCompatFikenMvaStatus: (userId: string) => Promise<any>;
}

export function setupPaymentsRoutes(deps: PaymentsRoutesDeps): void {
  const {
    app,
    isRecord,
    compatHeaderString,
    compatResolveUserId,
    compatResolveUserEmail,
    buildCompatPaymentHistory,
    writeCompatPaymentHistory,
    decorateCompatPaymentHistoryWithRefundRequests,
    findCompatPaymentStatusRecord,
    canAccessCompatPaymentDocument,
    buildCompatPaymentDocumentHtml,
    normalizeBillingPlanId,
    getCompatPlatformSubscriptionPlan,
    normalizeCompatPaymentMethod,
    normalizeCompatAmountMinor,
    resolveCompatPaymentUserScope,
    recordCompatPaymentCompletion,
    readCompatLatestPaymentStatusRecord,
    buildCompatPaymentStatusResponse,
    writeCompatPaymentStatusRecord,
    writeCompatFikenMvaStatus,
    readCompatFikenMvaStatus,
  } = deps;

  app.get("/api/payments/history", async (req, res) => {
    try {
      const userId = readString(req.query.userId) || compatResolveUserId(req);
      const email =
        readString(req.query.userEmail) || compatResolveUserEmail(req);
      const history = await buildCompatPaymentHistory(
        userId || "guest",
        email,
      );
      await writeCompatPaymentHistory(userId || "guest", history);
      res.json({
        history: await decorateCompatPaymentHistoryWithRefundRequests(
          history,
          userId || "guest",
          email,
        ),
      });
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Could not fetch payment history" });
    }
  });

  app.get("/api/payments/receipt/:paymentId", async (req, res) => {
    try {
      const paymentId = compatHeaderString(req.params.paymentId);
      if (!paymentId) {
        return res.status(400).json({ error: "paymentId is required" });
      }

      const record = await findCompatPaymentStatusRecord(paymentId);
      if (!record) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      if (!canAccessCompatPaymentDocument(req, record)) {
        return res
          .status(403)
          .json({ error: "Du har ikke tilgang til denne kvitteringen" });
      }

      const history = await decorateCompatPaymentHistoryWithRefundRequests(
        await buildCompatPaymentHistory(record.userId, record.email),
        record.userId,
        record.email,
      );
      const historyEntry =
        history.find(
          (entry: any) =>
            entry.id === record.id ||
            entry.transactionId === record.transactionId,
        ) || null;

      res.type("html").send(
        buildCompatPaymentDocumentHtml({
          title: "Kvittering",
          subtitle:
            "Dokumentasjon for gjennomført kjøp og aktivt abonnement.",
          record,
          historyEntry,
          accountingReady: Boolean(historyEntry?.isInFiken),
        }),
      );
    } catch (error) {
      console.error("Error generating payment receipt document:", error);
      res.status(500).json({ error: "Could not generate receipt" });
    }
  });

  app.get("/api/payments/invoice/:paymentId", async (req, res) => {
    try {
      const paymentId = compatHeaderString(req.params.paymentId);
      if (!paymentId) {
        return res.status(400).json({ error: "paymentId is required" });
      }

      const record = await findCompatPaymentStatusRecord(paymentId);
      if (!record) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (!canAccessCompatPaymentDocument(req, record)) {
        return res
          .status(403)
          .json({ error: "Du har ikke tilgang til dette dokumentet" });
      }

      const history = await decorateCompatPaymentHistoryWithRefundRequests(
        await buildCompatPaymentHistory(record.userId, record.email),
        record.userId,
        record.email,
      );
      const historyEntry =
        history.find(
          (entry: any) =>
            entry.id === record.id ||
            entry.transactionId === record.transactionId,
        ) || null;

      if (!historyEntry?.isInFiken) {
        return res.status(404).json({
          error:
            "Regnskapsgrunnlag blir tilgjengelig når kjøpet er bokført i Fiken eller Tripletex",
        });
      }

      res.type("html").send(
        buildCompatPaymentDocumentHtml({
          title: "Regnskapsgrunnlag",
          subtitle:
            "Dokumentasjon for kjøp som er klargjort for regnskapsintegrasjon.",
          record,
          historyEntry,
          accountingReady: true,
        }),
      );
    } catch (error) {
      console.error("Error generating payment accounting document:", error);
      res
        .status(500)
        .json({ error: "Could not generate accounting document" });
    }
  });

  app.post("/api/payments/create-payment-intent", async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const email =
        compatHeaderString(body.email ?? body.userEmail ?? body.user_email) ||
        compatResolveUserEmail(req);
      const requestId =
        compatHeaderString(body.requestId ?? body.request_id) || null;
      const userId = resolveCompatPaymentUserScope(
        compatHeaderString(body.userId ?? body.user_id) ||
          compatResolveUserId(req),
        requestId,
        email,
      );
      const planId = normalizeBillingPlanId(body.planId ?? body.plan_id);
      const plan = getCompatPlatformSubscriptionPlan(planId);
      const planName =
        plan?.displayName ||
        readString(body.planName) ||
        readString(body.plan_name) ||
        "CreatorHub Plan";
      const paymentMethod = normalizeCompatPaymentMethod(
        body.paymentMethod ?? body.payment_method,
      );
      const amountMinor = normalizeCompatAmountMinor(body.amount, plan);
      const amountMajor = Number((amountMinor / 100).toFixed(2));
      const createdAt = new Date().toISOString();
      const paymentId = `pay_${crypto.randomUUID()}`;
      const transactionId = `txn_${crypto.randomUUID()}`;

      const record: any = {
        id: paymentId,
        transactionId,
        userId,
        email,
        requestId,
        planId: plan?.id || planId,
        planName,
        amountMinor,
        amountMajor,
        currency: readString(body.currency) || plan?.currency || "NOK",
        paymentMethod,
        status: "completed",
        createdAt,
        completedAt: createdAt,
        provider: "compat",
        metadata: {
          profession: readString(body.profession),
          requestId,
        },
        receiptSentAt: null,
        membershipCard: null,
      };

      await recordCompatPaymentCompletion(record);

      res.status(201).json({
        success: true,
        id: record.id,
        paymentId: record.id,
        transactionId: record.transactionId,
        status: record.status,
        amount: record.amountMinor,
        currency: record.currency,
        paymentMethod: record.paymentMethod,
        planId: record.planId,
        planName: record.planName,
        clientSecret: `compat_${record.id}`,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Could not create payment intent" });
    }
  });

  app.post("/api/google-pay/process-payment", async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const paymentIntent = isRecord(body.paymentIntent)
        ? body.paymentIntent
        : {};
      const paymentData = isRecord(body.paymentData) ? body.paymentData : {};
      const metadata = isRecord(paymentIntent.metadata)
        ? paymentIntent.metadata
        : {};
      const paymentMethodData = isRecord(paymentData.paymentMethodData)
        ? paymentData.paymentMethodData
        : {};
      const paymentMethodInfo = isRecord(paymentMethodData.info)
        ? paymentMethodData.info
        : {};
      const planId = normalizeBillingPlanId(
        metadata.planId ?? body.planId,
      );
      const plan = getCompatPlatformSubscriptionPlan(planId);
      const createdAt = new Date().toISOString();
      const paymentId = `pay_${crypto.randomUUID()}`;
      const transactionId = `txn_${crypto.randomUUID()}`;
      const email =
        compatHeaderString(paymentData.email ?? body.email) ||
        compatResolveUserEmail(req);
      const amountMinor = normalizeCompatAmountMinor(
        paymentIntent.amount,
        plan,
      );
      const amountMajor = Number((amountMinor / 100).toFixed(2));
      const requestId =
        compatHeaderString(
          metadata.requestId ?? body.requestId ?? body.request_id,
        ) || null;
      const userId = resolveCompatPaymentUserScope(
        compatHeaderString(
          paymentIntent.userId ?? body.userId ?? body.user_id,
        ) || compatResolveUserId(req),
        requestId,
        email,
      );

      const record: any = {
        id: paymentId,
        transactionId,
        userId,
        email,
        requestId,
        planId: plan?.id || planId,
        planName:
          plan?.displayName ||
          readString(paymentIntent.productName) ||
          readString(body.planName) ||
          "CreatorHub Plan",
        amountMinor,
        amountMajor,
        currency:
          readString(paymentIntent.currency) ||
          readString(body.currency) ||
          plan?.currency ||
          "NOK",
        paymentMethod: "google-pay",
        status: "completed",
        createdAt,
        completedAt: createdAt,
        provider: "google-pay",
        metadata: {
          requestId,
          profession: readString(metadata.profession),
          recurring: metadata.recurring === true,
          cardNetwork: readString(paymentMethodInfo.cardNetwork),
        },
        receiptSentAt: null,
        membershipCard: null,
      };

      await recordCompatPaymentCompletion(record);

      res.status(201).json({
        success: true,
        paymentId: record.id,
        transactionId: record.transactionId,
        status: record.status,
        paymentData: {
          amount: record.amountMinor,
          currency: record.currency,
          paymentMethod: record.paymentMethod,
        },
      });
    } catch (error) {
      console.error("Error processing Google Pay payment:", error);
      res
        .status(500)
        .json({ error: "Could not process Google Pay payment" });
    }
  });

  app.get("/api/payments/status/user/:userId", async (req, res) => {
    try {
      const userId =
        compatHeaderString(req.params.userId) || compatResolveUserId(req);
      const record = await readCompatLatestPaymentStatusRecord(userId);
      if (!record) {
        return res.status(404).json({ error: "Payment status not found" });
      }
      res.json(buildCompatPaymentStatusResponse(record));
    } catch (error) {
      console.error("Error fetching user payment status:", error);
      res.status(500).json({ error: "Could not fetch payment status" });
    }
  });

  app.get("/api/payments/status/:paymentId", async (req, res) => {
    try {
      const paymentId = compatHeaderString(req.params.paymentId);
      if (!paymentId) {
        return res.status(400).json({ error: "paymentId is required" });
      }

      const record = await findCompatPaymentStatusRecord(paymentId);
      if (!record) {
        return res.status(404).json({ error: "Payment status not found" });
      }

      res.json(buildCompatPaymentStatusResponse(record));
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ error: "Could not fetch payment status" });
    }
  });

  app.post("/api/payments/send-receipt", async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const identifier =
        compatHeaderString(
          body.transactionId ?? body.paymentId ?? body.payment_id,
        ) || null;
      const fallbackUserId =
        compatHeaderString(body.userId ?? body.user_id) ||
        compatResolveUserId(req);
      const fallbackEmail =
        compatHeaderString(body.email ?? body.userEmail ?? body.user_email) ||
        compatResolveUserEmail(req);
      const record = identifier
        ? await findCompatPaymentStatusRecord(identifier)
        : await readCompatLatestPaymentStatusRecord(fallbackUserId);

      if (record) {
        const nextRecord: any = {
          ...record,
          receiptSentAt: new Date().toISOString(),
        };
        await writeCompatPaymentStatusRecord(nextRecord);
        return res.status(201).json({
          success: true,
          delivered: false,
          provider: "compat",
          transactionId: nextRecord.transactionId,
          email: nextRecord.email || fallbackEmail,
          queuedAt: nextRecord.receiptSentAt,
        });
      }

      res.status(202).json({
        success: true,
        delivered: false,
        provider: "compat",
        transactionId: identifier,
        email: fallbackEmail,
        queuedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error queueing payment receipt:", error);
      res.status(500).json({ error: "Could not queue payment receipt" });
    }
  });

  app.post("/api/payments/fiken-register", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      const body = isRecord(req.body) ? req.body : {};
      const referenceId =
        readString(body.referenceId) || readString(body.transactionId);
      if (!referenceId) {
        return res.status(400).json({ error: "referenceId is required" });
      }

      const history = await buildCompatPaymentHistory(
        userId,
        compatResolveUserEmail(req),
      );
      const nextHistory = history.map((entry: any) =>
        entry.id === referenceId || entry.transactionId === referenceId
          ? { ...entry, isInFiken: true }
          : entry,
      );
      await writeCompatPaymentHistory(userId, nextHistory);

      const updatedItem =
        nextHistory.find(
          (entry: any) =>
            entry.id === referenceId ||
            entry.transactionId === referenceId,
        ) || null;
      if (!updatedItem) {
        return res
          .status(404)
          .json({ error: "Payment history item not found" });
      }

      const mvaStatus: any = {
        registered: true,
        lastCheckedAt: new Date().toISOString(),
        lastRegisteredPaymentId: updatedItem.id,
      };
      await writeCompatFikenMvaStatus(userId, mvaStatus);

      res.json({ success: true, item: updatedItem, mvaStatus });
    } catch (error) {
      console.error("Error registering payment in Fiken:", error);
      res.status(500).json({ error: "Could not register payment in Fiken" });
    }
  });

  app.get("/api/payments/fiken-mva-status", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) || compatResolveUserId(req);
      const status = await readCompatFikenMvaStatus(userId || "guest");
      res.json(status);
    } catch (error) {
      console.error("Error fetching Fiken MVA status:", error);
      res.status(500).json({ error: "Could not fetch Fiken MVA status" });
    }
  });
}
