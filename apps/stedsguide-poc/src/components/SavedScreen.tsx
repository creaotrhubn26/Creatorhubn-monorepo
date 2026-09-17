import type { RefObject } from 'react';
import type { AttractionWithDistance } from '../lib/geo';
import { useAppState } from '../state/prefs';
import { AttractionCard } from './AttractionCard';

interface Props {
  sorted: AttractionWithDistance[];
  onOpen: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function SavedScreen({ sorted, onOpen, headingRef }: Props) {
  const { t, savedIds } = useAppState();
  const saved = sorted.filter((x) => savedIds.includes(x.attraction.id));
  return (
    <div className="screen">
      <h1 ref={headingRef} tabIndex={-1}>{t('tabSaved')}</h1>
      {saved.length === 0 ? (
        <p className="note">{t('savedEmpty')}</p>
      ) : (
        <ul className="list">
          {saved.map(({ attraction, distanceM }) => (
            <li key={attraction.id}>
              <AttractionCard attraction={attraction} distanceM={distanceM} onOpen={onOpen} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
