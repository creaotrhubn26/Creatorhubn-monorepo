import React, { useEffect, useMemo, useState } from "react";

// Smart Stempling – MVP single-file React app
// - LocalStorage persistence
// - Clock In/Out + manual add
// - Mandag–fredag fokus i rapporter
// - Gjenkjenning av repetisjoner pr. måned: Tittel + Aktivitet + Ukedag
// - Månedsstatistikk + enkel loggtabell + hurtigvalg
// - Timesats (kr/t) med beløp pr. rad og estimert månedslønn

// ---------- Typer ----------
type Activity = "Work" | "Meeting";

// Norsk visningsnavn for aktivitet
function activityLabel(a: Activity): string {
  return a === "Work" ? "Arbeid" : "Møte";
}

type LogRow = {
  id: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:MM (24t)
  end: string;   // HH:MM (24t)
  breakHours: number; // desimaltimer
  activity: Activity;
  title: string;
  project?: string;
  place?: string;
  notes?: string;
  createdAt: number;
};

// ---------- Hjelpere ----------
const LS_KEY = "smart-stempling-logs-v1";
const LS_ACTIVE_CLOCK = "smart-stempling-active-clock";
const LS_RATE = "smart-stempling-hourly-rate";

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function nowTimeStr(d = new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function parseHM(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToHours(mins: number) { return mins / 60; }

function isMonToFri(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const wd = d.getDay(); // 0=søn..6=lør
  return wd >= 1 && wd <= 5;
}

function weekdayName(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString('nb-NO', { weekday: "short" });
}

function monthKey(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}`;
}

function recurrenceKey(row: LogRow) {
  return `${monthKey(row.date)}|${weekdayName(row.date)}|${row.activity}|${row.title.trim().toLowerCase()}`;
}

function computeHours(row: LogRow) {
  const durMins = Math.max(0, parseHM(row.end) - parseHM(row.start));
  const hours = minutesToHours(durMins) - (row.breakHours || 0);
  return Math.max(0, Number.isFinite(hours) ? hours : 0);
}

function uuid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function nok(n: number) {
  try {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} kr`;
  }
}

// ---------- Lagring ----------
function loadLogs(): LogRow[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveLogs(rows: LogRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

// ---------- Enkle selvtester ----------
function runSelfTests() {
  // 1) timeberegning
  const r1: LogRow = { id: "t1", date: "2025-11-03", start: "08:00", end: "12:00", breakHours: 0.5, activity: "Work", title: "Test", createdAt: 0 };
  console.assert(Math.abs(computeHours(r1) - 3.5) < 1e-9, "computeHours feilet");
  // 2) månednøkkel
  console.assert(monthKey("2025-11-03") === "202511", "monthKey feilet");
  // 3) recurrenceKey stabilitet
  const rk = recurrenceKey(r1);
  console.assert(rk.toLowerCase().includes("work") && rk.includes("202511"), "recurrenceKey feilet");
  // 4) parseHM/minutesToHours
  console.assert(parseHM("01:30") === 90, "parseHM 01:30 feilet");
  console.assert(minutesToHours(150) === 2.5, "minutesToHours 150->2.5 feilet");
}
runSelfTests();

// ---------- Timesats (manuell, stabil caret & layout) ----------
const nbFormatter = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Renser inndata: tall + maks én separator (komma eller punktum). Normaliserer til komma i feltet. */
function sanitizeRateInputManual(raw: string): string {
  let result = "";
  let seenSep = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if ((ch === ',' || ch === '.') && !seenSep) {
      result += ','; // normaliser til komma
      seenSep = true;
    }
  }
  return result;
}

/** Fjerner alle typer mellomrom (inkl. smale) fra formatert tekst. */
function stripAllSpaces(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch !== ' ' && ch !== '\u00A0' && ch !== '\u202F') out += ch;
  }
  return out;
}

/** Parser tekst der komma eller punktum kan være desimaltegn. */
function parseRateManual(text: string): number {
  const normalized = (text || "").split(".").join(",").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Kontrollert input for timesats. Ingen live-reformattering, kun tegnfiltrering. */
function RateInputManual({ value, onChange }: { value: string; onChange: (v: string) => void; }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-300">Timesats</label>
      <input
        type="text"
        inputMode="decimal"
        className="bg-black/30 rounded-xl px-3 py-2 border border-white/10 w-36 min-w-[9rem] text-right tabular-nums"
        placeholder="kr/t"
        value={value}
        onChange={(e) => {
          onChange(sanitizeRateInputManual(e.target.value));
        }}
        onBlur={() => {
          const n = parseRateManual(value);
          if (!isNaN(n)) {
            const formatted = stripAllSpaces(nbFormatter.format(n));
            onChange(formatted);
          }
        }}
      />
      <span className="text-sm text-slate-400">kr/t</span>
    </div>
  );
}

// Ekstra selvtester (timesats)
console.assert(parseRateManual("250") === 250, "rate parse 250 feilet");
console.assert(parseRateManual("250,5") === 250.5, "rate parse 250,5 feilet");
console.assert(parseRateManual("250.75") === 250.75, "rate parse 250.75 feilet");
console.assert(sanitizeRateInputManual("2,,5") === "2,5", "sanitize dobbelt komma feilet");
console.assert(sanitizeRateInputManual("2..5") === "2,5", "sanitize dobbelt punktum feilet");

// ---------- Komponent ----------
export default function App() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [month, setMonth] = useState<string>(() => monthKey(todayStr()));
  const [activity, setActivity] = useState<Activity>("Work");
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string>(todayStr());
  const [start, setStart] = useState<string>(nowTimeStr());
  const [end, setEnd] = useState<string>(nowTimeStr());
  const [breakHours, setBreakHours] = useState<number>(0);
  const [hourlyRateInput, setHourlyRateInput] = useState<string>(() => {
    const s = localStorage.getItem(LS_RATE);
    return s ?? "";
  });
  const hourlyRate = useMemo(() => {
    const n = parseRateManual(hourlyRateInput);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [hourlyRateInput]);

  // Aktiv klokke
  const [activeClock, setActiveClock] = useState<null | {
    startedAtISO: string; // dato
    startedTime: string; // HH:MM
    activity: Activity;
    title: string;
    project?: string;
    place?: string;
  }>(null);

  // Last ved mount
  useEffect(() => {
    setRows(loadLogs());
    try {
      const ac = localStorage.getItem(LS_ACTIVE_CLOCK);
      if (ac) setActiveClock(JSON.parse(ac));
    } catch {}
  }, []);

  // Persist
  useEffect(() => { saveLogs(rows); }, [rows]);
  useEffect(() => {
    if (activeClock) localStorage.setItem(LS_ACTIVE_CLOCK, JSON.stringify(activeClock));
    else localStorage.removeItem(LS_ACTIVE_CLOCK);
  }, [activeClock]);
  useEffect(() => {
    localStorage.setItem(LS_RATE, hourlyRateInput);
  }, [hourlyRateInput]);

  // Månedsliste
  const months = useMemo(() => {
    const s = new Set(rows.map(r => monthKey(r.date)));
    const arr = Array.from(s);
    arr.sort();
    return arr;
  }, [rows]);

  // Filtrer rader pr. valgt måned
  const monthRows = useMemo(() => rows.filter(r => monthKey(r.date) === month), [rows, month]);

  // Statistikk (kun man–fre)
  const stats = useMemo(() => {
    let total = 0, work = 0, meeting = 0, days = new Set<string>();
    monthRows.forEach(r => {
      if (!isMonToFri(r.date)) return;
      const h = computeHours(r);
      total += h;
      if (r.activity === "Work") work += h; else meeting += h;
      days.add(r.date);
    });
    return { total, work, meeting, days: days.size, earnings: total * hourlyRate };
  }, [monthRows, hourlyRate]);

  // Repetisjoner denne måneden
  const recurrenceMap = useMemo(() => {
    const map = new Map<string, { key: string; count: number; sample: LogRow }>();
    monthRows.forEach(r => {
      const key = recurrenceKey(r);
      const old = map.get(key);
      if (old) old.count += 1; else map.set(key, { key, count: 1, sample: r });
    });
    return Array.from(map.values()).filter(x => x.count > 1).sort((a,b) => b.count - a.count);
  }, [monthRows]);

  // Legg til manuelt
  function addRow() {
    if (!date || !start || !end) return alert("Fyll inn Dato, Inn og Ut.");
    const newRow: LogRow = {
      id: uuid(), date, start, end, breakHours: Number(breakHours)||0,
      activity, title: title.trim(), project: project.trim()||undefined,
      place: place.trim()||undefined, notes: notes.trim()||undefined, createdAt: Date.now()
    };
    setRows(prev => [newRow, ...prev]);
  }

  function deleteRow(id: string) {
    if (!confirm("Slette denne raden?")) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  // Stemple inn/ut
  function handleClockIn() {
    if (activeClock) return;
    if (!title.trim()) return alert("Skriv en tittel før du stempler inn.");
    setActiveClock({
      startedAtISO: todayStr(),
      startedTime: nowTimeStr(),
      activity,
      title: title.trim(),
      project: project.trim() || undefined,
      place: place.trim() || undefined,
    });
  }

  function handleClockOut() {
    if (!activeClock) return;
    const endTime = nowTimeStr();
    const newRow: LogRow = {
      id: uuid(),
      date: activeClock.startedAtISO,
      start: activeClock.startedTime,
      end: endTime,
      breakHours: 0,
      activity: activeClock.activity,
      title: activeClock.title,
      project: activeClock.project,
      place: activeClock.place,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };
    setRows(prev => [newRow, ...prev]);
    setActiveClock(null);
  }

  // Hurtigvalg
  const quicks: Array<{label: string, activity: Activity, title: string}> = [
    { label: "Arbeid", activity: "Work", title: "Fokusarbeid" },
    { label: "Daglig standup", activity: "Meeting", title: "Standup" },
    { label: "Kundemøte", activity: "Meeting", title: "Kundemøte" },
  ];

  // UI-hjelper
  const Card: React.FC<React.PropsWithChildren<{className?: string}>> = ({className, children}) => (
    <div className={`rounded-2xl shadow p-4 bg-white/5 border border-white/10 ${className||""}`}>{children}</div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Smart Stempling</h1>
          <p className="text-slate-300 mt-1">MVP • Lokal lagring • Fokus: mandag–fredag i rapporter • Gjentakelser per måned</p>
        </header>

        {/* Kontrollrad */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <Card>
            <h2 className="font-medium mb-3">Stempling</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button className="rounded-xl border border-white/10 px-3 py-2 hover:bg-white/10" onClick={() => setActivity("Work")}>Arbeid</button>
              <button className="rounded-xl border border-white/10 px-3 py-2 hover:bg-white/10" onClick={() => setActivity("Meeting")}>Møte</button>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Tittel / Møte" value={title} onChange={e=>setTitle(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Prosjekt / Kunde" value={project} onChange={e=>setProject(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Sted / Modus" value={place} onChange={e=>setPlace(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Notater (valgfritt)" value={notes} onChange={e=>setNotes(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              {!activeClock ? (
                <button onClick={handleClockIn} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-medium">Stemple INN</button>
              ) : (
                <button onClick={handleClockOut} className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 font-medium">Stemple UT</button>
              )}
              {activeClock && (
                <span className="text-sm text-slate-300">Startet {activeClock.startedAtISO} kl. {activeClock.startedTime} – {activityLabel(activeClock.activity)} • {activeClock.title}</span>
              )}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {quicks.map(q => (
                <button key={q.label} onClick={() => { setActivity(q.activity); setTitle(q.title); }} className="text-xs rounded-full border border-white/10 px-3 py-1 hover:bg-white/10">
                  {q.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-medium mb-3">Legg til manuelt</h2>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" value={date} onChange={e=>setDate(e.target.value)} />
              <select className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" value={activity} onChange={e=>setActivity(e.target.value as Activity)}>
                <option value="Work">Arbeid</option>
                <option value="Meeting">Møte</option>
              </select>
              <input type="time" className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" value={start} onChange={e=>setStart(e.target.value)} />
              <input type="time" className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" value={end} onChange={e=>setEnd(e.target.value)} />
              <input type="number" step="0.25" className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Pause (timer)" value={breakHours} onChange={e=>setBreakHours(Number(e.target.value))} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Tittel / Møte" value={title} onChange={e=>setTitle(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Prosjekt / Kunde" value={project} onChange={e=>setProject(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" placeholder="Sted / Modus" value={place} onChange={e=>setPlace(e.target.value)} />
              <input className="bg-black/30 rounded-xl px-3 py-2 border border-white/10 col-span-2" placeholder="Notater" value={notes} onChange={e=>setNotes(e.target.value)} />
            </div>
            <div className="mt-3">
              <button onClick={addRow} className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 font-medium">Legg til</button>
            </div>
          </Card>

          <Card>
            <h2 className="font-medium mb-3">Månedsfilter og nøkkeltall</h2>
            <div className="flex gap-2 mb-3 flex-wrap items-center">
              <select className="bg-black/30 rounded-xl px-3 py-2 border border-white/10" value={month} onChange={e=>setMonth(e.target.value)}>
                {[...new Set([month, ...months])].sort().map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button className="rounded-xl border border-white/10 px-3 py-2 hover:bg-white/10" onClick={() => setMonth(monthKey(todayStr()))}>Denne måneden</button>
              <RateInputManual value={hourlyRateInput} onChange={setHourlyRateInput} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-slate-300">Totale timer (man–fre)</div>
                <div className="text-xl font-semibold">{stats.total.toFixed(2)}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-slate-300">Arbeid</div>
                <div className="text-xl font-semibold">{stats.work.toFixed(2)}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-slate-300">Møter</div>
                <div className="text-xl font-semibold">{stats.meeting.toFixed(2)}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10">
                <div className="text-slate-300">Dager logget</div>
                <div className="text-xl font-semibold">{stats.days}</div>
              </div>
              <div className="rounded-xl bg-black/30 p-3 border border-white/10 col-span-2">
                <div className="text-slate-300">Estimert lønn (man–fre)</div>
                <div className="text-xl font-semibold">{nok(stats.earnings)}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Gjentakelser */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Gjentakelser i {month}</h2>
            <span className="text-sm text-slate-400">Gjenkjenner pr. Tittel + Aktivitet + Ukedag</span>
          </div>
          {recurrenceMap.length === 0 ? (
            <p className="text-slate-400">Ingen gjentakelser registrert denne måneden enda.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recurrenceMap.map(({key, count, sample}) => (
                <div key={key} className="rounded-xl bg-black/30 p-3 border border-white/10">
                  <div className="text-sm text-slate-300">{weekdayName(sample.date)} • {activityLabel(sample.activity)}</div>
                  <div className="font-semibold">{sample.title || <em className="text-slate-400">(uten tittel)</em>}</div>
                  <div className="text-sm text-slate-400 mt-1">Antall: {count}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Loggtabell */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Logg for {month}</h2>
            <div className="text-sm text-slate-400">Kun mandag–fredag inngår i summer</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-300">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Dato</th>
                  <th className="py-2 pr-3">Ukedag</th>
                  <th className="py-2 pr-3">Inn</th>
                  <th className="py-2 pr-3">Ut</th>
                  <th className="py-2 pr-3">Pause</th>
                  <th className="py-2 pr-3">Timer</th>
                  <th className="py-2 pr-3">Aktivitet</th>
                  <th className="py-2 pr-3">Tittel</th>
                  <th className="py-2 pr-3">Prosjekt</th>
                  <th className="py-2 pr-3">Sted</th>
                  <th className="py-2 pr-3">Notater</th>
                  <th className="py-2 pr-3">Beløp</th>
                  <th className="py-2 pr-3">Slett</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.length === 0 ? (
                  <tr><td colSpan={13} className="py-6 text-center text-slate-400">Ingen rader i denne måneden ennå.</td></tr>
                ) : (
                  monthRows.sort((a,b)=>b.createdAt-a.createdAt).map(r => {
                    const hours = computeHours(r);
                    const amount = isMonToFri(r.date) ? hours * hourlyRate : 0;
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                        <td className="py-2 pr-3">{weekdayName(r.date)}</td>
                        <td className="py-2 pr-3">{r.start}</td>
                        <td className="py-2 pr-3">{r.end}</td>
                        <td className="py-2 pr-3">{r.breakHours || 0}</td>
                        <td className="py-2 pr-3">{isMonToFri(r.date) ? hours.toFixed(2) : <span className="text-slate-500">0.00*</span>}</td>
                        <td className="py-2 pr-3">{activityLabel(r.activity)}</td>
                        <td className="py-2 pr-3">{r.title}</td>
                        <td className="py-2 pr-3">{r.project || ""}</td>
                        <td className="py-2 pr-3">{r.place || ""}</td>
                        <td className="py-2 pr-3">{r.notes || ""}</td>
                        <td className="py-2 pr-3">{nok(amount)}</td>
                        <td className="py-2 pr-3">
                          <button onClick={() => deleteRow(r.id)} className="text-rose-300 hover:text-rose-200">Slett</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">* Timer fra lør/søn vises som 0.00 i summeringer.</p>
        </Card>

        <footer className="mt-8 text-xs text-slate-500">
          Laget for Norwedfilm • Lokal prototype. Eksport til CSV/Google Sheets og multi-bruker kan legges til senere.
        </footer>
      </div>
    </div>
  );
}
