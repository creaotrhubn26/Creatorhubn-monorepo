import express from "express";
import crypto from "crypto";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../migrations/schema.js";

export interface MarketplaceRoutesDeps {
  app: express.Application;
  db: NodePgDatabase<typeof schema>;
}

export function setupMarketplaceRoutes(deps: MarketplaceRoutesDeps): void {
  const { app, db } = deps;

  app.get("/api/marketplace/stats", async (_req, res) => {
    try {
      const [downloadCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.vendorProductDownloads);

      const [reviewStats] = await db
        .select({
          avgRating: sql<number>`avg(${schema.vendorProductReviews.rating})`,
          reviewCount: sql<number>`count(*)`,
        })
        .from(schema.vendorProductReviews);

      const reviewProductIds = await db
        .select({ productId: schema.vendorProductReviews.productId })
        .from(schema.vendorProductReviews)
        .groupBy(schema.vendorProductReviews.productId);

      const downloadProductIds = await db
        .select({ productId: schema.vendorProductDownloads.productId })
        .from(schema.vendorProductDownloads)
        .groupBy(schema.vendorProductDownloads.productId);

      const reviewUserIds = await db
        .select({ userId: schema.vendorProductReviews.userId })
        .from(schema.vendorProductReviews)
        .groupBy(schema.vendorProductReviews.userId);

      const downloadUserIds = await db
        .select({ userId: schema.vendorProductDownloads.userId })
        .from(schema.vendorProductDownloads)
        .where(isNotNull(schema.vendorProductDownloads.userId))
        .groupBy(schema.vendorProductDownloads.userId);

      const uniqueProductIds = new Set([
        ...reviewProductIds.map((row) => row.productId),
        ...downloadProductIds.map((row) => row.productId),
      ]);

      const uniqueUserIds = new Set([
        ...reviewUserIds.map((row) => row.userId),
        ...downloadUserIds.map((row) => row.userId),
      ]);

      res.json({
        totalApps: uniqueProductIds.size,
        totalDownloads: Number(downloadCountResult?.count || 0),
        averageRating: Number(reviewStats?.avgRating || 0),
        totalReviews: Number(reviewStats?.reviewCount || 0),
        activeUsers: uniqueUserIds.size,
      });
    } catch (error) {
      console.error("Marketplace stats error:", error);
      res.status(500).json({ error: "Failed to load marketplace stats" });
    }
  });

  app.get("/api/marketplace/apps/:appId/reviews", async (req, res) => {
    const { appId } = req.params;

    try {
      const reviews = await db
        .select()
        .from(schema.vendorProductReviews)
        .where(eq(schema.vendorProductReviews.productId, appId))
        .orderBy(desc(schema.vendorProductReviews.createdAt))
        .limit(200);

      const reviewCount = reviews.length;
      const avgRating = reviewCount
        ? reviews.reduce(
            (sum, review) => sum + (review.rating || 0),
            0,
          ) / reviewCount
        : 0;

      res.json({
        reviews,
        summary: {
          avgRating: Number(avgRating.toFixed(2)),
          reviewCount,
        },
      });
    } catch (error) {
      console.error("Marketplace reviews fetch error:", error);
      res.status(500).json({ error: "Failed to load reviews" });
    }
  });

  app.post("/api/marketplace/apps/:appId/reviews", async (req, res) => {
    const { appId } = req.params;
    const { userId, userName, rating, title, comment } = req.body || {};

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res
        .status(400)
        .json({ error: "Rating must be between 1 and 5" });
    }

    const trimmedTitle =
      typeof title === "string" ? title.trim().slice(0, 120) : null;
    const trimmedComment =
      typeof comment === "string" ? comment.trim().slice(0, 2000) : null;

    try {
      const [createdReview] = await db
        .insert(schema.vendorProductReviews)
        .values({
          id: crypto.randomUUID(),
          productId: appId,
          userId: userId || "anonymous",
          userName: userName || "Anonymous",
          rating: Math.round(numericRating),
          title: trimmedTitle || null,
          comment: trimmedComment || null,
          verified: false,
        })
        .returning();

      res.status(201).json({ review: createdReview });
    } catch (error) {
      console.error("Marketplace review create error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });
}
