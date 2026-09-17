import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ATTRACTIONS, attractionById } from './data/attractions';
import { usePosition } from './hooks/usePosition';
import { sortByDistance } from './lib/geo';
import { useAppState } from './state/prefs';
import { AttractionDetail } from './components/AttractionDetail';
import { GuidePlayer } from './components/GuidePlayer';
import { IconHeart, IconList, IconMap } from './components/Icons';
import { ListScreen } from './components/ListScreen';
import { MapView } from './components/MapView';
import { NearbySheet } from './components/NearbySheet';
import { SavedScreen } from './components/SavedScreen';
import { SettingsDialog } from './components/SettingsDialog';
import { TopBar } from './components/TopBar';

type Tab = 'map' | 'list' | 'saved';
type View = { kind: 'tab'; tab: Tab } | { kind: 'detail'; id: string } | { kind: 'player'; id: string };

export default function App() {
  const { t, demoPosition, prefs } = useAppState();
  const { position, status } = usePosition(demoPosition);
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'map' });
  const [tab, setTab] = useState<Tab>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const sorted = useMemo(() => sortByDistance(ATTRACTIONS, position), [position]);
  const distanceFor = useCallback((id: string) => sorted.find((x) => x.attraction.id === id)?.distanceM ?? Number.NaN, [sorted]);

  // Flytt fokus til ny skjerms overskrift ved navigasjon (WCAG 2.4.3).
  const viewKey = view.kind === 'tab' ? `tab:${view.tab}` : `${view.kind}:${view.id}`;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.scrollTo({ top: 0 });
    const el = headingRef.current;
    if (el) el.focus({ preventScroll: false });
    else mainRef.current?.focus();
  }, [viewKey]);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setView({ kind: 'detail', id });
  }, []);
  const goTab = useCallback((next: Tab) => {
    setTab(next);
    setView({ kind: 'tab', tab: next });
  }, []);

  const statusChip =
    status === 'demo' ? { cls: 'chip--warn', text: t('demoPositionActive') }
    : status === 'locating' ? { cls: 'chip--accent', text: t('locating') }
    : status === 'denied' ? { cls: 'chip--warn', text: t('locationDenied') }
    : status === 'unavailable' ? { cls: 'chip--warn', text: t('locationUnavailable') }
    : null;

  let content: JSX.Element;
  if (view.kind === 'player') {
    const a = attractionById(view.id);
    content = a ? <GuidePlayer attraction={a} onBack={() => setView({ kind: 'detail', id: view.id })} headingRef={headingRef} /> : <></>;
  } else if (view.kind === 'detail') {
    const a = attractionById(view.id);
    content = a ? (
      <AttractionDetail
        attraction={a}
        distanceM={distanceFor(a.id)}
        onBack={() => setView({ kind: 'tab', tab })}
        onStart={() => setView({ kind: 'player', id: a.id })}
        headingRef={headingRef}
      />
    ) : <></>;
  } else if (view.tab === 'list') {
    content = <ListScreen sorted={sorted} onOpen={openDetail} headingRef={headingRef} />;
  } else if (view.tab === 'saved') {
    content = <SavedScreen sorted={sorted} onOpen={openDetail} headingRef={headingRef} />;
  } else {
    content = (
      <div className="map-screen">
        <h1 ref={headingRef} tabIndex={-1} className="visually-hidden">{t('tabMap')}</h1>
        <div className="map-wrap">
          <MapView position={position} attractions={sorted} selectedId={selectedId} onSelect={setSelectedId} />
          {statusChip && (
            <div className="map-status">
              <span className={`chip ${statusChip.cls}`} role="status">{statusChip.text}</span>
            </div>
          )}
        </div>
        <NearbySheet sorted={sorted} selectedId={selectedId} onOpen={openDetail} />
      </div>
    );
  }

  const showChrome = view.kind !== 'player';
  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'map', label: t('tabMap'), icon: <IconMap /> },
    { id: 'list', label: t('tabList'), icon: <IconList /> },
    { id: 'saved', label: t('tabSaved'), icon: <IconHeart /> },
  ];

  return (
    <div className="app" data-lang={prefs.lang}>
      <a href="#main" className="skip-link">{t('skipToContent')}</a>
      {showChrome ? <TopBar onOpenSettings={() => setSettingsOpen(true)} /> : <div />}
      <main id="main" ref={mainRef} className="main" tabIndex={-1}>
        {content}
      </main>
      {showChrome ? (
        <nav className="tabbar" aria-label={t('appName')}>
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              className="tabbar__tab"
              aria-current={view.kind === 'tab' && view.tab === x.id ? 'page' : undefined}
              onClick={() => goTab(x.id)}
            >
              {x.icon}
              <span>{x.label}</span>
            </button>
          ))}
        </nav>
      ) : (
        <div />
      )}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
