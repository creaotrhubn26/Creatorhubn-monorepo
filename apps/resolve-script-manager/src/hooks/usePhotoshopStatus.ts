/**
 * usePhotoshopStatus — abonner på Photoshop-broens live tilstand.
 * Returnerer både bridge-connection-status (er UXP-plugin koblet til?)
 * og aktiv document i Photoshop (oppdatert i sanntid via
 * photoshop://event når brukeren bytter / åpner / lukker doc).
 */

import { useEffect, useState } from "react";
import {
  getStatus,
  onEvent,
  onStatus,
  type DocumentSummary,
  type PhotoshopBridgeStatus,
} from "../services/photoshopBridgeService";

interface PhotoshopActionPayload {
  event?: string;
  active_document?: DocumentSummary | null;
}

export interface UsePhotoshopStatusResult {
  status: PhotoshopBridgeStatus | null;
  activeDoc: DocumentSummary | null;
  /** Tidspunkt for siste mottatte event (epoch ms) — null før noe har kommet. */
  lastEventAt: number | null;
}

export function usePhotoshopStatus(): UsePhotoshopStatusResult {
  const [status, setStatus] = useState<PhotoshopBridgeStatus | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocumentSummary | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    // Initial fetch + sub
    getStatus()
      .then((s) => {
        if (mounted) setStatus(s);
      })
      .catch(() => {});

    const offStatus = onStatus((s) => {
      if (!mounted) return;
      setStatus(s);
      // Hvis vi mister tilkoblingen, nullstill active doc — vi vet ikke
      // hva Photoshop holder på lenger.
      if (!s.connected) setActiveDoc(null);
    });

    const offEvent = onEvent((evt) => {
      if (!mounted) return;
      if (evt.event === "photoshop.action") {
        const data = (evt.data ?? {}) as PhotoshopActionPayload;
        if (data.active_document !== undefined) {
          setActiveDoc(data.active_document ?? null);
        }
        setLastEventAt(Date.now());
      }
    });

    return () => {
      mounted = false;
      offStatus.then((fn) => fn());
      offEvent.then((fn) => fn());
    };
  }, []);

  return { status, activeDoc, lastEventAt };
}
