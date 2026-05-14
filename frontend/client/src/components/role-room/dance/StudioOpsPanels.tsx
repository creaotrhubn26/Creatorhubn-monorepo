/**
 * Studio-ops-panelene — én fil for de 4 tynne wrappere som re-bruker
 * EntityCrudPanel. Hver eksporterer en Connected-komponent som
 * DanceWorkspace mounter direkte.
 */

import React from 'react';
import { Box, Typography, Stack, Chip } from '@mui/material';
import { EntityCrudPanel, type EntityField } from './EntityCrudPanel';
import * as svc from './danceStudioOpsService';

const PURPLE_LIGHT = '#a78bfa';

export interface StudioPanelProps {
  projectId: string | null;
}

// ─── Classes ────────────────────────────────────────────────────────────

export const ClassesPanel: React.FC<StudioPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'title', label: 'Tittel', type: { kind: 'text', required: true } },
    {
      key: 'kind', label: 'Type', type: {
        kind: 'select',
        options: [
          { value: 'semester', label: 'Semester' },
          { value: 'drop_in', label: 'Drop-in' },
          { value: 'workshop', label: 'Workshop' },
          { value: 'private', label: 'Privattime' },
        ],
      },
    },
    { key: 'schedulePattern', label: 'Skjema', type: { kind: 'text', placeholder: 'Mandag 18:00–19:30' } },
    { key: 'startsAt', label: 'Start', type: { kind: 'datetime' } },
    { key: 'endsAt', label: 'Slutt', type: { kind: 'datetime' } },
    { key: 'maxStudents', label: 'Maks elever', type: { kind: 'number', min: 0, max: 200 } },
    { key: 'priceKr', label: 'Pris (kr)', type: { kind: 'number', min: 0 } },
    { key: 'description', label: 'Beskrivelse', type: { kind: 'text', multiline: true } },
  ];
  return (
    <EntityCrudPanel<svc.DanceClass>
      title="Klasser"
      description="Semester, drop-in og workshops. Påmeldinger åpnes ved å klikke en rad."
      fields={fields}
      primaryField="title"
      searchableFields={['title', 'description']}
      list={() => svc.listClasses(projectId)}
      create={(input) => svc.createClass({ ...input, projectId, title: input.title ?? 'Ny klasse' })}
      patch={svc.patchClass}
      remove={svc.deleteClass}
      newDefaults={{ kind: 'semester' }}
      rowExpansion={(row) => <ClassEnrollments classId={row.id} />}
      emptyText="Ingen klasser ennå. Opprett din første for å begynne påmelding."
      panelTestId="studio-ops-classes"
    />
  );
};

const ClassEnrollments: React.FC<{ classId: string }> = ({ classId }) => {
  const [enrollments, setEnrollments] = React.useState<svc.DanceClassEnrollment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [newDancerId, setNewDancerId] = React.useState('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try { setEnrollments(await svc.listEnrollments(classId)); }
    finally { setLoading(false); }
  }, [classId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <Box>
      <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700, mb: 1 }}>
        PÅMELDINGER ({enrollments.length})
      </Typography>
      {loading ? (
        <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)' }}>Laster…</Typography>
      ) : (
        <Stack spacing={0.5}>
          {enrollments.map((e) => (
            <Stack key={e.id} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 12, flex: 1, color: '#e5e7eb' }}>{e.studentDancerId}</Typography>
              <Chip
                size="small"
                label={e.paymentStatus}
                onClick={async () => {
                  const order: svc.EnrollmentPaymentStatus[] = ['unpaid', 'invoiced', 'paid', 'comp'];
                  const next = order[(order.indexOf(e.paymentStatus) + 1) % order.length];
                  await svc.patchEnrollment(e.id, { paymentStatus: next });
                  await refresh();
                }}
                sx={{
                  height: 20, fontSize: 10, cursor: 'pointer',
                  bgcolor: e.paymentStatus === 'paid' ? 'rgba(16,185,129,0.18)' :
                    e.paymentStatus === 'invoiced' ? 'rgba(251,191,36,0.18)' :
                    e.paymentStatus === 'comp' ? 'rgba(167,139,250,0.18)' : 'rgba(239,68,68,0.18)',
                  color: e.paymentStatus === 'paid' ? '#10b981' :
                    e.paymentStatus === 'invoiced' ? '#fbbf24' :
                    e.paymentStatus === 'comp' ? PURPLE_LIGHT : '#fca5a5',
                  fontWeight: 700,
                }}
              />
              <Chip
                size="small"
                label="Slett"
                onClick={async () => {
                  if (!window.confirm('Slett påmelding?')) return;
                  await svc.deleteEnrollment(e.id);
                  await refresh();
                }}
                sx={{ height: 20, fontSize: 10, cursor: 'pointer', bgcolor: 'rgba(239,68,68,0.10)', color: '#fca5a5' }}
              />
            </Stack>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <input
          placeholder="Danser-ID"
          value={newDancerId}
          onChange={(e) => setNewDancerId(e.target.value)}
          style={{
            flex: 1, padding: '6px 8px', fontSize: 11,
            background: '#0a0a0a', color: '#e5e7eb',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 4,
          }}
        />
        <Chip
          size="small"
          label={adding ? 'Legger til…' : 'Legg til'}
          disabled={adding || !newDancerId.trim()}
          onClick={async () => {
            if (!newDancerId.trim()) return;
            setAdding(true);
            try {
              await svc.createEnrollment({ classId, studentDancerId: newDancerId.trim() });
              setNewDancerId('');
              await refresh();
            } finally { setAdding(false); }
          }}
          sx={{ height: 24, fontSize: 11, cursor: 'pointer', bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 700 }}
        />
      </Stack>
    </Box>
  );
};

// ─── Instructors ────────────────────────────────────────────────────────

export const InstructorsPanel: React.FC<StudioPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'displayName', label: 'Navn', type: { kind: 'text', required: true } },
    { key: 'email', label: 'E-post', type: { kind: 'text' } },
    { key: 'phone', label: 'Telefon', type: { kind: 'text' } },
    {
      key: 'contractKind', label: 'Kontrakt', type: {
        kind: 'select',
        options: [
          { value: 'enk_freelance', label: 'Frilans (ENK)' },
          { value: 'employee', label: 'Ansatt' },
          { value: 'guest', label: 'Gjest' },
        ],
      },
    },
    { key: 'hourlyRateKr', label: 'Timepris (kr)', type: { kind: 'number', min: 0 } },
    { key: 'styles', label: 'Stiler', type: { kind: 'string-array', placeholder: 'jazz, kontemporær, hip-hop' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
    {
      key: 'hoursLogged', label: 'Timer denne måneden', type: { kind: 'text' }, listOnly: true,
      renderInList: (value) => {
        if (!Array.isArray(value)) return null;
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const total = (value as svc.InstructorHoursEntry[])
          .filter((e) => e.ymd.startsWith(ym))
          .reduce((sum, e) => sum + e.hours, 0);
        return `${total}t`;
      },
    },
  ];
  return (
    <EntityCrudPanel<svc.DanceInstructor>
      title="Instruktører"
      description="Roster med timer-logg. Frilansere ser timer levert per måned."
      fields={fields}
      primaryField="displayName"
      searchableFields={['displayName', 'email']}
      list={() => svc.listInstructors(projectId)}
      create={(input) => svc.createInstructor({ ...input, projectId, displayName: input.displayName ?? 'Ny instruktør' })}
      patch={svc.patchInstructor}
      remove={svc.deleteInstructor}
      newDefaults={{ contractKind: 'enk_freelance', styles: [] }}
      emptyText="Ingen instruktører ennå."
      panelTestId="studio-ops-instructors"
    />
  );
};

// ─── Rooms ──────────────────────────────────────────────────────────────

export const RoomsPanel: React.FC<StudioPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'name', label: 'Navn', type: { kind: 'text', required: true } },
    {
      key: 'roomKind', label: 'Type', type: {
        kind: 'select',
        options: [
          { value: 'mirror_studio', label: 'Speilsal' },
          { value: 'sprung_floor', label: 'Sprung-floor' },
          { value: 'ballet', label: 'Ballett' },
          { value: 'rehearsal', label: 'Øvingsrom' },
          { value: 'theater', label: 'Teater' },
        ],
      },
    },
    { key: 'capacity', label: 'Kapasitet', type: { kind: 'number', min: 0, max: 500 } },
    { key: 'hasSprungFloor', label: 'Sprung-floor', type: { kind: 'boolean' } },
    { key: 'hasMirror', label: 'Speilvegg', type: { kind: 'boolean' } },
    { key: 'hasSoundSystem', label: 'Lydanlegg', type: { kind: 'boolean' } },
    { key: 'address', label: 'Adresse', type: { kind: 'text' } },
    { key: 'notes', label: 'Notater', type: { kind: 'text', multiline: true } },
  ];
  return (
    <EntityCrudPanel<svc.DanceRoom>
      title="Saler"
      description="Speil-saler, ballettsaler, dansestudioer. Klikk en sal for å se bookinger."
      fields={fields}
      primaryField="name"
      searchableFields={['name', 'address']}
      list={() => svc.listRooms(projectId)}
      create={(input) => svc.createRoom({ ...input, projectId, name: input.name ?? 'Ny sal' })}
      patch={svc.patchRoom}
      remove={svc.deleteRoom}
      newDefaults={{ roomKind: 'mirror_studio', hasMirror: true, hasSprungFloor: false, hasSoundSystem: false }}
      rowExpansion={(row) => <RoomBookings roomId={row.id} />}
      emptyText="Ingen saler ennå."
      panelTestId="studio-ops-rooms"
    />
  );
};

const RoomBookings: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [bookings, setBookings] = React.useState<svc.DanceRoomBooking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [purpose, setPurpose] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [endsAt, setEndsAt] = React.useState('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try { setBookings(await svc.listBookings({ roomId })); }
    finally { setLoading(false); }
  }, [roomId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <Box>
      <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700, mb: 1 }}>
        BOOKINGER ({bookings.length})
      </Typography>
      {loading ? (
        <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)' }}>Laster…</Typography>
      ) : bookings.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)' }}>Ingen bookinger.</Typography>
      ) : (
        <Stack spacing={0.5}>
          {bookings.map((b) => (
            <Stack key={b.id} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 11, flex: 1, color: '#e5e7eb' }}>
                {new Date(b.startsAt).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {' → '}
                {new Date(b.endsAt).toLocaleString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                {b.purpose ? ` · ${b.purpose}` : ''}
              </Typography>
              <Chip
                size="small"
                label="Slett"
                onClick={async () => {
                  if (!window.confirm('Slett booking?')) return;
                  await svc.deleteBooking(b.id);
                  await refresh();
                }}
                sx={{ height: 20, fontSize: 10, cursor: 'pointer', bgcolor: 'rgba(239,68,68,0.10)', color: '#fca5a5' }}
              />
            </Stack>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <input
          placeholder="Formål"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          style={{
            flex: 2, padding: '6px 8px', fontSize: 11,
            background: '#0a0a0a', color: '#e5e7eb',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 4,
          }}
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          style={{
            flex: 1, padding: '6px 8px', fontSize: 11,
            background: '#0a0a0a', color: '#e5e7eb',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 4,
          }}
        />
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          style={{
            flex: 1, padding: '6px 8px', fontSize: 11,
            background: '#0a0a0a', color: '#e5e7eb',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 4,
          }}
        />
        <Chip
          size="small"
          label="Book"
          onClick={async () => {
            if (!startsAt || !endsAt) return;
            await svc.createBooking({
              roomId,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
              purpose: purpose || null,
            });
            setPurpose(''); setStartsAt(''); setEndsAt('');
            await refresh();
          }}
          sx={{ height: 24, fontSize: 11, cursor: 'pointer', bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 700 }}
        />
      </Stack>
    </Box>
  );
};

// ─── Movement Vocab ─────────────────────────────────────────────────────

export const MovementVocabPanel: React.FC<StudioPanelProps> = ({ projectId }) => {
  const fields: EntityField[] = [
    { key: 'term', label: 'Term', type: { kind: 'text', required: true } },
    {
      key: 'category', label: 'Kategori', type: {
        kind: 'select',
        options: [
          { value: 'turn', label: 'Turn' },
          { value: 'leap', label: 'Leap' },
          { value: 'lift', label: 'Lift' },
          { value: 'extension', label: 'Extension' },
          { value: 'partnering', label: 'Partnering' },
          { value: 'improv', label: 'Improv' },
          { value: 'other', label: 'Annet' },
        ],
      },
    },
    { key: 'definition', label: 'Definisjon', type: { kind: 'text', multiline: true, required: true } },
    { key: 'aliases', label: 'Aliaser', type: { kind: 'string-array', placeholder: 'pirouette, drei' } },
    {
      key: 'difficulty', label: 'Vanskelighet', type: {
        kind: 'select',
        options: [
          { value: 'beginner', label: 'Nybegynner' },
          { value: 'intermediate', label: 'Mellom' },
          { value: 'advanced', label: 'Avansert' },
          { value: 'pro', label: 'Pro' },
        ],
      },
    },
    { key: 'referenceVideoUrl', label: 'Video-ref (URL)', type: { kind: 'text', placeholder: 'https://vimeo.com/...' } },
  ];
  return (
    <EntityCrudPanel<svc.MovementVocabTerm>
      title="Bevegelses-vokabular"
      description="Standardisert terminologi som koreografer og instruktører kan referere konsistent."
      fields={fields}
      primaryField="term"
      searchableFields={['term', 'definition', 'aliases']}
      list={() => svc.listVocab(projectId)}
      create={(input) => svc.createVocab({ ...input, projectId, term: input.term ?? 'Ny term', definition: input.definition ?? '' })}
      patch={svc.patchVocab}
      remove={svc.deleteVocab}
      newDefaults={{ category: 'other', aliases: [] }}
      emptyText="Ingen termer ennå. Bygg ordboka når du møter terminologi som er uklar."
      panelTestId="studio-ops-movement-vocab"
    />
  );
};

export default {
  ClassesPanel, InstructorsPanel, RoomsPanel, MovementVocabPanel,
};
