import { useEffect, useState } from 'react';
import { api, getOrgId, getUserEmail, isLoggedIn, logout, setOrgId, setToken, setUserEmail } from './api';
import {
  BankScreen,
  DocumentDetailScreen,
  DocumentsScreen,
  GmailScreen,
  OverviewScreen,
  ReportsScreen,
  SaftImportScreen,
  TaxScreen,
  VatScreen,
} from './screens';
import { DimensionsScreen } from './screens-dimensions';
import { InvoicingScreen } from './screens-invoicing';
import { OrgSettingsScreen } from './screens-org';
import { AuditScreen, JournalScreen, LedgerScreen } from './screens-pro';
import { Icons, ToastProvider } from './ui';

export type ViewMode = 'simple' | 'advanced' | 'pro';

/** Reknaren-monogram: skoggrønn flis, kremhvit R, gull-prikk (jf. logo). */
function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="40" height="40" rx="9" fill="#1f4d3a" />
      <circle cx="29.5" cy="11" r="3.4" fill="#b0913b" />
      <text
        x="19"
        y="29"
        textAnchor="middle"
        fontSize="25"
        fontWeight="800"
        fill="#f4f3ee"
        fontFamily="'Avenir Next','Segoe UI',system-ui,sans-serif"
      >
        R
      </text>
    </svg>
  );
}

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  simple: 'Enkel visning',
  advanced: 'Avansert visning',
  pro: 'Regnskapsførervisning',
};

type Screen =
  | { name: 'overview' }
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'gmail' }
  | { name: 'bank' }
  | { name: 'reports' }
  | { name: 'vat' }
  | { name: 'tax' }
  | { name: 'ledger' }
  | { name: 'journal' }
  | { name: 'audit' }
  | { name: 'invoicing' }
  | { name: 'dimensions' }
  | { name: 'saft-import' }
  | { name: 'org' };

const NAV: { key: Screen['name']; label: string; icon: keyof typeof Icons }[] = [
  { key: 'overview', label: 'Oversikt', icon: 'overview' },
  { key: 'documents', label: 'Bilagsinnboks', icon: 'inbox' },
  { key: 'gmail', label: 'Gmail-import', icon: 'mail' },
  { key: 'invoicing', label: 'Salg og faktura', icon: 'chart' },
  { key: 'dimensions', label: 'Prosjekter', icon: 'overview' },
  { key: 'bank', label: 'Bank og avstemming', icon: 'bank' },
  { key: 'vat', label: 'MVA', icon: 'percent' },
  { key: 'tax', label: 'Skatt og reserver', icon: 'shield' },
  { key: 'reports', label: 'Rapporter', icon: 'chart' },
  { key: 'saft-import', label: 'Importer fra Fiken', icon: 'inbox' },
  { key: 'org', label: 'Virksomhet', icon: 'shield' },
];

/** Skjermer som kun vises i regnskapsførervisningen. */
const PRO_NAV: { key: Screen['name']; label: string; icon: keyof typeof Icons }[] = [
  { key: 'ledger', label: 'Hovedbok', icon: 'chart' },
  { key: 'journal', label: 'Bilagsjournal', icon: 'inbox' },
  { key: 'audit', label: 'Revisjonslogg', icon: 'shield' },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [verifyingMagic, setVerifyingMagic] = useState(false);
  const [orgId, setOrg] = useState<string | null>(getOrgId());
  const [addingOrg, setAddingOrg] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'overview' });
  const switchOrg = (id: string) => {
    setOrgId(id);
    setOrg(id);
    setScreen({ name: 'overview' });
  };
  const [viewMode, setViewMode] = useState<ViewMode>(
    (sessionStorage.getItem('reknaren.viewMode') as ViewMode) ?? 'simple',
  );
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem('reknaren.viewMode', mode);
    if (mode !== 'pro' && ['ledger', 'journal', 'audit'].includes(screen.name)) {
      setScreen({ name: 'overview' });
    }
  };

  // Magisk innloggingslenke: ?magic=<token> i URL → verifiser → sesjon.
  useEffect(() => {
    if (loggedIn) return;
    const magic = new URLSearchParams(window.location.search).get('magic');
    if (!magic) return;
    setVerifyingMagic(true);
    api<{ token: string; email: string }>('POST', '/api/auth/verify-magic-link', { token: magic })
      .then((res) => {
        setToken(res.token);
        setUserEmail(res.email);
        setLoggedIn(true);
      })
      .catch(() => undefined)
      .finally(() => {
        setVerifyingMagic(false);
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, [loggedIn]);

  if (verifyingMagic) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="brand">
            <LogoMark />
            <div className="name">Reknaren</div>
          </div>
          <p className="subtitle">Logger inn …</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) return <LoginScreen />;
  if (!orgId)
    return (
      <OrgGate
        onPick={(id) => {
          setOrgId(id);
          setOrg(id);
        }}
      />
    );
  if (addingOrg)
    return (
      <OrgSetupScreen
        onDone={(id) => {
          switchOrg(id);
          setAddingOrg(false);
        }}
        onCancel={() => setAddingOrg(false)}
      />
    );

  const openDocument = (id: string) => setScreen({ name: 'document', id });

  return (
    <ToastProvider>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <LogoMark />
            <div className="name">Reknaren</div>
          </div>
          <OrgSwitcher currentId={orgId} onSwitch={switchOrg} onAdd={() => setAddingOrg(true)} />
          <nav aria-label="Hovedmeny">
            {NAV.map((item) => (
              <button
                key={item.key}
                className={`navlink${screen.name === item.key ? ' active' : ''}`}
                aria-current={screen.name === item.key ? 'page' : undefined}
                onClick={() => setScreen({ name: item.key } as Screen)}
              >
                {Icons[item.icon]}
                {item.label}
              </button>
            ))}
            {viewMode === 'pro' && (
              <>
                <div className="nav-section">Regnskapsfører</div>
                {PRO_NAV.map((item) => (
                  <button
                    key={item.key}
                    className={`navlink${screen.name === item.key ? ' active' : ''}`}
                    aria-current={screen.name === item.key ? 'page' : undefined}
                    onClick={() => setScreen({ name: item.key } as Screen)}
                  >
                    {Icons[item.icon]}
                    {item.label}
                  </button>
                ))}
              </>
            )}
          </nav>
          <div className="spacer" />
          <label htmlFor="viewmode" style={{ margin: '0 10px 4px' }}>
            Visning
          </label>
          <select
            id="viewmode"
            value={viewMode}
            onChange={(e) => changeViewMode(e.target.value as ViewMode)}
            style={{ margin: '0 0 8px', width: 'auto', marginLeft: 10, marginRight: 10 }}
          >
            {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((m) => (
              <option key={m} value={m}>
                {VIEW_MODE_LABELS[m]}
              </option>
            ))}
          </select>
          <div className="whoami">{getUserEmail() ?? 'Innlogget'}</div>
          <button
            className="navlink"
            onClick={() => {
              logout();
              location.reload();
            }}
          >
            Logg ut
          </button>
        </aside>
        <main className="main">
          {screen.name === 'overview' && (
            <OverviewScreen
              orgId={orgId}
              onOpenDocument={openDocument}
              onNavigate={(name) => setScreen({ name } as Screen)}
            />
          )}
          {screen.name === 'documents' && <DocumentsScreen orgId={orgId} onOpen={openDocument} />}
          {screen.name === 'document' && (
            <DocumentDetailScreen
              orgId={orgId}
              documentId={screen.id}
              viewMode={viewMode}
              onBack={() => setScreen({ name: 'documents' })}
            />
          )}
          {screen.name === 'gmail' && <GmailScreen orgId={orgId} onOpenDocument={openDocument} />}
          {screen.name === 'bank' && <BankScreen orgId={orgId} />}
          {screen.name === 'invoicing' && <InvoicingScreen orgId={orgId} />}
          {screen.name === 'dimensions' && <DimensionsScreen orgId={orgId} />}
          {screen.name === 'org' && <OrgSettingsScreen orgId={orgId} />}
          {screen.name === 'reports' && <ReportsScreen orgId={orgId} />}
          {screen.name === 'vat' && <VatScreen orgId={orgId} />}
          {screen.name === 'saft-import' && <SaftImportScreen orgId={orgId} />}
          {screen.name === 'tax' && <TaxScreen orgId={orgId} />}
          {screen.name === 'ledger' && <LedgerScreen orgId={orgId} />}
          {screen.name === 'journal' && <JournalScreen orgId={orgId} />}
          {screen.name === 'audit' && <AuditScreen orgId={orgId} />}
        </main>
      </div>
    </ToastProvider>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/auth/request-magic-link', { email });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <LogoMark />
          <div className="name">Reknaren</div>
        </div>
        <p className="subtitle">
          Regnskapet ditt, forklart på vanlig norsk. Passordløs innlogging med engangslenke på e-post.
        </p>
        {sent ? (
          <div className="notice">
            Sjekk e-posten din — vi har sendt en innloggingslenke. Den er gyldig i 15 minutter.
            Fikk du ingen? Sjekk at e-posten er registrert som bruker.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email && !busy) void submit();
            }}
          >
            <label htmlFor="email">E-post</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button type="submit" className="primary" disabled={busy || !email}>
                {busy ? 'Sender …' : 'Send innloggingslenke'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface MyOrg {
  id: string;
  name: string;
  orgForm: string;
  orgNumber: string | null;
  role: string;
}

/** Bytt mellom virksomhetene du er medlem av, eller legg til en ny. */
function OrgSwitcher({
  currentId,
  onSwitch,
  onAdd,
}: {
  currentId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
}) {
  const orgs = useLoad(() => api<MyOrg[]>('GET', '/api/organizations'), []);
  const list = orgs.data ?? [];
  const hasCurrent = list.some((o) => o.id === currentId);
  return (
    <div className="org-switcher">
      <label htmlFor="orgswitch">Virksomhet</label>
      <select
        id="orgswitch"
        value={currentId}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__add__') onAdd();
          else if (v !== currentId) onSwitch(v);
        }}
      >
        {!hasCurrent && <option value={currentId}>Aktiv virksomhet</option>}
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        <option value="__add__">+ Legg til virksomhet …</option>
      </select>
    </div>
  );
}

/** Etter innlogging: velg blant virksomhetene du er medlem av, eller opprett ny. */
function OrgGate({ onPick }: { onPick: (orgId: string) => void }) {
  const orgs = useLoad(() => api<MyOrg[]>('GET', '/api/organizations'), []);
  const [creating, setCreating] = useState(false);

  // Nøyaktig én virksomhet → hopp rett inn (vanligste tilfellet).
  useEffect(() => {
    if (!creating && orgs.data && orgs.data.length === 1) onPick(orgs.data[0]!.id);
  }, [orgs.data, creating, onPick]);

  if (creating || (orgs.data && orgs.data.length === 0)) {
    return <OrgSetupScreen onDone={onPick} onCancel={orgs.data && orgs.data.length > 0 ? () => setCreating(false) : undefined} />;
  }
  if (orgs.loading || !orgs.data || orgs.data.length === 1) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="brand">
            <LogoMark />
            <div className="name">Reknaren</div>
          </div>
          <p className="subtitle">Laster virksomhetene dine …</p>
        </div>
      </div>
    );
  }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <LogoMark />
          <div className="name">Reknaren</div>
        </div>
        <h1>Velg virksomhet</h1>
        <p className="subtitle">Du er medlem av flere virksomheter. Velg hvilken du vil åpne.</p>
        <div className="org-list">
          {orgs.data.map((o) => (
            <button key={o.id} className="org-choice" onClick={() => onPick(o.id)}>
              <span className="org-choice-name">{o.name}</span>
              <span className="org-choice-meta">
                {o.orgForm}
                {o.orgNumber ? ` · ${o.orgNumber}` : ''} · {o.role}
              </span>
            </button>
          ))}
        </div>
        <div className="actions">
          <button onClick={() => setCreating(true)}>Opprett ny virksomhet</button>
        </div>
      </div>
    </div>
  );
}

function OrgSetupScreen({ onDone, onCancel }: { onDone: (orgId: string) => void; onCancel?: () => void }) {
  const [name, setName] = useState('');
  const [orgForm, setOrgForm] = useState('ENK');
  const [vatStatus, setVatStatus] = useState('registered');
  const [orgNumber, setOrgNumber] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { name, orgForm, vatStatus };
      if (orgNumber) body['orgNumber'] = orgNumber;
      if (street) body['streetAddress'] = street;
      if (postalCode) body['postalCode'] = postalCode;
      if (city) body['city'] = city;
      const res = await api<{ id: string }>('POST', '/api/organizations', body);
      onDone(res.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Opprett virksomhet</h1>
        <p className="subtitle">Dette kan endres senere. Vi tilpasser regler og forslag til virksomhetsformen.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name && !busy) void submit();
          }}
        >
          <label htmlFor="orgname">Navn på virksomheten</label>
          <input id="orgname" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="orgform">Organisasjonsform</label>
          <select id="orgform" value={orgForm} onChange={(e) => setOrgForm(e.target.value)}>
            <option value="ENK">Enkeltpersonforetak (ENK)</option>
            <option value="AS">Aksjeselskap (AS)</option>
            <option value="ANS">ANS</option>
            <option value="DA">DA</option>
            <option value="SA">SA</option>
            <option value="NUF">NUF</option>
          </select>
          <label htmlFor="vat">MVA-status</label>
          <select id="vat" value={vatStatus} onChange={(e) => setVatStatus(e.target.value)}>
            <option value="registered">MVA-registrert</option>
            <option value="not_registered">Ikke MVA-registrert</option>
            <option value="pending">Under registrering</option>
          </select>
          <label htmlFor="orgnr">Organisasjonsnummer (valgfritt)</label>
          <input id="orgnr" inputMode="numeric" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="9 sifre" />
          <label htmlFor="orgstreet">Gateadresse (kreves for fakturering)</label>
          <input id="orgstreet" autoComplete="street-address" value={street} onChange={(e) => setStreet(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="orgpostal">Postnummer</label>
              <input id="orgpostal" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <label htmlFor="orgcity">Sted</label>
              <input id="orgcity" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !name}>
              Opprett
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel}>
                Tilbake
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
