import { useAppState } from '../state/prefs';
import { IconLogo, IconSettings } from './Icons';

export function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { t } = useAppState();
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <IconLogo />
        <span>{t('appName')}</span>
      </div>
      <div className="topbar__actions">
        <button type="button" className="btn btn--ghost btn--icon" onClick={onOpenSettings} aria-label={t('settings')} aria-haspopup="dialog">
          <IconSettings />
        </button>
      </div>
    </header>
  );
}
