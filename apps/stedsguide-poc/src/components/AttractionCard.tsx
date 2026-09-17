import type { Attraction } from '../data/types';
import { localizedName } from '../data/attractions';
import { formatDistance } from '../lib/geo';
import { isEntitled } from '../lib/entitlements';
import { useAppState } from '../state/prefs';
import { IconHeart, IconHeartFilled } from './Icons';

interface Props {
  attraction: Attraction;
  distanceM: number;
  selected?: boolean;
  onOpen: (id: string) => void;
  headingLevel?: 'h2' | 'h3';
}

export function AttractionCard({ attraction, distanceM, selected, onOpen, headingLevel = 'h3' }: Props) {
  const { t, prefs, locale, savedIds, toggleSaved, entitlements } = useAppState();
  const name = localizedName(attraction, prefs.lang);
  const saved = savedIds.includes(attraction.id);
  const Heading = headingLevel;
  const owned = isEntitled(entitlements, attraction.id);
  return (
    <article className={`card${selected ? ' card--selected' : ''}`} style={{ ['--hue' as string]: attraction.hue }} aria-labelledby={`card-${attraction.id}`}>
      <div className="card__thumb" aria-hidden="true" />
      <div>
        <Heading className="card__title" id={`card-${attraction.id}`}>{name}</Heading>
        <p className="card__meta">
          <span>{attraction.place}</span>
          <span>{t('distanceAway', { distance: formatDistance(distanceM, locale) })}</span>
          {owned && <span className="chip chip--ok">{t('entitled').replace(/\.$/, '')}</span>}
        </p>
      </div>
      <div className="card__actions">
        <button type="button" className="btn btn--primary" onClick={() => onOpen(attraction.id)} aria-describedby={`card-${attraction.id}`}>
          {t('showDetails')}
        </button>
        <button
          type="button"
          className="btn btn--outline btn--icon"
          onClick={() => toggleSaved(attraction.id)}
          aria-pressed={saved}
          aria-label={`${saved ? t('unsave') : t('save')}: ${name}`}
        >
          {saved ? <IconHeartFilled /> : <IconHeart />}
        </button>
      </div>
    </article>
  );
}
