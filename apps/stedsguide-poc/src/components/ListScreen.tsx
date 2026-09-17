import { useMemo, useState, type RefObject } from 'react';
import type { AttractionWithDistance } from '../lib/geo';
import { matchesQuery } from '../lib/geo';
import { useAppState } from '../state/prefs';
import { AttractionCard } from './AttractionCard';
import { IconSearch } from './Icons';

interface Props {
  sorted: AttractionWithDistance[];
  onOpen: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Tilgjengelig ekvivalent til kartet: alle severdigheter, sortert etter avstand. */
export function ListScreen({ sorted, onOpen, headingRef }: Props) {
  const { t } = useAppState();
  const [query, setQuery] = useState('');
  const results = useMemo(() => sorted.filter((x) => matchesQuery(x.attraction, query)), [sorted, query]);
  return (
    <div className="screen">
      <h1 ref={headingRef} tabIndex={-1}>{t('nearbyHeading')}</h1>
      <p className="screen__hint">{t('listHint')}</p>
      <div className="search">
        <IconSearch />
        <label htmlFor="list-search" className="visually-hidden">{t('searchLabel')}</label>
        <input id="list-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} autoComplete="off" />
      </div>
      <p className="note" aria-live="polite">{t('attractionsCount', { count: results.length })}</p>
      {results.length === 0 ? (
        <p className="note">{t('noResults')}</p>
      ) : (
        <ul className="list">
          {results.map(({ attraction, distanceM }) => (
            <li key={attraction.id}>
              <AttractionCard attraction={attraction} distanceM={distanceM} onOpen={onOpen} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
