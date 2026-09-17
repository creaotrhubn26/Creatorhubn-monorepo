import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { Attraction } from '../data/types';
import { localizedName, resolveScript } from '../data/attractions';
import { languageInfo } from '../i18n';
import { useNarrator } from '../hooks/useNarrator';
import { useAppState } from '../state/prefs';
import { IconBack, IconCaptions, IconEye, IconNext, IconPause, IconPlay, IconPrev, IconReplay } from './Icons';

interface Props {
  attraction: Attraction;
  onBack: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

/**
 * Selve guiden. Severdigheten er i fokus øverst; teksting av det guiden
 * sier fyller skjermen; kontrollene ligger nederst innen tommelrekkevidde.
 *
 * Blinde: synstolking leses før hver del, «Beskriv stedet» når som helst,
 *         alt er tastatur-/skjermleser-navigerbart, status annonseres.
 * Hørselshemmede: teksting i stor skrift med ord-markering, visuell
 *         «guiden snakker»-indikator, vibrasjon ved ny del, full transkripsjon.
 */
export function GuidePlayer({ attraction, onBack, headingRef }: Props) {
  const { t, prefs, setPrefs, progress, setProgress } = useAppState();
  const name = localizedName(attraction, prefs.lang);
  const resolved = useMemo(() => resolveScript(attraction, prefs.lang), [attraction, prefs.lang]);
  const speechLang = languageInfo(resolved.lang).bcp47;

  const narrator = useNarrator(resolved.script, {
    lang: speechLang,
    rate: prefs.rate,
    audioDescription: prefs.audioDescription,
    startIndex: progress[attraction.id] ?? 0,
    onSegmentChange: (i) => {
      setProgress(attraction.id, i);
      if (prefs.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(40);
    },
  });
  const { state } = narrator;
  const total = narrator.total;

  // Autostart første gang spilleren åpnes (liten forsinkelse så stemmer
  // rekker å lastes). Enhver manuell handling før det avlyser autostarten.
  const autoplayTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autoplayTimer.current !== null) return;
    autoplayTimer.current = window.setTimeout(() => {
      autoplayTimer.current = null;
      narrator.play();
    }, 300);
    return () => {
      if (autoplayTimer.current !== null) window.clearTimeout(autoplayTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const manual = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    if (autoplayTimer.current !== null) {
      window.clearTimeout(autoplayTimer.current);
      autoplayTimer.current = null;
    }
    fn(...a);
  };

  useEffect(() => {
    if (state.status === 'ended') setProgress(attraction.id, 0);
  }, [state.status, attraction.id, setProgress]);

  const isPlaying = state.status === 'playing';

  // Ord-markering: split teksten ved charIndex (ordgrense) når vi har den.
  const caption = useMemo(() => {
    const text = state.currentText;
    if (!prefs.captions) return null;
    if (state.charIndex < 0 || !isPlaying) return <>{text}</>;
    const start = state.charIndex;
    const rest = text.slice(start);
    const m = /^\S+/.exec(rest);
    const end = start + (m ? m[0].length : 0);
    return (
      <>
        {text.slice(0, start)}
        <mark>{text.slice(start, end)}</mark>
        {text.slice(end)}
      </>
    );
  }, [state.currentText, state.charIndex, isPlaying, prefs.captions]);

  const statusText =
    state.status === 'ended'
      ? t('guideEnded')
      : isPlaying
        ? t('nowSpeaking')
        : state.status === 'paused'
          ? t('pausedLabel')
          : '';

  return (
    <div className="player" style={{ ['--hue' as string]: attraction.hue }}>
      <div className="player__hero">
        <button type="button" className="btn btn--icon hero__back" onClick={() => { narrator.stop(); onBack(); }} aria-label={t('back')}>
          <IconBack />
        </button>
        <p className="hero__place">{attraction.place}</p>
        <h1 ref={headingRef} tabIndex={-1}>{name}</h1>
        <div className="player__meta">
          <span className="chip">{t('segmentOf', { index: state.index + 1, total })}</span>
          {isPlaying && (
            <span className="chip speaking">
              <span className="speaking__bars" aria-hidden="true"><i /><i /><i /></span>
              {t('nowSpeaking')}
            </span>
          )}
          {state.status === 'paused' && <span className="chip">{t('pausedLabel')}</span>}
        </div>
        <div className="progress" aria-hidden="true">
          {resolved.script.segments.map((s, i) => (
            <i key={s.id} className={i < state.index ? 'is-done' : i === state.index ? 'is-current' : ''} />
          ))}
        </div>
      </div>

      {/* Status for skjermleser (høflig, ikke avbrytende) */}
      <p className="visually-hidden" role="status" aria-live="polite">{statusText}</p>

      <div className="captions" aria-label={t('captions')}>
        {!state.speechSupported && <p className="status status--warn">{t('speechUnsupported')}</p>}
        {state.speechSupported && !state.voiceAvailable && (
          <p className="status status--warn">{t('noVoice', { language: languageInfo(resolved.lang).label })}</p>
        )}
        {resolved.isFallback && <p className="status status--info">{t('scriptFallback', { language: languageInfo(prefs.lang).label })}</p>}

        {state.status === 'ended' ? (
          <p className="caption" role="status">{t('guideEnded')}</p>
        ) : prefs.captions ? (
          <p className={`caption${state.phase !== 'narration' ? ' caption--ad' : ''}`} lang={speechLang} aria-live="off">
            {state.phase !== 'narration' && <span className="caption__label">{t('audioDescriptionPrefix')}</span>}
            {caption}
          </p>
        ) : (
          <p className="caption caption--off">{t('captions')}: OFF</p>
        )}

        <details className="transcript">
          <summary>{t('transcript')}</summary>
          <ol>
            {resolved.script.segments.map((s, i) => (
              <li key={s.id} className={i === state.index ? 'is-current' : ''} lang={speechLang}>
                <button type="button" onClick={manual(() => narrator.jumpTo(i))} aria-current={i === state.index ? 'true' : undefined}>
                  {s.narration}
                </button>
                {prefs.audioDescription && <span className="ad">{t('audioDescriptionPrefix')} {s.audioDescription}</span>}
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="controls">
        <div className="controls__row">
          <button type="button" className="btn btn--icon" onClick={manual(narrator.prev)} aria-label={t('previous')} disabled={state.index === 0 && state.phase !== 'scene'}>
            <IconPrev />
          </button>
          <button type="button" className="btn btn--icon" onClick={manual(narrator.replay)} aria-label={t('replay')}>
            <IconReplay />
          </button>
          <button
            type="button"
            className="btn btn--primary btn--icon"
            onClick={manual(isPlaying ? narrator.pause : narrator.play)}
            aria-label={isPlaying ? t('pause') : t('play')}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          <button type="button" className="btn btn--icon" onClick={manual(narrator.describeScene)} aria-label={t('describeScene')} title={t('describeScene')}>
            <IconEye />
          </button>
          <button type="button" className="btn btn--icon" onClick={manual(narrator.next)} aria-label={t('next')} disabled={state.status === 'ended'}>
            <IconNext />
          </button>
        </div>
        <div className="controls__toggles">
          <button type="button" className="toggle" aria-pressed={prefs.captions} onClick={() => setPrefs({ captions: !prefs.captions })}>
            <span><IconCaptions />{t('captions')}</span>
            <span className="toggle__state">{prefs.captions ? 'ON' : 'OFF'}</span>
          </button>
          <button type="button" className="toggle" aria-pressed={prefs.audioDescription} onClick={() => setPrefs({ audioDescription: !prefs.audioDescription })} aria-describedby="ad-help">
            <span><IconEye />{t('audioDescription')}</span>
            <span className="toggle__state">{prefs.audioDescription ? 'ON' : 'OFF'}</span>
          </button>
          <span id="ad-help" className="visually-hidden">{t('audioDescriptionHelp')}</span>
        </div>
        <label className="visually-hidden" htmlFor="rate">{t('speed')}</label>
        <div className="controls__row">
          <span className="note" style={{ color: 'inherit' }} aria-hidden="true">{t('speed')}</span>
          <input
            id="rate"
            type="range"
            min={0.7}
            max={1.4}
            step={0.1}
            value={prefs.rate}
            onChange={(e) => setPrefs({ rate: Number(e.target.value) })}
            aria-valuetext={`${prefs.rate.toFixed(1)}×`}
            style={{ flex: 1, minHeight: 44 }}
          />
          <span aria-hidden="true">{prefs.rate.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  );
}

