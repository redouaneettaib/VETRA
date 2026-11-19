'use client';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  BellRing,
  Eye,
  FileSpreadsheet,
  FileText,
  Building2,
  ListChecks,
  CircleDashed,
  Pencil,
  Send,
  BadgeCheck,
  RotateCcw,
  CirclePercent,
  Users,
  KeyRound,
} from 'lucide-react';

import CanevasTable from './CanevasTable';
import Reporting from './Reporting';
import ReportShare from './ReportShare';
import ReportEmail from './ReportEmail';
import LoginScreen from './LoginScreen';
import PasswordChange from './PasswordChange';
import RubricIcon from './RubricIcon';
import { enabledRubrics, rubricIds } from '@/lib/forms';

function Brand() {
  return (
    <div className="brand">
      <img src="/onssa-transparent.png" alt="ONSSA" />
      <img src="/VETRA_officiel.jpg" alt="VETRA" />
    </div>
  );
}

type Any = Record<string, any>;
type Tab = 'dashboard' | 'saisie' | 'rapports' | 'reporting' | 'admin';
async function api(path: string, data?: Any) {
  const r = await fetch('/api/' + path, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const x = await r.json();
  if (!r.ok) throw Error(x.error || 'Erreur serveur');
  return x;
}
export default function Home() {
  const [me, setMe] = useState<Any | null>(null),
    [org, setOrg] = useState<Any>({
      services: [],
      regions: [],
      divisions: [],
      users: [],
    }),
    [canevas, setCanevas] = useState<Any>({ rubrics: [], rows: [] }),
    [reports, setReports] = useState<Any[]>([]),
    [tab, setTab] = useState<Tab>('dashboard'),
    [month, setMonth] = useState(new Date().getMonth() + 1),
    [year, setYear] = useState(new Date().getFullYear()),
    [service, setService] = useState(''),
    [rubric, setRubric] = useState('I.A.1'),
    [values, setValues] = useState<Any>({}),
    [statusFilter, setStatusFilter] = useState('TOUS'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [draftStep, setDraftStep] = useState(0);
  const tell = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(''), 6000);
  };
  async function reload() {
    const u = await api('me');
    setMe(u);
    const [o, c, r] = await Promise.all([
      api('org'),
      api('canevas'),
      api(`reports?year=${year}&month=${month}`),
    ]);
    setOrg(o);
    setCanevas(c);
    setReports(r);
    setLoadedPeriod(year + '-' + month);
    setService((prev) =>
      o.services.some((s: Any) => s.id === prev)
        ? prev
        : u.user.serviceId || o.services[0]?.id || '',
    );
  }
  useEffect(() => {
    reload().catch(() => setMe(null));
  }, []);
  useEffect(() => {
    if (!me) return;
    let active = true;
    api(`reports?year=${year}&month=${month}`)
      .then((r) => {
        if (active) {
          setReports(r);
          setLoadedPeriod(year + '-' + month);
        }
      })
      .catch((e) => {
        if (active) tell(e.message);
      });
    return () => {
      active = false;
    };
  }, [year, month]);
  const selectedService = org.services.find((s: Any) => s.id === service);
  const current = reports.find(
    (r) => r.serviceId === service && r.year === year && r.month === month,
  );
  const permittedSections = selectedService
    ? enabledRubrics(selectedService.rights)
    : [];
  const [loadedPeriod, setLoadedPeriod] = useState('');
  const periodReady = loadedPeriod === year + '-' + month;
  const [serviceKind, setServiceKind] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const dashboardServices = org.services.filter(
    (s: Any) =>
      (!serviceKind || s.kind === serviceKind) &&
      (!regionFilter || s.division.regionId === regionFilter),
  );
  const reportByService = new Map(
    reports
      .filter((r) => r.year === year && r.month === month)
      .map((r) => [r.serviceId, r]),
  );
  const [adminSection, setAdminSection] = useState('organisation');
  const [unvalidatedOnly, setUnvalidatedOnly] = useState(false);
  const unvalidatedReports = periodReady
    ? reports.filter((report) => report.status !== 'VALIDE')
    : [];
  const [adminRole, setAdminRole] = useState('CHEF_SERVICE');
  const [editingService, setEditingService] = useState('');
  const storedSteps: Array<string> = Array.isArray(values.__completed)
    ? values.__completed
    : [];
  const firstMissing = permittedSections.findIndex(
    (id) => !storedSteps.includes(id),
  );
  const completedSteps =
    firstMissing < 0
      ? permittedSections
      : permittedSections.slice(0, firstMissing);
  const nextSection = permittedSections.find(
    (id) => !completedSteps.includes(id),
  );
  const sectionGroup = (id: string) => id.split('.')[0];
  const editable =
    periodReady &&
    !!selectedService &&
    me?.user.role === 'CHEF_SERVICE' &&
    (!current || ['BROUILLON', 'REVOQUE', 'CORRIGE'].includes(current.status));
  const assigned =
    org.services.find((s: Any) => s.id === service)?.rights || [];
  const enabled = (id: string) =>
    !assigned.length ||
    assigned.some((x: Any) => x.rubricId === id && x.enabled);
  useEffect(() => {
    if (!periodReady) return;
    const history = Array.isArray(current?.data?.__completed)
      ? current.data.__completed
      : [];
    const missing = permittedSections.findIndex((id) => !history.includes(id));
    const completed =
      missing < 0 ? permittedSections : permittedSections.slice(0, missing);
    setValues(current?.data || {});
    setRubric((prev) =>
      permittedSections.includes(prev as (typeof rubricIds)[number]) &&
      (!editable ||
        completed.some((id) => id === prev) ||
        prev === permittedSections.find((id) => !completed?.includes(id)))
        ? prev
        : editable
          ? (permittedSections.find((id) => !completed?.includes(id)) ??
            permittedSections[0] ??
            '')
          : (permittedSections[0] ?? ''),
    );
  }, [
    current?.id,
    current?.updatedAt,
    service,
    year,
    month,
    periodReady,
    permittedSections.join(','),
  ]);
  const cards: Any = {
    BROUILLON: 0,
    SOUMIS: 0,
    REVOQUE: 0,
    CORRIGE: 0,
    VALIDE: 0,
    'NON INTRODUIT': 0,
  };
  for (const item of dashboardServices)
    cards[reportByService.get(item.id)?.status || 'NON INTRODUIT']++;
  async function completeRubric() {
    if (!editable) return;
    const next = {
      ...values,
      __completed: [...new Set([...completedSteps, rubric])],
    };
    setBusy(true);
    try {
      await api('report', {
        serviceId: service,
        year,
        month,
        version: current?.updatedAt,
        data: next,
      });
      const n = permittedSections.find((id) => !next.__completed.includes(id));
      await reload();
      if (n) setRubric(n);
      tell(
        n
          ? 'Rubrique enregistrée. Étape suivante déverrouillée.'
          : 'Toutes les rubriques sont complétées. Rapport prêt à soumettre.',
      );
    } catch (e: any) {
      tell(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const x = await api('report', {
        serviceId: service,
        year,
        month,
        version: current?.updatedAt,
        data: { ...values, __completed: completedSteps },
      });
      await reload();
      tell('Brouillon enregistré');
      return x;
    } catch (e: any) {
      tell(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, act: string) {
    let reason = '';
    if (act === 'revoquer') {
      reason = prompt('Motif obligatoire de révocation :') || '';
      if (!reason.trim()) return;
    } else if (
      !confirm(
        act === 'valider'
          ? 'Valider définitivement le rapport complet ?'
          : 'Soumettre le rapport mensuel complet ?',
      )
    )
      return;
    try {
      if (act === 'soumettre') {
        if (nextSection) {
          tell('Complétez d’abord la rubrique ' + nextSection);
          return;
        }
        const r = await save();
        if (!r) return;
        id = r.id;
      }
      await api('workflow', { id, action: act, reason });
      await reload();
      tell('Rapport ' + act);
    } catch (e: any) {
      tell(e.message);
    }
  }
  const download = (id: string, type: 'xlsx' | 'pdf') =>
    window.open(
      '/api/export?id=' + encodeURIComponent(id) + '&type=' + type,
      '_blank',
    );
  if (!me)
    return <LoginScreen brand={<Brand />} submit={api} onLogin={reload} />;
  const names: Any = {
    dashboard: 'Tableau de bord',
    saisie: 'Saisie mensuelle',
    rapports: 'Rapports et validation',
    reporting: 'Reporting officiel',
    admin: 'Administration',
  };
  const nav: [Tab, React.ReactNode][] = [
    ['dashboard', <LayoutDashboard size={18} />],
    ['saisie', <ClipboardList size={18} />],
    ['rapports', <ShieldCheck size={18} />],
    ['reporting', <BarChart3 size={18} />],
    ...(me.user.role === 'ADMIN_NATIONAL'
      ? ([['admin', <Settings size={18} />]] as [Tab, React.ReactNode][])
      : []),
  ];
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-navy text-white md:w-64 md:min-h-screen p-4 shrink-0">
        <Brand />
        <p className="text-sm text-slate-300 mt-4 mb-7">
          ONSSA – DPA
          <br />
          Veille, Traçabilité et Reporting
        </p>
        <nav className="flex md:block overflow-x-auto gap-2">
          {nav.map(([key, icon]) => (
            <button
              key={key}
              onClick={() => {
                setUnvalidatedOnly(false);
                setTab(key);
              }}
              className={
                'flex items-center gap-2 px-3 py-3 rounded-lg text-sm w-full whitespace-nowrap text-left ' +
                (tab === key ? 'bg-white/20' : 'hover:bg-white/10')
              }
            >
              {icon}
              {names[key]}
            </button>
          ))}
        </nav>
        <div className="mt-8 border-t border-white/20 pt-5 text-sm text-slate-200">
          <p className="font-semibold text-amber-300">
            {me.user.firstName} {me.user.name}
          </p>
          {
            {
              ADMIN_NATIONAL: 'Administrateur national',
              CHEF_SERVICE: 'Chef de service',
              CHEF_DIVISION: 'Chef de division',
              DIRECTEUR_REGIONAL: 'Directeur régional',
              DIRECTION_CENTRALE: 'Direction centrale',
            }[me.user.role as string]
          }
        </div>
        <PasswordChange
          submit={api}
          onSaved={() => tell('Votre mot de passe a été modifié.')}
        />
        <button
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 hover:bg-white/25 px-3 py-2.5 text-sm font-semibold"
          onClick={async () => {
            try {
              await api('logout', {});
              setMe(null);
            } catch (error) {
              tell(
                error instanceof Error
                  ? error.message
                  : 'Déconnexion impossible.',
              );
            }
          }}
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </aside>
      <main className="p-4 md:p-7 flex-1 min-w-0 space-y-5">
        <header className="flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{names[tab]}</h1>
            <p className="text-sm text-slate-500">
              Plateforme nationale ONSSA – DPA
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {tab !== 'reporting' && tab !== 'admin' && (
              <div className="flex gap-2">
                <select
                  aria-label="Mois"
                  disabled={busy}
                  value={month}
                  onChange={(e) => setMonth(+e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(2026, i, 1).toLocaleString('fr-FR', {
                        month: 'long',
                      })}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Année"
                  disabled={busy}
                  min="1900"
                  max="9999"
                  className="w-24"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(+e.target.value)}
                />
              </div>
            )}
            {periodReady && (
              <button
                type="button"
                aria-label={`${unvalidatedReports.length} rapports non validés pour la période`}
                title={`${unvalidatedReports.length} rapports non validés · ${String(month).padStart(2, '0')}/${year}`}
                className="relative grid place-items-center h-11 w-11 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  setUnvalidatedOnly(true);
                  setTab('rapports');
                }}
              >
                <BellRing size={21} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2 min-w-6 rounded-full bg-amber-500 px-1 text-center text-xs leading-5 font-bold text-slate-950"
                >
                  {unvalidatedReports.length}
                </span>
              </button>
            )}
          </div>
        </header>
        {message && (
          <div
            role="status"
            className="p-3 rounded-lg bg-amber-100 text-amber-900"
          >
            {message}
          </div>
        )}
        {tab === 'dashboard' && periodReady && (
          <>
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="Type de service"
                value={serviceKind}
                onChange={(e) => setServiceKind(e.target.value)}
              >
                <option value="">Tous les types de service</option>
                <option value="PROVINCIAL">Provinciaux</option>
                <option value="FRONTALIER">Frontaliers</option>
              </select>
              <select
                aria-label="Région"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option value="">Toutes les régions</option>
                {org.regions
                  .filter((r: Any) =>
                    org.services.some((s: Any) => s.division.regionId === r.id),
                  )
                  .map((r: Any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="vetra-kpis">
              {[
                {
                  label: 'Services attendus',
                  count: dashboardServices.length,
                  key: 'TOUS',
                  tone: 'blue',
                  Icon: Building2,
                },
                {
                  label: 'Rapports saisis',
                  count: dashboardServices.length - cards['NON INTRODUIT'],
                  key: 'SAISIS',
                  tone: 'blue',
                  Icon: ClipboardList,
                },
                {
                  label: 'Non introduits',
                  count: cards['NON INTRODUIT'],
                  key: 'NON INTRODUIT',
                  tone: 'rose',
                  Icon: CircleDashed,
                },
                {
                  label: 'Brouillons',
                  count: cards.BROUILLON,
                  key: 'BROUILLON',
                  tone: 'violet',
                  Icon: Pencil,
                },
                {
                  label: 'Soumis',
                  count: cards.SOUMIS,
                  key: 'SOUMIS',
                  tone: 'amber',
                  Icon: Send,
                },
                {
                  label: 'Validés',
                  count: cards.VALIDE,
                  key: 'VALIDE',
                  tone: 'green',
                  Icon: BadgeCheck,
                },
                {
                  label: 'Révoqués',
                  count: cards.REVOQUE,
                  key: 'REVOQUE',
                  tone: 'rose',
                  Icon: RotateCcw,
                },
                {
                  label: 'Corrigés',
                  count: cards.CORRIGE,
                  key: 'CORRIGE',
                  tone: 'amber',
                  Icon: ListChecks,
                },
                {
                  label: 'Taux de validation',
                  count: dashboardServices.length
                    ? Math.round(
                        (cards.VALIDE / dashboardServices.length) * 100,
                      ) + ' %'
                    : '—',
                  key: 'VALIDE',
                  tone: 'green',
                  Icon: CirclePercent,
                },
              ].map(({ label, count, key, tone, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                  className={`vetra-kpi vetra-kpi-${tone}`}
                >
                  <span className="vetra-kpi-icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="block text-2xl tabular-nums">
                      {count}
                    </strong>
                    <span className="text-xs font-semibold">{label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="panel">
              <h2 className="font-bold text-lg mb-3">
                Services concernés — {statusFilter}
              </h2>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Région</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardServices
                      .filter(
                        (s: Any) =>
                          statusFilter === 'TOUS' ||
                          (statusFilter === 'SAISIS'
                            ? reportByService.has(s.id)
                            : (reportByService.get(s.id)?.status ||
                                'NON INTRODUIT') === statusFilter),
                      )
                      .map((s: Any) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>
                            {
                              org.regions.find(
                                (r: Any) => r.id === s.division.regionId,
                              )?.name
                            }
                          </td>
                          <td>
                            <span
                              className={
                                'badge ' +
                                (reportByService.get(s.id)?.status || '')
                              }
                            >
                              {reportByService.get(s.id)?.status ||
                                'NON INTRODUIT'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {!periodReady && tab !== 'admin' && tab !== 'reporting' && (
          <p role="status">Chargement de la période…</p>
        )}
        {tab === 'saisie' && periodReady && (
          <div className="panel space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                aria-label="Service"
                disabled={busy}
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                {org.services.map((s: Any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ·{' '}
                    {s.kind === 'FRONTALIER' ? 'Frontalier' : 'Provincial'}
                  </option>
                ))}
              </select>
              <span className={'badge ' + (current?.status || '')}>
                {current?.status || 'NON INTRODUIT'}
              </span>
              <span className="text-sm text-red-700">{current?.reason}</span>
            </div>
            {org.services.length > 0 && !permittedSections.length && (
              <p>Aucune rubrique habilitée pour ce service.</p>
            )}
            {!org.services.length && (
              <p className="text-amber-700">
                Aucun service créé ou autorisé. L'administrateur doit configurer
                les services et habilitations.
              </p>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {['I', 'II', 'III', 'IV', 'V', 'VI'].map((sec) => {
                  const items = permittedSections.filter(
                    (id) => sectionGroup(id) === sec,
                  );
                  const unlocked =
                    items.length > 0 &&
                    (!editable ||
                      !nextSection ||
                      permittedSections.indexOf(items[0]) <=
                        permittedSections.indexOf(nextSection));
                  return (
                    <button
                      type="button"
                      key={sec}
                      disabled={!unlocked}
                      onClick={() =>
                        setRubric(
                          items.find((id) => !completedSteps.includes(id)) ||
                            items[0],
                        )
                      }
                      className={
                        'rounded-xl border px-5 py-3 font-bold ' +
                        (sectionGroup(rubric) === sec
                          ? 'bg-navy text-white'
                          : unlocked
                            ? 'bg-white hover:bg-slate-100'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                      }
                    >
                      Section {sec}{' '}
                      {!unlocked
                        ? '🔒'
                        : items.every((id) => completedSteps.includes(id))
                          ? '✓'
                          : ''}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {permittedSections
                  .filter((id) => sectionGroup(id) === sectionGroup(rubric))
                  .map((id) => {
                    const unlocked =
                      !editable ||
                      completedSteps.includes(id) ||
                      id === nextSection ||
                      !nextSection;
                    return (
                      <button
                        type="button"
                        key={id}
                        disabled={!unlocked}
                        onClick={() => setRubric(id)}
                        className={
                          'inline-flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm max-w-full ' +
                          (rubric === id
                            ? 'bg-navy text-white'
                            : unlocked
                              ? 'bg-white hover:bg-slate-100'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed')
                        }
                      >
                        <RubricIcon id={id} />
                        <span>
                          {id}{' '}
                          {completedSteps.includes(id)
                            ? '✓'
                            : unlocked
                              ? ''
                              : '🔒'}
                          <span className="block text-xs">
                            {canevas.rubrics.find((x: any) => x[0] === id)?.[3]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
              <p className="text-sm text-slate-500">
                {
                  completedSteps.filter((id) =>
                    permittedSections.some((rid) => rid === id),
                  ).length
                }{' '}
                / {permittedSections.length} rubriques complétées · La rubrique
                suivante s’ouvre après enregistrement.
              </p>
            </div>
            <h2 className="font-bold text-lg flex items-start gap-2">
              <RubricIcon id={rubric} colored />
              <span>
                {rubric} —{' '}
                {canevas.rubrics.find((x: any) => x[0] === rubric)?.[3]}
              </span>
            </h2>
            <fieldset disabled={busy}>
              <CanevasTable
                rubric={rubric}
                values={values}
                setValues={setValues}
                editable={editable}
              />
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!editable || busy || !permittedSections.length}
                className="btn"
                onClick={save}
              >
                Enregistrer le brouillon
              </button>
              <button
                disabled={
                  !editable || busy || !rubric || rubric !== nextSection
                }
                className="btn green"
                onClick={completeRubric}
              >
                Enregistrer et continuer
              </button>
              {!!permittedSections.length && !nextSection && (
                <button
                  disabled={!editable || busy || !current?.id}
                  className="btn green"
                  onClick={() => action(current?.id || '', 'soumettre')}
                >
                  Soumettre le rapport complet
                </button>
              )}
              {current && (
                <>
                  <button
                    type="button"
                    title="Télécharger en Excel (XLSX)"
                    aria-label="Télécharger en Excel (XLSX)"
                    className="vetra-action-icon text-emerald-800 bg-emerald-50"
                    onClick={() => download(current.id, 'xlsx')}
                  >
                    <FileSpreadsheet size={19} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Télécharger en PDF"
                    aria-label="Télécharger en PDF"
                    className="vetra-action-icon text-rose-800 bg-rose-50"
                    onClick={() => download(current.id, 'pdf')}
                  >
                    <FileText size={19} aria-hidden="true" />
                  </button>
                  <ReportEmail
                    key={current.id}
                    endpoint={`/api/export/email?id=${encodeURIComponent(current.id)}`}
                    title={`Rapport ${current.month}/${current.year} · ${selectedService?.name ?? ''}`}
                  />
                  <ReportShare
                    key={current.id + current.updatedAt}
                    url={`/api/export?id=${encodeURIComponent(current.id)}&type=pdf`}
                    title={`Rapport ${current.month}/${current.year} · ${selectedService?.name ?? ''}`}
                  />
                </>
              )}
            </div>
          </div>
        )}
        {tab === 'rapports' && periodReady && (
          <div className="panel">
            <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
              <h2 className="font-bold">
                {unvalidatedOnly ? 'Rapports non validés' : 'Rapports du mois'}
              </h2>
              {unvalidatedOnly && (
                <button
                  type="button"
                  className="btn alt"
                  onClick={() => setUnvalidatedOnly(false)}
                >
                  Tous les rapports
                </button>
              )}
            </div>
            {(unvalidatedOnly ? unvalidatedReports : reports).length === 0 && (
              <p className="text-sm text-slate-500 py-3">
                Aucun rapport pour cette sélection.
              </p>
            )}
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(unvalidatedOnly ? unvalidatedReports : reports).map((r) => (
                    <tr key={r.id}>
                      <td>{r.service.name}</td>
                      <td>
                        <span className={'badge ' + r.status}>{r.status}</span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            title="Consulter le rapport"
                            aria-label="Consulter le rapport"
                            className="vetra-action-icon text-blue-800 bg-blue-50"
                            onClick={() => {
                              setService(r.serviceId);
                              setTab('saisie');
                            }}
                          >
                            <Eye size={19} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title="Télécharger en Excel (XLSX)"
                            aria-label="Télécharger en Excel (XLSX)"
                            className="vetra-action-icon text-emerald-800 bg-emerald-50"
                            onClick={() => download(r.id, 'xlsx')}
                          >
                            <FileSpreadsheet size={19} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title="Télécharger en PDF"
                            aria-label="Télécharger en PDF"
                            className="vetra-action-icon text-rose-800 bg-rose-50"
                            onClick={() => download(r.id, 'pdf')}
                          >
                            <FileText size={19} aria-hidden="true" />
                          </button>
                          <ReportEmail
                            endpoint={`/api/export/email?id=${encodeURIComponent(r.id)}`}
                            title={`Rapport ${r.month}/${r.year} · ${r.service.name}`}
                          />
                          <ReportShare
                            url={`/api/export?id=${encodeURIComponent(r.id)}&type=pdf`}
                            title={`Rapport ${r.month}/${r.year} · ${r.service.name}`}
                          />
                          {me.user.role === 'CHEF_DIVISION' &&
                            r.status === 'SOUMIS' && (
                              <button
                                type="button"
                                className="btn green"
                                onClick={() => action(r.id, 'valider')}
                              >
                                Valider
                              </button>
                            )}
                          {((me.user.role === 'CHEF_DIVISION' &&
                            r.status === 'SOUMIS') ||
                            (me.user.role === 'DIRECTION_CENTRALE' &&
                              ['SOUMIS', 'VALIDE'].includes(r.status))) && (
                            <button
                              type="button"
                              className="btn red"
                              onClick={() => action(r.id, 'revoquer')}
                            >
                              Révoquer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'reporting' && (
          <Reporting
            initialYear={year}
            initialMonth={month}
            services={org.services
              .map((item: Any) => ({
                id: item.id,
                name: item.name,
                region: org.regions.find(
                  (region: Any) => region.id === item.division.regionId,
                ),
              }))
              .filter((item: Any) => item.region)}
          />
        )}
        {tab === 'admin' && me.user.role === 'ADMIN_NATIONAL' && (
          <div className="space-y-4">
            <nav
              aria-label="Rubriques de l’administration"
              className="panel flex flex-wrap gap-2"
            >
              {[
                { id: 'organisation', label: 'Organisation', Icon: Building2 },
                { id: 'services', label: 'Services', Icon: ClipboardList },
                { id: 'comptes', label: 'Comptes utilisateurs', Icon: Users },
                { id: 'droits', label: 'Habilitations', Icon: KeyRound },
              ].map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  aria-current={adminSection === id ? 'page' : undefined}
                  className={`btn inline-flex items-center gap-2 ${adminSection === id ? '' : 'alt'}`}
                  onClick={() => setAdminSection(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            {adminSection === 'organisation' && (
              <div className="panel">
                <h2 className="font-bold mb-3">Organisation nationale</h2>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    ['Directions régionales', org.regions.length],
                    ['Divisions vétérinaires', org.divisions.length],
                    ['Services', org.services.length],
                  ].map(([k, v]) => (
                    <div
                      key={String(k)}
                      className="bg-slate-100 rounded-lg p-4"
                    >
                      {k}
                      <b className="block text-3xl">{v}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {adminSection === 'services' && (
              <div className="panel">
                <h2 className="font-bold mb-3">Gestion des services</h2>
                <select
                  aria-label="Service à modifier"
                  value={editingService}
                  onChange={(e) => setEditingService(e.target.value)}
                >
                  <option value="">Nouveau service</option>
                  {org.services.map((item: Any) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <form
                  key={editingService}
                  className="flex flex-wrap gap-2 mt-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const d = Object.fromEntries(new FormData(form));
                    try {
                      await api('admin', {
                        action: editingService ? 'serviceUpdate' : 'service',
                        id: editingService,
                        ...d,
                      });
                      if (!editingService) form.reset();
                      await reload();
                      tell('Service enregistré');
                    } catch (e: any) {
                      tell(e.message);
                    }
                  }}
                >
                  <input
                    required
                    aria-label="Nom du service"
                    name="name"
                    placeholder="Nom du service"
                    defaultValue={
                      org.services.find(
                        (item: Any) => item.id === editingService,
                      )?.name
                    }
                  />
                  <select
                    name="divisionId"
                    aria-label="Division"
                    defaultValue={
                      org.services.find(
                        (item: Any) => item.id === editingService,
                      )?.divisionId
                    }
                  >
                    {org.divisions.map((d: Any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="kind"
                    aria-label="Type de service"
                    defaultValue={
                      org.services.find(
                        (item: Any) => item.id === editingService,
                      )?.kind
                    }
                  >
                    <option value="PROVINCIAL">Provincial</option>
                    <option value="FRONTALIER">Frontalier</option>
                  </select>
                  <button className="btn">
                    {editingService ? 'Enregistrer' : 'Créer'}
                  </button>
                </form>
              </div>
            )}
            {adminSection === 'comptes' && (
              <div className="panel">
                <h2 className="font-bold mb-3">Créer un utilisateur</h2>
                <form
                  className="grid md:grid-cols-3 gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const d = Object.fromEntries(new FormData(form));
                    try {
                      await api('admin', { action: 'user', ...d });
                      form.reset();
                      await reload();
                      tell('Utilisateur créé');
                    } catch (e: any) {
                      tell(e.message);
                    }
                  }}
                >
                  {['name', 'firstName', 'email', 'phone', 'password'].map(
                    (k) => (
                      <input
                        key={k}
                        name={k}
                        required={k !== 'phone'}
                        minLength={k === 'password' ? 12 : undefined}
                        aria-label={
                          {
                            name: 'Nom',
                            firstName: 'Prénom',
                            email: 'E-mail',
                            phone: 'Téléphone',
                            password: 'Mot de passe',
                          }[k]
                        }
                        placeholder={
                          {
                            name: 'Nom',
                            firstName: 'Prénom',
                            email: 'E-mail',
                            phone: 'Téléphone',
                            password: 'Mot de passe',
                          }[k]
                        }
                        type={
                          k === 'password'
                            ? 'password'
                            : k === 'email'
                              ? 'email'
                              : 'text'
                        }
                      />
                    ),
                  )}
                  <select
                    name="role"
                    aria-label="Profil"
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value)}
                  >
                    {[
                      'ADMIN_NATIONAL',
                      'CHEF_SERVICE',
                      'CHEF_DIVISION',
                      'DIRECTEUR_REGIONAL',
                      'DIRECTION_CENTRALE',
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    name="regionId"
                    aria-label="Région de rattachement"
                    required={adminRole === 'DIRECTEUR_REGIONAL'}
                    hidden={adminRole !== 'DIRECTEUR_REGIONAL'}
                  >
                    <option value="">Région</option>
                    {org.regions.map((x: Any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="divisionId"
                    aria-label="Division de rattachement"
                    required={adminRole === 'CHEF_DIVISION'}
                    hidden={adminRole !== 'CHEF_DIVISION'}
                  >
                    <option value="">Division</option>
                    {org.divisions.map((x: Any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="serviceId"
                    aria-label="Service de rattachement"
                    required={adminRole === 'CHEF_SERVICE'}
                    hidden={adminRole !== 'CHEF_SERVICE'}
                  >
                    <option value="">Service</option>
                    {org.services.map((x: Any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn">Créer le compte</button>
                </form>
              </div>
            )}
            {adminSection === 'comptes' && (
              <div className="panel">
                <h2 className="font-bold mb-3">Comptes utilisateurs</h2>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Profil</th>
                        <th>État</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.users.map((user: Any) => (
                        <tr key={user.id}>
                          <td>
                            {user.firstName} {user.name}
                            <br />
                            {user.email}
                          </td>
                          <td>{user.role}</td>
                          <td>{user.active ? 'Actif' : 'Désactivé'}</td>
                          <td>
                            <button
                              className="btn alt"
                              disabled={user.id === me.user.id || busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await api('admin', {
                                    action: 'userUpdate',
                                    id: user.id,
                                    active: !user.active,
                                  });
                                  await reload();
                                  tell('Compte mis à jour');
                                } catch (e: any) {
                                  tell(e.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {user.active ? 'Désactiver' : 'Réactiver'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminSection === 'droits' && (
              <div className="panel">
                <h2 className="font-bold mb-3">
                  Habilitations du service par rubrique
                </h2>
                <select
                  aria-label="Service"
                  disabled={busy}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {org.services.map((s: Any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ·{' '}
                      {s.kind === 'FRONTALIER' ? 'Frontalier' : 'Provincial'}
                    </option>
                  ))}
                </select>
                <div className="grid md:grid-cols-4 gap-2 mt-3">
                  {canevas.rubrics.map(([id, _a, _b, label]: any) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={enabled(id)}
                        onChange={(e) => {
                          setOrg((o: Any) => ({
                            ...o,
                            services: o.services.map((s: Any) =>
                              s.id !== service
                                ? s
                                : {
                                    ...s,
                                    rights: canevas.rubrics.map(
                                      ([rid]: any) => ({
                                        rubricId: rid,
                                        enabled:
                                          rid === id
                                            ? e.target.checked
                                            : enabled(rid),
                                      }),
                                    ),
                                  },
                            ),
                          }));
                        }}
                      />
                      {id} {label}
                    </label>
                  ))}
                </div>
                <button
                  disabled={!service}
                  className="btn mt-3"
                  onClick={async () => {
                    try {
                      await api('admin', {
                        action: 'rights',
                        serviceId: service,
                        enabled: canevas.rubrics
                          .filter(([id]: any) => enabled(id))
                          .map(([id]: any) => id),
                      });
                      await reload();
                      tell('Habilitations enregistrées');
                    } catch (e: any) {
                      tell(e.message);
                    }
                  }}
                >
                  Enregistrer les habilitations
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
