import { useId, useMemo, useState } from 'react';
import type { AttractionWithDistance } from '../lib/geo';
import { matchesQuery } from '../lib/geo';
import { useAppState } from '../state/prefs';
import { AttractionCard } from './AttractionCard';
import { IconSearch } from './Icons';

interface Props {
  sorted: AttractionWithDistance[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}

/** Bunnark under kartet: søk + nærmeste severdighet (+ treff ved søk). */
export function NearbySheet({ sorted, selectedId, onOpen }: Props) {
  const { t } = useAppState();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const results = useMemo(() => sorted.filter((x) => matchesQuery(x.attraction, query)), [sorted, query]);
  const searching = query.trim().length > 0;
  const selected = selectedId ? sorted.find((x) => x.attraction.id === selectedId) : null;
  const shown = searching ? results : selected ? [selected] : results.slice(0, 1);

  return (
    <section className="sheet" aria-labelledby={`${searchId}-heading`}>
      <div className="sheet__handle" aria-hidden="true" />
      <div className="search">
        <IconSearch />
        <label htmlFor={searchId} className="visually-hidden">{t('searchLabel')}</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <div className="sheet__head">
        <h2 id={`${searchId}-heading`}>{searching ? t('nearbyHeading') : t('nearestHeading')}</h2>
        {searching && <span className="note" aria-live="polite">{t('attractionsCount', { count: results.length })}</span>}
      </div>
      {shown.length === 0 ? (
        <p className="note" role="status">{t('noResults')}</p>
      ) : (
        <ul className="list">
          {shown.map(({ attraction, distanceM }) => (
            <li key={attraction.id}>
              <AttractionCard attraction={attraction} distanceM={distanceM} selected={attraction.id === selectedId} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
