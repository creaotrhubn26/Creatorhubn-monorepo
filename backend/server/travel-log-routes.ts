import express from "express";
import type { Pool } from "pg";

export interface TravelLogRoutesDeps {
  app: express.Application;
  pool: Pool;
  getPricingUserId: (req: any) => string | null;
}

export function setupTravelLogRoutes(deps: TravelLogRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  app.get("/api/travel-log", async (req, res) => {
    try {
      const userId = getPricingUserId(req);
      let result;
      if (userId) {
        result = await pool.query(
          "SELECT * FROM travel_logs WHERE user_id = $1 ORDER BY date DESC",
          [userId],
        );
      } else {
        result = await pool.query(
          "SELECT * FROM travel_logs ORDER BY date DESC LIMIT 100",
        );
      }
      res.json(
        result.rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          date: r.date,
          description: r.description,
          contact: r.contact,
          vehicle: r.vehicle,
          vehicleRegistration: r.vehicle_registration,
          fromAddress: r.from_address,
          toAddress: r.to_address,
          extraDestinations: r.extra_destinations,
          returnTrip: r.return_trip,
          kilometers: parseFloat(r.kilometers || "0"),
          tollFees: parseFloat(r.toll_fees || "0"),
          additionalFees: parseFloat(r.additional_fees || "0"),
          additionalFeesDescription: r.additional_fees_description,
          calculatedCost: parseFloat(r.calculated_cost || "0"),
          selectedVehicleData: r.selected_vehicle_data,
          projectId: r.project_id,
          createdAt: r.created_at,
        })),
      );
    } catch (error) {
      console.error("Error fetching travel logs:", error);
      res.status(500).json({ error: "Kunne ikke hente kjørebok" });
    }
  });

  app.post("/api/travel-log", async (req, res) => {
    try {
      const {
        userId,
        date,
        description,
        contact,
        vehicle,
        vehicleRegistration,
        fromAddress,
        toAddress,
        extraDestinations,
        returnTrip,
        kilometers,
        tollFees,
        additionalFees,
        additionalFeesDescription,
        calculatedCost,
        selectedVehicleData,
        projectId,
      } = req.body;
      const uid = userId || getPricingUserId(req);
      const result = await pool.query(
        `INSERT INTO travel_logs (user_id, date, description, contact, vehicle, vehicle_registration, from_address, to_address, extra_destinations, return_trip, kilometers, toll_fees, additional_fees, additional_fees_description, calculated_cost, selected_vehicle_data, project_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,NOW(),NOW()) RETURNING *`,
        [
          uid,
          date || new Date().toISOString().split("T")[0],
          description || "",
          contact || "",
          vehicle || "",
          vehicleRegistration || "",
          fromAddress || "",
          toAddress || "",
          JSON.stringify(extraDestinations || []),
          returnTrip || false,
          kilometers || 0,
          tollFees || 0,
          additionalFees || 0,
          additionalFeesDescription || "",
          calculatedCost || 0,
          JSON.stringify(selectedVehicleData || null),
          projectId || null,
        ],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating travel log:", error);
      res.status(500).json({ error: "Kunne ikke lagre kjøretur" });
    }
  });

  app.delete("/api/travel-log/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM travel_logs WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Kjøretur ikke funnet" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke slette kjøretur" });
    }
  });
}
