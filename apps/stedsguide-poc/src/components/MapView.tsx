import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Attraction, LatLng } from '../data/types';
import { localizedName } from '../data/attractions';
import { formatDistance } from '../lib/geo';
import { useAppState } from '../state/prefs';

interface Props {
  position: LatLng;
  attractions: { attraction: Attraction; distanceM: number }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** divIcon-markører rendres som <div role="button"> uten navn – sett navnet selv. */
function labelMarker(m: L.Marker, label: string, title: string) {
  const el = m.getElement();
  if (!el) return;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', label);
  el.setAttribute('title', title);
  el.removeAttribute('alt');
}

/**
 * Leaflet-kart med OpenStreetMap-fliser. Kartet er et supplement:
 * alt innholdet finnes også i liste-form (Liste-fanen), og markørene
 * er tastaturnavigerbare med beskrivende alt-tekst.
 */
export function MapView({ position, attractions, selectedId, onSelect }: Props) {
  const { t, prefs, locale } = useAppState();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [position.lat, position.lng],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
      keyboard: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userRef.current = null;
    };
    // Kartet opprettes én gang; posisjon oppdateres i egen effekt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brukerposisjon
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const icon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    if (!userRef.current) {
      userRef.current = L.marker([position.lat, position.lng], { icon, alt: t('youAreHere'), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(map);
      userRef.current.bindTooltip(t('youAreHere'));
    } else {
      userRef.current.setLatLng([position.lat, position.lng]);
      userRef.current.setTooltipContent(t('youAreHere'));
    }
    const el = userRef.current.getElement();
    if (el) {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', t('youAreHere'));
      el.removeAttribute('alt');
    }
  }, [position, t]);

  // Severdigheter
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const { attraction, distanceM } of attractions) {
      seen.add(attraction.id);
      const name = localizedName(attraction, prefs.lang);
      const label = t('mapMarker', { name, distance: formatDistance(distanceM, locale) });
      const selected = attraction.id === selectedId;
      const icon = L.divIcon({
        className: '',
        html: `<div class="poi-pin${selected ? ' poi-pin--selected' : ''}"><span class="poi-pin__dot"></span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        tooltipAnchor: [0, -30],
      });
      let m = markersRef.current.get(attraction.id);
      if (!m) {
        m = L.marker([attraction.position.lat, attraction.position.lng], { icon, alt: label, title: name, keyboard: true }).addTo(map);
        m.bindTooltip(name);
        m.on('click', () => onSelect(attraction.id));
        m.on('keypress', (e) => {
          const key = (e as unknown as { originalEvent: KeyboardEvent }).originalEvent.key;
          if (key === 'Enter' || key === ' ') onSelect(attraction.id);
        });
        markersRef.current.set(attraction.id, m);
      } else {
        m.setIcon(icon);
        m.setTooltipContent(name);
      }
      labelMarker(m, label, name);
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
    // Første gang: vis bruker + nærmeste severdighet i samme utsnitt.
    if (!didFitRef.current && attractions.length) {
      didFitRef.current = true;
      const nearest = attractions[0].attraction.position;
      map.fitBounds(
        L.latLngBounds([position.lat, position.lng], [nearest.lat, nearest.lng]).pad(0.4),
        { maxZoom: 15, animate: !prefs.reduceMotion },
      );
    }
  }, [attractions, selectedId, onSelect, prefs.lang, prefs.reduceMotion, locale, position, t]);

  // Sentrer på valgt severdighet
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const m = markersRef.current.get(selectedId);
    if (m) map.panTo(m.getLatLng(), { animate: !prefs.reduceMotion });
  }, [selectedId, prefs.reduceMotion]);

  // Demo-posisjon flytter langt (f.eks. Oslo → Bergen): følg med.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getBounds().pad(-0.2).contains([position.lat, position.lng])) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 13), { animate: !prefs.reduceMotion });
    }
  }, [position, prefs.reduceMotion]);

  return <div ref={containerRef} className="map" role="region" aria-label={t('mapLabel')} />;
}
