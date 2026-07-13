import { useEffect, useState } from 'react';
import { api, getOrgId, isLoggedIn, logout, setOrgId, setToken } from './api';
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

type Screen =
  | { name: 'overview' }
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'gmail' }
  | { name: 'bank' }
  | { name: 'reports' }
  | { name: 'vat' }
  | { name: 'tax' };

const NAV: { key: Screen['name']; label: string }[] = [
  { key: 'overview', label: 'Oversikt' },
  { key: 'documents', label: 'Bilagsinnboks' },
  { key: 'gmail', label: 'Gmail-import' },
  { key: 'bank', label: 'Bank og avstemming' },
  { key: 'vat', label: 'MVA' },
  { key: 'tax', label: 'Skatt og reserver' },
  { key: 'reports', label: 'Rapporter' },
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
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Ledgerly</div>
        {NAV.map((item) => (
          <button
            key={item.key}
            className={screen.name === item.key ? 'active' : ''}
            onClick={() => setScreen({ name: item.key } as Screen)}
          >
            {item.label}
          </button>
        ))}
        <div className="spacer" />
        <button
          onClick={() => {
            logout();
            location.reload();
          }}
        >
          Logg ut
        </button>
      </nav>
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
        <h1>Ledgerly</h1>
        <p className="subtitle">
          Utviklingsinnlogging. Produksjon vil bruke BankID/OIDC med tofaktor.
        </p>
        <label htmlFor="email">E-post</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="name">Navn</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button className="primary" disabled={busy || !email} onClick={submit}>
            Logg inn
          </button>
        </div>
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
        <input id="orgnr" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="9 sifre" />
        {error && <div className="error">{error}</div>}
        <div className="actions">
          <button className="primary" disabled={busy || !name} onClick={submit}>
            Opprett
          </button>
        </div>
      </div>
    </div>
  );
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loader()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
