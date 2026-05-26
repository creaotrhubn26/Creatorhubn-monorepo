import express from "express";
import { readBoolean, readString } from "./_shared";

export interface GoogleWalletRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  buildCompatWalletOrganizations: () => unknown;
  compatHeaderString: (value: unknown) => string | null;
  compatResolveUserId: (req: express.Request) => string;
  readCompatMembershipCards: (userId: string) => Promise<any[]>;
  writeCompatMembershipCards: (userId: string, cards: any[]) => Promise<void>;
  isRecord: (value: unknown) => value is Record<string, unknown>;
  readCompatPaymentStatusRecord: (paymentId: string) => Promise<any>;
  findCompatPaymentStatusRecord: (transactionId: string) => Promise<any>;
  createCompatMembershipCard: (input: any) => Promise<any>;
  findCompatMembershipCardById: (cardId: string) => Promise<any>;
  writeCompatPaymentStatusRecord: (record: any) => Promise<void>;
  buildCompatPaymentStatusCardSummary: (card: any) => any;
  normalizeBillingPlanId: (value: unknown) => string | null;
}

export function setupGoogleWalletRoutes(deps: GoogleWalletRoutesDeps): void {
  const {
    app,
    requireUserSession,
    buildCompatWalletOrganizations,
    compatHeaderString,
    compatResolveUserId,
    readCompatMembershipCards,
    writeCompatMembershipCards,
    isRecord,
    readCompatPaymentStatusRecord,
    findCompatPaymentStatusRecord,
    createCompatMembershipCard,
    findCompatMembershipCardById,
    writeCompatPaymentStatusRecord,
    buildCompatPaymentStatusCardSummary,
    normalizeBillingPlanId,
  } = deps;

  app.get("/api/google-wallet/organizations", async (_req, res) => {
    res.json(buildCompatWalletOrganizations());
  });

  app.get(
    "/api/google-wallet/membership-cards/:userId",
    async (req, res) => {
      try {
        const userId =
          compatHeaderString(req.params.userId) || compatResolveUserId(req);
        const cards = await readCompatMembershipCards(userId);
        res.json(cards);
      } catch (error) {
        console.error("Error fetching membership cards:", error);
        res.status(500).json({ error: "Could not fetch membership cards" });
      }
    },
  );

  app.post(
    "/api/google-wallet/create-membership-card",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const body = isRecord(req.body) ? req.body : {};
        const paymentId =
          compatHeaderString(body.paymentId ?? body.payment_id) || null;
        const transactionId =
          compatHeaderString(body.transactionId ?? body.transaction_id) ||
          null;
        const paymentRecord =
          (paymentId && (await readCompatPaymentStatusRecord(paymentId))) ||
          (transactionId &&
            (await findCompatPaymentStatusRecord(transactionId))) ||
          null;
        const userId =
          compatHeaderString(body.userId ?? body.user_id) ||
          paymentRecord?.userId ||
          compatResolveUserId(req);

        const card = await createCompatMembershipCard({
          userId,
          paymentId: paymentRecord?.id || paymentId,
          transactionId:
            paymentRecord?.transactionId || transactionId,
          planName:
            readString(body.planName) ||
            paymentRecord?.planName ||
            "CreatorHub Plan",
          planId:
            normalizeBillingPlanId(body.planId ?? body.plan_id) ||
            paymentRecord?.planId ||
            null,
          organizationName: readString(body.organizationName),
          memberSince:
            readString(body.memberSince) || paymentRecord?.completedAt,
          membershipType: readString(body.membershipType),
          benefits: Array.isArray(body.benefits)
            ? body.benefits
                .map((entry: unknown) => readString(entry))
                .filter((entry: string | null): entry is string =>
                  Boolean(entry),
                )
            : undefined,
          renewalDate: readString(body.renewalDate),
          autoRenew: readBoolean(body.autoRenew) ?? undefined,
          tier: (readString(body.tier) as any) || undefined,
        });

        res.status(201).json(card);
      } catch (error) {
        console.error("Error creating membership card:", error);
        res.status(500).json({ error: "Could not create membership card" });
      }
    },
  );

  app.put(
    "/api/google-wallet/membership-cards/:id",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const cardId = compatHeaderString(req.params.id);
        if (!cardId) {
          return res.status(400).json({ error: "Card id is required" });
        }

        const body = isRecord(req.body) ? req.body : {};
        const existing = await findCompatMembershipCardById(cardId);
        if (!existing) {
          return res
            .status(404)
            .json({ error: "Membership card not found" });
        }

        const cards = await readCompatMembershipCards(existing.userId);
        const nextCards = cards.map((card: any) =>
          card.id !== cardId
            ? card
            : {
                ...card,
                organizationName:
                  readString(body.organizationName) || card.organizationName,
                membershipType:
                  readString(body.membershipType) || card.membershipType,
                memberNumber:
                  readString(body.memberNumber) || card.memberNumber,
                memberSince:
                  readString(body.memberSince) || card.memberSince,
                benefits: Array.isArray(body.benefits)
                  ? body.benefits
                      .map((entry: unknown) => readString(entry))
                      .filter((entry: string | null): entry is string =>
                        Boolean(entry),
                      )
                  : card.benefits,
                renewalDate:
                  readString(body.renewalDate) ?? card.renewalDate ?? null,
                autoRenew: readBoolean(body.autoRenew) ?? card.autoRenew,
                tier: (readString(body.tier) as any) || card.tier,
                isActive: readBoolean(body.isActive) ?? card.isActive,
                status: (readString(body.status) as any) || card.status,
              },
        );

        await writeCompatMembershipCards(existing.userId, nextCards);
        const updated =
          nextCards.find((card: any) => card.id === cardId) || existing;

        if (updated.paymentId) {
          const paymentRecord = await readCompatPaymentStatusRecord(
            updated.paymentId,
          );
          if (paymentRecord) {
            await writeCompatPaymentStatusRecord({
              ...paymentRecord,
              membershipCard: buildCompatPaymentStatusCardSummary(updated),
            });
          }
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating membership card:", error);
        res.status(500).json({ error: "Could not update membership card" });
      }
    },
  );

  app.delete(
    "/api/google-wallet/membership-cards/:id",
    async (req, res) => {
      if (!requireUserSession(req, res)) return;
      try {
        const cardId = compatHeaderString(req.params.id);
        if (!cardId) {
          return res.status(400).json({ error: "Card id is required" });
        }

        const existing = await findCompatMembershipCardById(cardId);
        if (!existing) {
          return res
            .status(404)
            .json({ error: "Membership card not found" });
        }

        const cards = await readCompatMembershipCards(existing.userId);
        const nextCards = cards.filter((card: any) => card.id !== cardId);
        await writeCompatMembershipCards(existing.userId, nextCards);

        if (existing.paymentId) {
          const paymentRecord = await readCompatPaymentStatusRecord(
            existing.paymentId,
          );
          if (paymentRecord) {
            await writeCompatPaymentStatusRecord({
              ...paymentRecord,
              membershipCard: null,
            });
          }
        }

        res.json({ success: true, id: cardId });
      } catch (error) {
        console.error("Error deleting membership card:", error);
        res.status(500).json({ error: "Could not delete membership card" });
      }
    },
  );

  app.post("/api/google-wallet/send-to-wallet/:id", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const cardId = compatHeaderString(req.params.id);
      if (!cardId) {
        return res.status(400).json({ error: "Card id is required" });
      }

      const existing = await findCompatMembershipCardById(cardId);
      if (!existing) {
        return res.status(404).json({ error: "Membership card not found" });
      }

      const walletUrl =
        existing.walletUrl ||
        `https://creatorhubn.com/membership-card/${cardId}`;
      const cards = await readCompatMembershipCards(existing.userId);
      const nextCards = cards.map((card: any) =>
        card.id === cardId ? { ...card, walletUrl } : card,
      );
      await writeCompatMembershipCards(existing.userId, nextCards);
      const updated =
        nextCards.find((card: any) => card.id === cardId) || existing;

      if (updated.paymentId) {
        const paymentRecord = await readCompatPaymentStatusRecord(
          updated.paymentId,
        );
        if (paymentRecord) {
          await writeCompatPaymentStatusRecord({
            ...paymentRecord,
            membershipCard: buildCompatPaymentStatusCardSummary(updated),
          });
        }
      }

      res.status(201).json({
        success: true,
        id: updated.id,
        walletUrl,
      });
    } catch (error) {
      console.error("Error sending membership card to wallet:", error);
      res
        .status(500)
        .json({ error: "Could not send membership card to wallet" });
    }
  });
}
