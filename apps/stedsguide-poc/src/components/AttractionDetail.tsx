import type { RefObject } from 'react';
import type { Attraction } from '../data/types';
import { localizedHeroAlt, localizedName, resolveScript } from '../data/attractions';
import { formatDistance } from '../lib/geo';
import { applyQuickBuy, applySubscription, canQuickBuy, hasActiveSubscription, isEntitled, PRICES_NOK, QUICK_BUY_RADIUS_M } from '../lib/entitlements';
import { languageInfo } from '../i18n';
import { useAppState } from '../state/prefs';
import { IconBack, IconHeart, IconHeartFilled, IconPlay } from './Icons';

interface Props {
  attraction: Attraction;
  distanceM: number;
  onBack: () => void;
  onStart: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Kort introduksjon + tilgang (quick buy nær stedet, eller abonnement). */
export function AttractionDetail({ attraction, distanceM, onBack, onStart, headingRef }: Props) {
  const { t, prefs, locale, savedIds, toggleSaved, entitlements, setEntitlements, progress } = useAppState();
  const name = localizedName(attraction, prefs.lang);
  const { script, isFallback } = resolveScript(attraction, prefs.lang);
  const saved = savedIds.includes(attraction.id);
  const entitled = isEntitled(entitlements, attraction.id);
  const nearby = canQuickBuy(distanceM);
  const resume = (progress[attraction.id] ?? 0) > 0;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div>
      <div className="hero" style={{ ['--hue' as string]: attraction.hue }}>
        <div className="hero__art" role="img" aria-label={localizedHeroAlt(attraction, prefs.lang)} />
        <button type="button" className="btn btn--icon hero__back" onClick={onBack} aria-label={t('back')}>
          <IconBack />
        </button>
        <p className="hero__place">{attraction.place}</p>
        <h1 ref={headingRef} tabIndex={-1}>{name}</h1>
        <p>
          {t('distanceAway', { distance: formatDistance(distanceM, locale) })} · {t('durationApprox', { minutes: attraction.durationMin })}
        </p>
      </div>

      <div className="screen">
        <section className="panel" aria-labelledby="intro-heading">
          <h2 id="intro-heading">{t('introHeading')}</h2>
          <p>{script.intro}</p>
          {isFallback && (
            <p className="status status--info">{t('scriptFallback', { language: languageInfo(prefs.lang).label })}</p>
          )}
          <button type="button" className="btn btn--outline" onClick={() => toggleSaved(attraction.id)} aria-pressed={saved}>
            {saved ? <IconHeartFilled /> : <IconHeart />}
            {saved ? t('unsave') : t('save')}
          </button>
        </section>

        <section className="panel" aria-labelledby="access-heading">
          <h2 id="access-heading">{t('accessHeading')}</h2>
          {entitled ? (
            <>
              <p className="status status--ok">
                {t('entitled')}
                {hasActiveSubscription(entitlements) && entitlements.subscriptionUntil && (
                  <> {t('subscribedUntil', { date: dateFmt.format(new Date(entitlements.subscriptionUntil)) })}</>
                )}
              </p>
              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onStart}>
                <IconPlay />
                {resume ? t('resumeGuide') : t('startGuide')}
              </button>
            </>
          ) : (
            <>
              <p className={`status ${nearby ? 'status--ok' : 'status--warn'}`} role="status">
                {nearby
                  ? t('quickBuyUnlocked')
                  : t('quickBuyLocked', { radius: QUICK_BUY_RADIUS_M, distance: formatDistance(distanceM, locale) })}
              </p>
              <button
                type="button"
                className="btn btn--primary btn--lg btn--block"
                disabled={!nearby}
                onClick={() => setEntitlements(applyQuickBuy(entitlements, attraction.id))}
              >
                {t('quickBuy')} · {t('quickBuyPrice', { price: attraction.quickBuyNok })}
              </button>
              <h3>{t('subscribe')}</h3>
              <div className="price-row">
                <button type="button" className="btn btn--outline" onClick={() => setEntitlements(applySubscription(entitlements, 'monthly'))}>
                  {t('monthly')}
                  <br />
                  {t('pricePerMonth', { price: PRICES_NOK.monthly })}
                </button>
                <button type="button" className="btn btn--outline" onClick={() => setEntitlements(applySubscription(entitlements, 'yearly'))}>
                  {t('yearly')}
                  <br />
                  {t('pricePerYear', { price: PRICES_NOK.yearly })}
                </button>
              </div>
              <p className="note">{t('demoPaymentNote')}</p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
