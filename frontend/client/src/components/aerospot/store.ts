/**
 * aerospot/store.ts — global AeroSpot-state (zustand).
 * Kun UI-/sesjonsstate her; server-data hentes via react-query i hooks.ts.
 */

import { create } from "zustand";
import type { LatLng, PhotographyMode } from "./types";

export type AeroTab = "home" | "live" | "camera" | "logbook" | "profile";

interface AeroSpotState {
  tab: AeroTab;
  setTab: (tab: AeroTab) => void;

  userPosition: LatLng | null;
  locationPermission: "unknown" | "granted" | "denied";
  requestLocation: () => void;

  selectedFlightId: string | null;
  selectFlight: (id: string | null) => void;

  selectedLocationId: string | null;
  selectLocation: (id: string | null) => void;

  photographyMode: PhotographyMode;
  setPhotographyMode: (mode: PhotographyMode) => void;

  followedFlightIds: string[];
  toggleFollow: (id: string) => void;

  cameraIp: string;
  setCameraIp: (ip: string) => void;
}

export const useAeroStore = create<AeroSpotState>((set, get) => ({
  tab: "home",
  setTab: (tab) => set({ tab }),

  userPosition: null,
  locationPermission: "unknown",
  requestLocation: () => {
    if (!("geolocation" in navigator)) {
      set({ locationPermission: "denied" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        set({
          userPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          locationPermission: "granted",
        }),
      () => set({ locationPermission: "denied" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  },

  selectedFlightId: null,
  selectFlight: (id) => set({ selectedFlightId: id }),

  selectedLocationId: null,
  selectLocation: (id) => set({ selectedLocationId: id }),

  photographyMode: "freeze",
  setPhotographyMode: (mode) => set({ photographyMode: mode }),

  followedFlightIds: [],
  toggleFollow: (id) => {
    const current = get().followedFlightIds;
    set({
      followedFlightIds: current.includes(id)
        ? current.filter((f) => f !== id)
        : [...current, id],
    });
  },

  cameraIp: typeof window !== "undefined" ? window.localStorage.getItem("aerospot-camera-ip") ?? "" : "",
  setCameraIp: (ip) => {
    try {
      window.localStorage.setItem("aerospot-camera-ip", ip);
    } catch {
      // best effort
    }
    set({ cameraIp: ip });
  },
}));
