import { useEffect, useRef } from 'react';
import { ATTRACTIONS, localizedName } from '../data/attractions';
import { UI_LANGUAGES, isLanguageCode } from '../i18n';
import { useAppState, type TextSize } from '../state/prefs';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Innstillinger: språk, tilgjengelighet og demo-posisjon. Native <dialog> gir fokusfelle og Esc gratis. */
export function SettingsDialog({ open, onClose }: Props) {
  const { t, prefs, setPrefs, demoPosition, setDemoPosition } = useAppState();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const sizes: { v: TextSize; label: string }[] = [
    { v: 'normal', label: t('textSizeNormal') },
    { v: 'large', label: t('textSizeLarge') },
    { v: 'xlarge', label: t('textSizeXLarge') },
  ];

  const Switch = ({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) => (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <span>
        {label}
        {help && <span className="note" style={{ display: 'block', fontWeight: 400 }}>{help}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="settings-title">
      <div className="dialog__inner">
        <div className="dialog__head">
          <h2 id="settings-title">{t('settings')}</h2>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t('close')}>
            <IconClose />
          </button>
        </div>

        <div className="field">
          <label htmlFor="lang">{t('language')}</label>
          <select id="lang" value={prefs.lang} onChange={(e) => isLanguageCode(e.target.value) && setPrefs({ lang: e.target.value })}>
            {UI_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.bcp47}>{l.label}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend><h3>{t('a11yHeading')}</h3></legend>
          <div className="field" style={{ marginTop: 8 }}>
            <span id="textsize-label" style={{ fontWeight: 600 }}>{t('textSize')}</span>
            <div className="segmented" role="group" aria-labelledby="textsize-label">
              {sizes.map((s) => (
                <button key={s.v} type="button" className="btn btn--outline" aria-pressed={prefs.textSize === s.v} onClick={() => setPrefs({ textSize: s.v })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Switch label={t('highContrast')} checked={prefs.highContrast} onChange={(v) => setPrefs({ highContrast: v })} />
          <Switch label={t('reduceMotion')} checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
          <Switch label={t('captions')} checked={prefs.captions} onChange={(v) => setPrefs({ captions: v })} />
          <Switch label={t('audioDescription')} help={t('audioDescriptionHelp')} checked={prefs.audioDescription} onChange={(v) => setPrefs({ audioDescription: v })} />
          <Switch label={t('haptics')} checked={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} />
        </fieldset>

        <fieldset>
          <legend><h3>{t('demoHeading')}</h3></legend>
          <p className="note" style={{ margin: '4px 0 10px' }}>{t('demoHelp')}</p>
          <div className="demo-list">
            <button type="button" className="btn btn--outline" aria-pressed={demoPosition === null} onClick={() => setDemoPosition(null)}>
              {t('useRealPosition')}
            </button>
            {ATTRACTIONS.map((a) => {
              const active = demoPosition?.lat === a.position.lat && demoPosition?.lng === a.position.lng;
              return (
                <button
                  key={a.id}
                  type="button"
                  className="btn btn--outline"
                  aria-pressed={active}
                  onClick={() => setDemoPosition({ lat: a.position.lat + 0.0004, lng: a.position.lng + 0.0004 })}
                >
                  {t('teleportTo', { name: localizedName(a, prefs.lang) })}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </dialog>
  );
}
