'use client';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  Eye,
  FileText,
  Building2,
  CircleDashed,
  Pencil,
  Send,
  BadgeCheck,
  RotateCcw,
  CirclePercent,
  Users,
  KeyRound,
  Mail,
  Sparkles,
  ShieldAlert,
  MessageSquareText,
  Radar,
  MapPin,
  ChevronDown,
  Clock3,
  CheckCircle2,
  Lock,
  Save,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sigma,
} from 'lucide-react';

const SECTION_SHORT_LABELS: Record<string, string> = {
  I: 'Marché local',
  II: 'Établissements',
  III: 'Transport',
  IV: 'Importation',
  V: 'Exportation',
  VI: 'Laboratoire',
};

import CanevasTable from './CanevasTable';
import Reporting from './Reporting';
import ReportShare from './ReportShare';
import ReportEmail from './ReportEmail';
import LoginScreen from './LoginScreen';
import PasswordChange from './PasswordChange';
import AdminMailDiagnostics from './AdminMailDiagnostics';
import AdminPasswordReset from './AdminPasswordReset';
import AdminResetRequests, {
  type PendingResetRequest,
} from './AdminResetRequests';
import CentralAiHub, { type CentralAiSection } from './CentralAiHub';
import RubricIcon from './RubricIcon';
import RegionalMap from './RegionalMap';
import ReportNotifications from './ReportNotifications';
import PeriodRibbon from './PeriodRibbon';
import { effectiveRubrics, rubricIds } from '@/lib/forms';
import { months } from '@/lib/analytics';

function Brand() {
  return (
    <div className="brand">
      <span className="vetra-onssa-brand">
        <img
          src="/onssa-transparent.png"
          alt="ONSSA"
          referrerPolicy="no-referrer"
        />
      </span>
      <img
        src="/VETRA_officiel.jpg"
        alt="VETRA"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

type Any = Record<string, any>;
type Tab = 'dashboard' | 'saisie' | 'rapports' | 'reporting' | 'veille' | 'admin';
async function api(path: string, data?: Any) {
  const r = await fetch('/api/' + path, {
    method: data ? 'POST' : 'GET',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  const x = await r.json().catch(() => ({}));
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
    [aiSection, setAiSection] = useState<CentralAiSection>('summary'),
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
    const [o, c, r, rr] = await Promise.all([
      api('org'),
      api('canevas'),
      api(`reports?year=${year}&month=${month}`),
      u.user.role === 'ADMIN_NATIONAL'
        ? api('admin/reset-requests').catch(() => [])
        : Promise.resolve([]),
    ]);
    setOrg(o);
    setCanevas(c);
    setReports(r);
    setResetRequests(Array.isArray(rr) ? rr : []);
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
    setTab(me.user.role === 'ADMIN_NATIONAL' ? 'admin' : 'dashboard');
  }, [me?.user.id]);
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
  const isAdminUser = me?.user.role === 'ADMIN_NATIONAL';
  useEffect(() => {
    if (!isAdminUser) return;
    let active = true;
    const refreshResetRequests = () => {
      api('admin/reset-requests')
        .then((list) => {
          if (active && Array.isArray(list)) setResetRequests(list);
        })
        .catch(() => {});
    };
    refreshResetRequests();
    const timer = window.setInterval(refreshResetRequests, 15_000);
    const onFocus = () => refreshResetRequests();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshResetRequests();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAdminUser, tab]);
  const openResetRequests = (userId?: string) => {
    setTab('admin');
    setAdminSection('comptes');
    setEditingUserId('');
    if (userId) setResettingUserId(userId);
    setTimeout(() => {
      const targetId = userId
        ? 'admin-reset-password-panel'
        : 'admin-reset-requests-panel';
      document.getElementById(targetId)?.scrollIntoView({ block: 'nearest' });
    }, 50);
  };
  const selectedService = org.services.find((s: Any) => s.id === service);
  const current = reports.find(
    (r) => r.serviceId === service && r.year === year && r.month === month,
  );
  const permittedSections = selectedService
    ? effectiveRubrics(selectedService.rights, selectedService.kind)
    : [];
  const sectionGroup = (id: string) => id.split('.')[0];
  const visibleSections = [...new Set(permittedSections.map(sectionGroup))];
  const [loadedPeriod, setLoadedPeriod] = useState('');
  const periodReady = loadedPeriod === year + '-' + month;
  const [serviceKind, setServiceKind] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [saisieRegionFilter, setSaisieRegionFilter] = useState('');
  const [validationRegionFilter, setValidationRegionFilter] = useState('');
  const [validationStatusFilter, setValidationStatusFilter] = useState('TOUS');
  const dashboardServices = org.services.filter(
    (s: Any) =>
      (!serviceKind || s.kind === serviceKind) &&
      (!regionFilter || s.division.regionId === regionFilter),
  );
  const centralScope =
    me?.user.role === 'DIRECTION_CENTRALE' || me?.user.role === 'ADMIN_NATIONAL';
  const saisieServices = org.services.filter(
    (s: Any) => !saisieRegionFilter || s.division.regionId === saisieRegionFilter,
  );
  useEffect(() => {
    if (saisieServices.length && !saisieServices.some((s: Any) => s.id === service))
      setService(saisieServices[0].id);
  }, [saisieRegionFilter, org.services.length]);
  const reportByService = new Map(
    reports
      .filter((r) => r.year === year && r.month === month)
      .map((r) => [r.serviceId, r]),
  );
  const [adminSection, setAdminSection] = useState('organisation');
  const [editingUserId, setEditingUserId] = useState('');
  const editingUser = org.users.find((user: Any) => user.id === editingUserId);
  const [resettingUserId, setResettingUserId] = useState('');
  const resettingUser = org.users.find((user: Any) => user.id === resettingUserId);
  const [resetRequests, setResetRequests] = useState<PendingResetRequest[]>([]);
  const [unvalidatedOnly, setUnvalidatedOnly] = useState(false);
  const unvalidatedReports = periodReady
    ? reports.filter((report) => report.status !== 'VALIDE')
    : [];
  const validationServices = org.services.filter(
    (s: Any) =>
      !validationRegionFilter || s.division.regionId === validationRegionFilter,
  );
  const validationReports = validationServices
    .map((s: Any) => ({
      service: s,
      report: reports.find(
        (r) => r.serviceId === s.id && r.year === year && r.month === month,
      ),
    }))
    .filter(({ report }: { report: Any }) => {
      if (validationStatusFilter === 'TOUS') return true;
      if (validationStatusFilter === 'NON INTRODUIT') return !report;
      if (validationStatusFilter === 'SAISIS') return !!report;
      return report?.status === validationStatusFilter;
    });
  const [adminRole, setAdminRole] = useState('CHEF_SERVICE');
  const [editingService, setEditingService] = useState('');
  const isFinalizedReport =
    current?.status === 'VALIDE' || current?.status === 'SOUMIS';
  const storedSteps: Array<string> = Array.isArray(values.__completed)
    ? values.__completed.map(String)
    : [];
  const completedSteps = isFinalizedReport
    ? permittedSections
    : permittedSections.filter((id) => storedSteps.includes(id));
  const nextSection = isFinalizedReport
    ? undefined
    : permittedSections.find((id) => !completedSteps.includes(id));
  const editable =
    periodReady &&
    !!selectedService &&
    me?.user.role === 'CHEF_SERVICE' &&
    (!current || ['BROUILLON', 'REVOQUE', 'CORRIGE'].includes(current.status));
  const selectedAdminService = org.services.find((s: Any) => s.id === service);
  const enabled = (id: string) =>
    selectedAdminService
      ? effectiveRubrics(
          selectedAdminService.rights || [],
          selectedAdminService.kind,
        ).includes(id as (typeof rubricIds)[number])
      : false;
  useEffect(() => {
    if (!periodReady) return;
    const finalized =
      current?.status === 'VALIDE' || current?.status === 'SOUMIS';
    const history = Array.isArray(current?.data?.__completed)
      ? current.data.__completed.map(String)
      : [];
    const completed = finalized
      ? permittedSections
      : permittedSections.filter((id) => history.includes(id));
    setValues(current?.data || {});
    setRubric((prev) =>
      permittedSections.includes(prev as (typeof rubricIds)[number]) &&
      (!editable ||
        completed.some((id) => id === prev) ||
        prev === permittedSections.find((id) => !completed.includes(id)))
        ? prev
        : editable
          ? (permittedSections.find((id) => !completed.includes(id)) ??
            permittedSections[0] ??
            '')
          : (permittedSections[0] ?? ''),
    );
  }, [
    current?.id,
    current?.status,
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
    veille: 'Veille & Analyse IA',
    admin: 'Administration',
  };
  const nav: [Tab, React.ReactNode][] = [
    ['dashboard', <LayoutDashboard size={18} />],
    ['saisie', <ClipboardList size={18} />],
    ['rapports', <ShieldCheck size={18} />],
    ['reporting', <BarChart3 size={18} />],
    ...(me.user.role === 'DIRECTION_CENTRALE'
      ? ([['veille', <Sparkles size={18} />]] as [Tab, React.ReactNode][])
      : []),
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
                'flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-sm w-full whitespace-nowrap text-left ' +
                (tab === key ? 'bg-white/20' : 'hover:bg-white/10')
              }
            >
              <span className="flex items-center gap-2">
                {icon}
                {names[key]}
              </span>
              {key === 'admin' && resetRequests.length > 0 && (
                <span
                  aria-label={`${resetRequests.length} demande${resetRequests.length === 1 ? '' : 's'} de réinitialisation en attente`}
                  className="rounded-full bg-amber-400 text-navy text-xs font-bold px-2 py-0.5 tabular-nums"
                >
                  {resetRequests.length}
                </span>
              )}
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
            {(periodReady || isAdminUser) && (
              <ReportNotifications
                statusesToReview={unvalidatedReports.map((report) =>
                  String(report.status),
                )}
                month={month}
                year={year}
                isAdmin={isAdminUser}
                resetRequests={resetRequests}
                onOpenResetRequests={openResetRequests}
                onOpen={() => {
                  setUnvalidatedOnly(true);
                  setTab('rapports');
                }}
              />
            )}
          </div>
        </header>
        {tab !== 'reporting' && tab !== 'admin' && (
          <PeriodRibbon
            month={month}
            year={year}
            disabled={busy}
            onChange={(nextMonth, nextYear) => {
              setMonth(nextMonth);
              setYear(nextYear);
            }}
          />
        )}
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
            <div className="vetra-dashboard-kpis vetra-kpis">
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
            {me.user.role === 'DIRECTION_CENTRALE' && (
              <div className="panel space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-navy flex items-center gap-2">
                      <Sparkles
                        size={17}
                        className="text-teal"
                        aria-hidden="true"
                      />
                      Veille sanitaire &amp; Analyse IA — Direction centrale
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Accès rapide aux outils d’aide à la décision sur le
                      périmètre national ({months[month - 1]} {year}).
                    </p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(
                    [
                      {
                        id: 'summary',
                        label: 'Synthèse exécutive',
                        hint: 'Note nationale consolidée',
                        Icon: FileText,
                      },
                      {
                        id: 'anomalies',
                        label: 'Contrôle anomalies',
                        hint: 'Audit qualité des rapports',
                        Icon: ShieldAlert,
                      },
                      {
                        id: 'qa',
                        label: 'Assistant analytique',
                        hint: 'Questions en français / arabe',
                        Icon: MessageSquareText,
                      },
                      {
                        id: 'signals',
                        label: 'Signaux faibles',
                        hint: 'Veille sanitaire sur 6 mois',
                        Icon: Radar,
                      },
                    ] as Array<{
                      id: CentralAiSection;
                      label: string;
                      hint: string;
                      Icon: typeof FileText;
                    }>
                  ).map(({ id, label, hint, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className="text-left rounded-xl border border-slate-200 hover:border-teal hover:bg-slate-50 px-3.5 py-3 transition-colors flex items-start gap-2.5"
                      onClick={() => {
                        setAiSection(id);
                        setTab('veille');
                      }}
                    >
                      <span className="rounded-lg bg-emerald-50 text-teal p-2 shrink-0">
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm text-navy">
                          {label}
                        </strong>
                        <span className="block text-xs text-slate-600">
                          {hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <RegionalMap
              regions={org.regions}
              services={org.services.filter(
                (item: Any) => !serviceKind || item.kind === serviceKind,
              )}
              recorded={new Set(reportByService.keys())}
              year={year}
              month={month}
              identity={me.user.id}
              selected={regionFilter}
              onSelect={(id) => {
                setRegionFilter(id);
                setStatusFilter('TOUS');
              }}
            />
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
            <div
              className="vetra-scope-bar"
              role="region"
              aria-label="Sélection de la direction régionale et du service"
            >
              {centralScope && (
                <>
                  <label className="vetra-scope-field">
                    <span className="vetra-scope-icon is-region" aria-hidden="true">
                      <MapPin size={16} />
                    </span>
                    <span className="vetra-scope-body">
                      <span className="vetra-scope-label">
                        Direction régionale
                      </span>
                      <span className="vetra-scope-select-wrap">
                        <select
                          aria-label="Filtrer la saisie par direction régionale"
                          className="vetra-scope-select"
                          disabled={busy}
                          value={saisieRegionFilter}
                          onChange={(e) => setSaisieRegionFilter(e.target.value)}
                        >
                          <option value="">
                            Toutes les directions régionales
                          </option>
                          {org.regions.map((r: Any) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={15}
                          className="vetra-scope-chevron"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </label>
                  <span className="vetra-scope-divider" aria-hidden="true" />
                </>
              )}
              <label className="vetra-scope-field is-service">
                <span className="vetra-scope-icon is-service" aria-hidden="true">
                  <Building2 size={16} />
                </span>
                <span className="vetra-scope-body">
                  <span className="vetra-scope-label">
                    Service vétérinaire
                  </span>
                  <span className="vetra-scope-select-wrap">
                    <select
                      aria-label="Service"
                      className="vetra-scope-select"
                      disabled={busy}
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                    >
                      {saisieServices.map((s: Any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ·{' '}
                          {s.kind === 'FRONTALIER'
                            ? 'Frontalier'
                            : 'Provincial'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="vetra-scope-chevron"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </label>
              <span className="vetra-scope-divider" aria-hidden="true" />
              <div className="vetra-scope-status-wrap">
                <span className="vetra-scope-label">Statut du rapport</span>
                <span
                  className={
                    'vetra-scope-status ' +
                    (current?.status || 'NON_INTRODUIT')
                  }
                >
                  {current?.status === 'VALIDE' ? (
                    <BadgeCheck size={14} aria-hidden="true" />
                  ) : current?.status === 'SOUMIS' ? (
                    <Clock3 size={14} aria-hidden="true" />
                  ) : current?.status === 'REVOQUE' ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : current?.status === 'BROUILLON' ||
                    current?.status === 'CORRIGE' ? (
                    <Pencil size={14} aria-hidden="true" />
                  ) : (
                    <CircleDashed size={14} aria-hidden="true" />
                  )}
                  <span>{current?.status || 'NON INTRODUIT'}</span>
                </span>
              </div>
            </div>
            {current?.reason && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 flex items-center gap-2"
              >
                <RotateCcw size={15} className="shrink-0" aria-hidden="true" />
                <span>
                  <strong>Motif de révocation :</strong> {current.reason}
                </span>
              </div>
            )}
            {saisieServices.length > 0 && !permittedSections.length && (
              <p>Aucune rubrique habilitée pour ce service.</p>
            )}
            {!saisieServices.length && (
              <p className="text-amber-700">
                Aucun service créé ou autorisé. L'administrateur doit configurer
                les services et habilitations.
              </p>
            )}
            {permittedSections.length > 0 && (() => {
              const completedCount = completedSteps.filter((id) =>
                permittedSections.some((rid) => rid === id),
              ).length;
              const progressPct = Math.round(
                (completedCount / permittedSections.length) * 100,
              );
              const unlockedRubrics = permittedSections.filter(
                (id) =>
                  !editable ||
                  completedSteps.includes(id) ||
                  id === nextSection ||
                  !nextSection,
              );
              const currentUnlockedIdx = unlockedRubrics.findIndex(
                (id) => id === rubric,
              );
              const prevRubric =
                currentUnlockedIdx > 0
                  ? unlockedRubrics[currentUnlockedIdx - 1]
                  : null;
              const nextUnlockedRubric =
                currentUnlockedIdx >= 0 &&
                currentUnlockedIdx < unlockedRubrics.length - 1
                  ? unlockedRubrics[currentUnlockedIdx + 1]
                  : null;
              const activeRubricTitle =
                canevas.rubrics.find((x: any) => x[0] === rubric)?.[3] || '';
              const activeSectionRubrics = permittedSections.filter(
                (id) => sectionGroup(id) === sectionGroup(rubric),
              );

              return (
                <>
                  <div className="vetra-saisie-nav">
                    <div className="vetra-saisie-progress-head">
                      <div className="vetra-saisie-progress-info">
                        <span className="vetra-saisie-progress-title">
                          {current?.status === 'VALIDE'
                            ? 'Rapport validé'
                            : current?.status === 'SOUMIS'
                              ? 'Rapport soumis'
                              : 'Progression de la saisie'}
                        </span>
                        <span
                          className="vetra-saisie-progress-sep"
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span className="vetra-saisie-progress-count tabular-nums">
                          <strong>{completedCount}</strong> /{' '}
                          {permittedSections.length}{' '}
                          {current?.status === 'VALIDE'
                            ? permittedSections.length > 1
                              ? 'rubriques validées'
                              : 'rubrique validée'
                            : current?.status === 'SOUMIS'
                              ? permittedSections.length > 1
                                ? 'rubriques soumises'
                                : 'rubrique soumise'
                              : permittedSections.length > 1
                                ? 'rubriques complétées'
                                : 'rubrique complétée'}
                        </span>
                        <span className="vetra-saisie-progress-pct tabular-nums">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="vetra-saisie-mode">
                        {editable ? (
                          <>
                            <Pencil
                              size={13}
                              className="text-teal-700"
                              aria-hidden="true"
                            />
                            <span className="text-teal-800 font-semibold">
                              Saisie active
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Appuyez sur Entrée pour passer au champ suivant
                            </span>
                          </>
                        ) : (
                          <>
                            <Lock
                              size={13}
                              className="text-slate-500"
                              aria-hidden="true"
                            />
                            <span>Mode consultation (lecture seule)</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className="vetra-saisie-progress-track"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Avancement des rubriques du rapport"
                    >
                      <span
                        className="vetra-saisie-progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div
                      className="vetra-section-rail"
                      role="tablist"
                      aria-label="Sections du rapport"
                    >
                      {visibleSections.map((sec) => {
                        const items = permittedSections.filter(
                          (id) => sectionGroup(id) === sec,
                        );
                        const doneInSec = items.filter((id) =>
                          completedSteps.includes(id),
                        ).length;
                        const allDone =
                          items.length > 0 && doneInSec === items.length;
                        const unlocked =
                          items.length > 0 &&
                          (!editable ||
                            !nextSection ||
                            items.some(
                              (id) =>
                                completedSteps.includes(id) ||
                                id === nextSection,
                            ));
                        const isActive = sectionGroup(rubric) === sec;

                        return (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            key={sec}
                            disabled={!unlocked}
                            onClick={() =>
                              setRubric(
                                items.find(
                                  (id) => !completedSteps.includes(id),
                                ) || items[0],
                              )
                            }
                            className={[
                              'vetra-section-tab',
                              isActive ? 'is-active' : '',
                              allDone ? 'is-done' : '',
                              !unlocked ? 'is-locked' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span className="vetra-section-roman">{sec}</span>
                            <span className="vetra-section-name">
                              {SECTION_SHORT_LABELS[sec] || `Section ${sec}`}
                            </span>
                            <span className="vetra-section-state">
                              {!unlocked ? (
                                <Lock size={13} aria-hidden="true" />
                              ) : allDone ? (
                                <CheckCircle2 size={14} aria-hidden="true" />
                              ) : (
                                <span className="tabular-nums">
                                  {doneInSec}/{items.length}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {activeSectionRubrics.length > 1 && (
                      <div className="vetra-rubric-grid">
                        {activeSectionRubrics.map((id) => {
                          const isDone = completedSteps.includes(id);
                          const unlocked =
                            !editable ||
                            isDone ||
                            id === nextSection ||
                            !nextSection;
                          const isCurrent = rubric === id;
                          const label =
                            canevas.rubrics.find((x: any) => x[0] === id)?.[3] ||
                            '';

                          return (
                            <button
                              type="button"
                              key={id}
                              disabled={!unlocked}
                              onClick={() => setRubric(id)}
                              className={[
                                'vetra-rubric-card',
                                isCurrent ? 'is-active' : '',
                                isDone ? 'is-done' : '',
                                !unlocked ? 'is-locked' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <span
                                className="vetra-rubric-card-icon"
                                aria-hidden="true"
                              >
                                <RubricIcon id={id} size={17} />
                              </span>
                              <span className="vetra-rubric-card-body">
                                <span className="vetra-rubric-card-top">
                                  <span className="vetra-rubric-code">
                                    {id}
                                  </span>
                                  {isDone ? (
                                    <CheckCircle2
                                      size={14}
                                      className="vetra-rubric-check"
                                      aria-hidden="true"
                                    />
                                  ) : !unlocked ? (
                                    <Lock
                                      size={13}
                                      className="vetra-rubric-lock"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </span>
                                <span className="vetra-rubric-card-title">
                                  {label}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {permittedSections.some((id) => id === rubric) && (
                    <>
                      <div className="vetra-active-rubric-bar">
                        <div className="vetra-active-rubric-left">
                          <RubricIcon id={rubric} colored />
                          <div className="min-w-0">
                            <h2 className="vetra-active-rubric-title">
                              <span className="vetra-active-rubric-code">
                                {rubric}
                              </span>
                              <span
                                className="vetra-active-rubric-dash"
                                aria-hidden="true"
                              >
                                —
                              </span>
                              <span>{activeRubricTitle}</span>
                            </h2>
                            <p className="vetra-active-rubric-hint">
                              <Sigma size={12} aria-hidden="true" />
                              <span>
                                Les totaux surlignés se mettent à jour
                                instantanément dès la saisie.
                                {editable
                                  ? ' Aucune activité sur cette rubrique ce mois-ci ? Laissez les champs vides et cliquez sur « Enregistrer et continuer ».'
                                  : ''}
                              </span>
                            </p>
                          </div>
                        </div>

                        {unlockedRubrics.length > 1 && (
                          <div className="vetra-rubric-stepper">
                            <button
                              type="button"
                              className="vetra-stepper-btn"
                              disabled={!prevRubric}
                              onClick={() => prevRubric && setRubric(prevRubric)}
                              title={
                                prevRubric
                                  ? `Aller à ${prevRubric}`
                                  : 'Première rubrique'
                              }
                            >
                              <ChevronLeft size={16} aria-hidden="true" />
                              <span>Précédente</span>
                            </button>
                            <button
                              type="button"
                              className="vetra-stepper-btn"
                              disabled={!nextUnlockedRubric}
                              onClick={() =>
                                nextUnlockedRubric &&
                                setRubric(nextUnlockedRubric)
                              }
                              title={
                                nextUnlockedRubric
                                  ? `Aller à ${nextUnlockedRubric}`
                                  : 'Dernière rubrique ouverte'
                              }
                            >
                              <span>Suivante</span>
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      <fieldset disabled={busy} className="min-w-0">
                        <CanevasTable
                          rubric={rubric}
                          values={values}
                          setValues={setValues}
                          editable={editable}
                        />
                      </fieldset>
                    </>
                  )}
                </>
              );
            })()}

            {(editable || current) && (
              <div className="vetra-saisie-dock">
                <div className="vetra-saisie-dock-primary">
                  {editable ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !permittedSections.length}
                        className="vetra-dock-btn is-secondary"
                        onClick={save}
                      >
                        <Save size={16} aria-hidden="true" />
                        <span>Enregistrer le brouillon</span>
                      </button>
                      {nextSection && (
                        <button
                          type="button"
                          disabled={busy || !rubric || rubric !== nextSection}
                          className="vetra-dock-btn is-primary"
                          onClick={completeRubric}
                        >
                          <span>
                            {completedSteps.length + 1 ===
                            permittedSections.length
                              ? 'Enregistrer la dernière rubrique'
                              : 'Enregistrer et continuer'}
                          </span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                      {!!permittedSections.length && !nextSection && (
                        <button
                          type="button"
                          disabled={busy || !current?.id}
                          className="vetra-dock-btn is-submit"
                          onClick={() => action(current?.id || '', 'soumettre')}
                        >
                          <Send size={15} aria-hidden="true" />
                          <span>Soumettre le rapport complet</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      {current?.status === 'VALIDE' ? (
                        <>
                          <BadgeCheck
                            size={16}
                            className="text-emerald-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-emerald-800">
                            Rapport validé
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Consultation et export uniquement</span>
                        </>
                      ) : current?.status === 'SOUMIS' ? (
                        <>
                          <Clock3
                            size={16}
                            className="text-amber-700 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-semibold text-amber-800">
                            Rapport soumis
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>En attente de validation</span>
                        </>
                      ) : (
                        <>
                          <Lock
                            size={15}
                            className="text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Mode consultation (lecture seule)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {current && (
                  <div
                    className="vetra-saisie-dock-exports"
                    aria-label="Exporter ou partager ce rapport"
                  >
                    <button
                      type="button"
                      title="Télécharger en Excel (XLSX)"
                      aria-label="Télécharger en Excel (XLSX)"
                      className="vetra-action-icon vetra-action-excel"
                      onClick={() => download(current.id, 'xlsx')}
                    >
                      <img
                        src="/icons/excel.png"
                        alt=""
                        width={22}
                        height={22}
                        className="vetra-brand-icon"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    <button
                      type="button"
                      title="Télécharger en PDF (Acrobat Reader)"
                      aria-label="Télécharger en PDF (Acrobat Reader)"
                      className="vetra-action-icon vetra-action-pdf"
                      onClick={() => download(current.id, 'pdf')}
                    >
                      <img
                        src="/icons/acrobat.png"
                        alt=""
                        width={22}
                        height={22}
                        className="vetra-brand-icon"
                        referrerPolicy="no-referrer"
                      />
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {tab === 'rapports' && periodReady && (
          <div className="panel">
            <div className="flex flex-wrap gap-3 items-end justify-between mb-4">
              <div>
                <h2 className="font-bold">Rapports et validation</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {months[month - 1]} {year} · services introduits et non introduits
                </p>
              </div>
              {centralScope && (
                <label className="grid gap-1 text-sm font-semibold">
                  Direction régionale
                  <select
                    aria-label="Filtrer les rapports par direction régionale"
                    value={validationRegionFilter}
                    onChange={(e) => setValidationRegionFilter(e.target.value)}
                  >
                    <option value="">Toutes les directions régionales</option>
                    {org.regions.map((r: Any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {centralScope && (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-3" role="tablist" aria-label="Basculer entre les directions régionales">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!validationRegionFilter}
                  className={'btn whitespace-nowrap ' + (validationRegionFilter ? 'alt' : '')}
                  onClick={() => setValidationRegionFilter('')}
                >
                  Toutes les directions
                </button>
                {org.regions.map((r: Any) => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={validationRegionFilter === r.id}
                    className={'btn whitespace-nowrap ' + (validationRegionFilter === r.id ? '' : 'alt')}
                    onClick={() => setValidationRegionFilter(r.id)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="État des rapports">
              {[
                ['TOUS', 'Tous'],
                ['SAISIS', 'Introduits'],
                ['NON INTRODUIT', 'Non introduits'],
                ['SOUMIS', 'En validation'],
                ['VALIDE', 'Validés'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={validationStatusFilter === id}
                  className={'btn ' + (validationStatusFilter === id ? '' : 'alt')}
                  onClick={() => setValidationStatusFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {validationReports.length === 0 && (
              <p className="text-sm text-slate-500 py-3">
                Aucun service pour cette direction ou cet état.
              </p>
            )}
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Direction régionale</th>
                    <th>Service</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {validationReports.map(({ service: s, report: r }: { service: Any; report: Any }) => (
                    <tr key={s.id}>
                      <td>{org.regions.find((x: Any) => x.id === s.division.regionId)?.name}</td>
                      <td>{s.name}</td>
                      <td>
                        <span className={'badge ' + (r?.status || '')}>
                          {r?.status || 'NON INTRODUIT'}
                        </span>
                      </td>
                      <td>
                        {r ? <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            title="Consulter le rapport"
                            aria-label="Consulter le rapport"
                            className="vetra-action-icon vetra-action-view"
                            onClick={() => {
                              setService(s.id);
                              setTab('saisie');
                            }}
                          >
                            <Eye size={19} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            title="Télécharger en Excel (XLSX)"
                            aria-label="Télécharger en Excel (XLSX)"
                            className="vetra-action-icon vetra-action-excel"
                            onClick={() => download(r.id, 'xlsx')}
                          >
                            <img
                              src="/icons/excel.png"
                              alt=""
                              width={22}
                              height={22}
                              className="vetra-brand-icon"
                              referrerPolicy="no-referrer"
                            />
                          </button>
                          <button
                            type="button"
                            title="Télécharger en PDF (Acrobat Reader)"
                            aria-label="Télécharger en PDF (Acrobat Reader)"
                            className="vetra-action-icon vetra-action-pdf"
                            onClick={() => download(r.id, 'pdf')}
                          >
                            <img
                              src="/icons/acrobat.png"
                              alt=""
                              width={22}
                              height={22}
                              className="vetra-brand-icon"
                              referrerPolicy="no-referrer"
                            />
                          </button>
                          <ReportEmail
                            endpoint={`/api/export/email?id=${encodeURIComponent(r.id)}`}
                            title={`Rapport ${r.month}/${r.year} · ${s.name}`}
                          />
                          <ReportShare
                            url={`/api/export?id=${encodeURIComponent(r.id)}&type=pdf`}
                            title={`Rapport ${r.month}/${r.year} · ${s.name}`}
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
                        </div> : <span className="text-sm text-slate-500">En attente de saisie</span>}
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
            isCentralDirector={me.user.role === 'DIRECTION_CENTRALE'}
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
        {tab === 'veille' && me.user.role === 'DIRECTION_CENTRALE' && (
          <CentralAiHub
            key={aiSection}
            year={year}
            month={month}
            initialSection={aiSection}
            onOpenReport={(serviceId) => {
              setService(serviceId);
              setTab('saisie');
            }}
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
                {
                  id: 'comptes',
                  label: resetRequests.length
                    ? `Comptes utilisateurs (${resetRequests.length})`
                    : 'Comptes utilisateurs',
                  Icon: Users,
                },
                { id: 'droits', label: 'Habilitations', Icon: KeyRound },
                { id: 'messagerie', label: 'Messagerie', Icon: Mail },
              ].map(({ id, label, Icon }) => (
                <button
                  type="button"
                  key={id}
                  aria-current={adminSection === id ? 'page' : undefined}
                  className={`btn inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${adminSection === id ? '' : 'alt'}`}
                  onClick={() => setAdminSection(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            {resetRequests.length > 0 && adminSection !== 'comptes' && (
              <div
                role="status"
                className="panel border-amber-300 bg-amber-50/70 flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <KeyRound
                    size={18}
                    className="text-amber-700 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold text-sm text-navy">
                      {resetRequests.length} demande
                      {resetRequests.length === 1 ? '' : 's'} de
                      réinitialisation de mot de passe en attente
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {resetRequests
                        .slice(0, 3)
                        .map((r) => `${r.firstName} ${r.name} (${r.email})`)
                        .join(' · ')}
                      {resetRequests.length > 3
                        ? ` · +${resetRequests.length - 3} autre(s)`
                        : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn green whitespace-nowrap shrink-0"
                  onClick={() => openResetRequests()}
                >
                  Traiter maintenant
                </button>
              </div>
            )}

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
              <AdminResetRequests
                requests={resetRequests}
                busy={busy}
                onSelectUser={(userId) => {
                  setEditingUserId('');
                  setResettingUserId(userId);
                  setTimeout(() => {
                    document
                      .getElementById('admin-reset-password-panel')
                      ?.scrollIntoView({ block: 'nearest' });
                  }, 0);
                }}
                onDismiss={async (userId) => {
                  setBusy(true);
                  try {
                    await api('admin', {
                      action: 'dismissResetRequest',
                      id: userId,
                    });
                    await reload();
                    tell('Demande clôturée');
                  } catch (e: any) {
                    tell(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {adminSection === 'comptes' && resettingUser && (
              <AdminPasswordReset
                user={resettingUser}
                api={api}
                onResolved={reload}
                onDone={(msg) => {
                  setResettingUserId('');
                  tell(msg);
                }}
                onCancel={() => setResettingUserId('')}
              />
            )}
            {adminSection === 'comptes' && (
              <div className="panel">
                <h2 className="font-bold mb-3">
                  {editingUser ? 'Modifier le compte utilisateur' : 'Créer un utilisateur'}
                </h2>
                <form
                  key={editingUser?.id ?? 'new'}
                  id="admin-user-form"
                  className="grid md:grid-cols-3 gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busy) return;
                    const form = e.currentTarget;
                    const d = Object.fromEntries(new FormData(form));
                    setBusy(true);
                    try {
                      await api('admin', editingUser
                        ? { action: 'userEdit', id: editingUser.id, ...d }
                        : { action: 'user', ...d });
                      form.reset();
                      setEditingUserId('');
                      await reload();
                      tell(editingUser ? 'Compte mis à jour' : 'Utilisateur créé');
                    } catch (e: any) {
                      tell(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {(editingUser
                    ? ['name', 'firstName', 'email', 'phone']
                    : ['name', 'firstName', 'email', 'phone', 'password']).map(
                    (k) => (
                      <input
                        key={k}
                        name={k}
                        defaultValue={editingUser?.[k] ?? ''}
                        className={
                          k === 'name' || k === 'firstName' ? 'uppercase' : undefined
                        }
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
                        onInput={
                          k === 'name' || k === 'firstName'
                            ? (event) => {
                                event.currentTarget.value =
                                  event.currentTarget.value.toLocaleUpperCase('fr-FR');
                              }
                            : undefined
                        }
                      />
                    ),
                  )}
                  {!editingUser && <>
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
                  </>}
                  <button className="btn" disabled={busy}>
                    {editingUser ? 'Enregistrer les modifications' : 'Créer le compte'}
                  </button>
                  {editingUser && (
                    <button type="button" className="btn alt" disabled={busy} onClick={() => setEditingUserId('')}>
                      Annuler
                    </button>
                  )}
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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn alt whitespace-nowrap shrink-0"
                                disabled={busy}
                                onClick={() => {
                                  setResettingUserId('');
                                  setEditingUserId(user.id);
                                  document.getElementById('admin-user-form')?.scrollIntoView({ block: 'start' });
                                }}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                className="btn alt whitespace-nowrap shrink-0"
                                disabled={busy}
                                onClick={() => {
                                  setEditingUserId('');
                                  setResettingUserId(user.id);
                                  setTimeout(() => {
                                    document.getElementById('admin-reset-password-panel')?.scrollIntoView({ block: 'nearest' });
                                  }, 0);
                                }}
                              >
                                Réinitialiser MDP
                              </button>
                              <button
                                className="btn alt whitespace-nowrap shrink-0"
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
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {adminSection === 'messagerie' && (
              <AdminMailDiagnostics api={api} />
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
                <div className="vetra-rights-grid mt-4">
                  {canevas.rubrics.map(([id, _a, _b, label]: any) => (
                    <label key={id} className="vetra-rights-label">
                      <input
                        type="checkbox"
                        className="vetra-rights-checkbox"
                        disabled={!service || busy}
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
                      <span>
                        <strong>{id}</strong> {label}
                      </span>
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
