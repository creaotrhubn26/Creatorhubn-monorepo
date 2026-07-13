import { useEffect, useState } from 'react';
import { api, getOrgId, getUserEmail, isLoggedIn, logout, setOrgId, setToken, setUserEmail } from './api';
import {
  BankScreen,
  DocumentDetailScreen,
  DocumentsScreen,
  GmailScreen,
  OverviewScreen,
  ReportsScreen,
  TaxScreen,
  VatScreen,
} from './screens';
import { Icons, ToastProvider } from './ui';

type Screen =
  | { name: 'overview' }
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'gmail' }
  | { name: 'bank' }
  | { name: 'reports' }
  | { name: 'vat' }
  | { name: 'tax' };

const NAV: { key: Screen['name']; label: string; icon: keyof typeof Icons }[] = [
  { key: 'overview', label: 'Oversikt', icon: 'overview' },
  { key: 'documents', label: 'Bilagsinnboks', icon: 'inbox' },
  { key: 'gmail', label: 'Gmail-import', icon: 'mail' },
  { key: 'bank', label: 'Bank og avstemming', icon: 'bank' },
  { key: 'vat', label: 'MVA', icon: 'percent' },
  { key: 'tax', label: 'Skatt og reserver', icon: 'shield' },
  { key: 'reports', label: 'Rapporter', icon: 'chart' },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [orgId, setOrg] = useState<string | null>(getOrgId());
  const [screen, setScreen] = useState<Screen>({ name: 'overview' });

  if (!loggedIn) return <LoginScreen onDone={() => setLoggedIn(true)} />;
  if (!orgId)
    return (
      <OrgSetupScreen
        onDone={(id) => {
          setOrgId(id);
          setOrg(id);
        }}
      />
    );

  const openDocument = (id: string) => setScreen({ name: 'document', id });

  return (
    <ToastProvider>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="logo" aria-hidden>
              L
            </div>
            <div className="name">Ledgerly</div>
          </div>
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
          </nav>
          <div className="spacer" />
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
          {screen.name === 'overview' && <OverviewScreen orgId={orgId} onOpenDocument={openDocument} />}
          {screen.name === 'documents' && <DocumentsScreen orgId={orgId} onOpen={openDocument} />}
          {screen.name === 'document' && (
            <DocumentDetailScreen
              orgId={orgId}
              documentId={screen.id}
              onBack={() => setScreen({ name: 'documents' })}
            />
          )}
          {screen.name === 'gmail' && <GmailScreen orgId={orgId} onOpenDocument={openDocument} />}
          {screen.name === 'bank' && <BankScreen orgId={orgId} />}
          {screen.name === 'reports' && <ReportsScreen orgId={orgId} />}
          {screen.name === 'vat' && <VatScreen orgId={orgId} />}
          {screen.name === 'tax' && <TaxScreen orgId={orgId} />}
        </main>
      </div>
    </ToastProvider>
  );
}

function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>('POST', '/api/auth/dev-login', {
        email,
        displayName: name || email,
      });
      setToken(res.token);
      setUserEmail(email);
      onDone();
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
          <div className="logo" aria-hidden>
            L
          </div>
          <div className="name">Ledgerly</div>
        </div>
        <p className="subtitle">
          Regnskapet ditt, forklart på vanlig norsk. Utviklingsinnlogging — produksjon vil bruke
          BankID/OIDC med tofaktor.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email && !busy) void submit();
          }}
        >
          <label htmlFor="email">E-post</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="name">Navn</label>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !email}>
              Logg inn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrgSetupScreen({ onDone }: { onDone: (orgId: string) => void }) {
  const [name, setName] = useState('');
  const [orgForm, setOrgForm] = useState('ENK');
  const [vatStatus, setVatStatus] = useState('registered');
  const [orgNumber, setOrgNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { name, orgForm, vatStatus };
      if (orgNumber) body['orgNumber'] = orgNumber;
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
          {error && <div className="error">{error}</div>}
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !name}>
              Opprett
            </button>
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
