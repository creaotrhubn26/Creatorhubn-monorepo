/**
 * Virksomhetsinnstillinger: fakturaopplysningene som bokføringsforskriften
 * krever på salgsdokumenter (org.nr. + adresse), MVA-status og kontroll mot
 * MVA-registeret (Brønnøysundregistrenes åpne data). Registeret er fasit —
 * lokal MVA-status er brukerens påstand, og avvik flagges tydelig.
 */
import { useEffect, useState } from 'react';
import { api } from './api';
import { useLoad } from './App';
import { useToast } from './ui';

interface OrgProfile {
  id: string;
  name: string;
  orgNumber: string | null;
  orgForm: string;
  vatStatus: string;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  vatRegisterCheckedAt: string | null;
  vatRegisterRegistered: boolean | null;
}

interface VatCheckResult {
  found: boolean;
  registryName: string | null;
  registeredInVatRegister: boolean | null;
  localVatStatus: string;
  mismatch: boolean;
}

const VAT_STATUS_LABELS: Record<string, string> = {
  registered: 'MVA-registrert',
  not_registered: 'Ikke MVA-registrert',
  pending: 'Under registrering',
};

export function OrgSettingsScreen({ orgId }: { orgId: string }) {
  const toast = useToast();
  const profile = useLoad(
    () => api<OrgProfile>('GET', `/api/organizations/${orgId}/profile`),
    [orgId],
  );

  const [orgNumber, setOrgNumber] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [vatStatus, setVatStatus] = useState('registered');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<VatCheckResult | null>(null);

  useEffect(() => {
    if (profile.data) {
      setOrgNumber(profile.data.orgNumber ?? '');
      setStreet(profile.data.streetAddress ?? '');
      setPostalCode(profile.data.postalCode ?? '');
      setCity(profile.data.city ?? '');
      setVatStatus(profile.data.vatStatus);
    }
  }, [profile.data]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('PATCH', `/api/organizations/${orgId}/settings`, {
        ...(orgNumber ? { orgNumber } : {}),
        ...(street ? { streetAddress: street } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(city ? { city } : {}),
        vatStatus,
      });
      toast('Virksomhetsopplysningene er lagret', 'ok');
      profile.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runVatCheck = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<VatCheckResult>(
        'POST',
        `/api/organizations/${orgId}/vat-register-check`,
      );
      setCheck(res);
      toast(
        res.found
          ? res.mismatch
            ? 'Avvik mellom lokal MVA-status og MVA-registeret'
            : 'MVA-status bekreftet mot registeret'
          : 'Organisasjonsnummeret ble ikke funnet i Enhetsregisteret',
        res.found && !res.mismatch ? 'ok' : 'danger',
      );
      profile.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const missing: string[] = [];
  if (profile.data) {
    if (!profile.data.orgNumber) missing.push('organisasjonsnummer');
    if (!profile.data.streetAddress) missing.push('gateadresse');
    if (!profile.data.postalCode || !profile.data.city) missing.push('postnummer/sted');
  }

  return (
    <div>
      <div className="page-head">
        <h1>Virksomhet</h1>
        <p className="subtitle">
          Disse opplysningene skal stå på alle fakturaer (bokføringsforskriften). Fakturaer kan
          ikke utstedes før de er komplette.
        </p>
      </div>

      {profile.data && missing.length > 0 && (
        <div className="error" style={{ marginBottom: 14 }}>
          Mangler før fakturering: {missing.join(', ')}.
        </div>
      )}

      <div className="panel">
        <h2>{profile.data?.name ?? 'Virksomheten'}</h2>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <div>
            <label htmlFor="set-orgnr">Organisasjonsnummer</label>
            <input
              id="set-orgnr"
              inputMode="numeric"
              placeholder="9 sifre"
              value={orgNumber}
              onChange={(e) => setOrgNumber(e.target.value.replace(/\s/g, ''))}
            />
          </div>
          <div>
            <label htmlFor="set-vat">MVA-status</label>
            <select id="set-vat" value={vatStatus} onChange={(e) => setVatStatus(e.target.value)}>
              {Object.entries(VAT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label htmlFor="set-street">Gateadresse</label>
            <input id="set-street" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div>
            <label htmlFor="set-postal">Postnummer</label>
            <input
              id="set-postal"
              inputMode="numeric"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="set-city">Sted</label>
            <input id="set-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={save}>
            Lagre
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Kontroll mot MVA-registeret</h2>
        <p className="subtitle">
          Slår opp organisasjonsnummeret i Brønnøysundregistrenes åpne data og sammenligner med
          MVA-statusen over. Bare virksomheter i MVA-registeret kan skrive «MVA» bak org.nr. og
          kreve merverdiavgift på faktura.
        </p>
        <div className="actions">
          <button className="secondary" disabled={busy || !orgNumber} onClick={runVatCheck}>
            Sjekk mot MVA-registeret
          </button>
        </div>
        {check && (
          <div style={{ marginTop: 12 }}>
            {check.found ? (
              <>
                <p>
                  Registeret: <strong>{check.registryName}</strong> —{' '}
                  {check.registeredInVatRegister
                    ? 'registrert i MVA-registeret'
                    : 'IKKE registrert i MVA-registeret'}
                </p>
                {check.mismatch && (
                  <div className="error">
                    Avvik: lokal status er «{VAT_STATUS_LABELS[check.localVatStatus]}», men
                    registeret sier{' '}
                    {check.registeredInVatRegister ? 'registrert' : 'ikke registrert'}. Rett opp
                    statusen over, eller kontakt Skatteetaten hvis registeret er utdatert.
                  </div>
                )}
              </>
            ) : (
              <div className="error">Organisasjonsnummeret ble ikke funnet i Enhetsregisteret.</div>
            )}
          </div>
        )}
        {profile.data?.vatRegisterCheckedAt && (
          <p className="subtitle" style={{ marginTop: 8 }}>
            Sist kontrollert: {profile.data.vatRegisterCheckedAt.slice(0, 16).replace('T', ' ')} —
            resultat:{' '}
            {profile.data.vatRegisterRegistered === null
              ? 'ikke funnet'
              : profile.data.vatRegisterRegistered
                ? 'registrert'
                : 'ikke registrert'}
          </p>
        )}
      </div>
    </div>
  );
}
