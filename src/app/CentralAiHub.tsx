'use client';

import { useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  Radar,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { months, rubricLabels } from '@/lib/analytics';

export type CentralAiSection = 'summary' | 'anomalies' | 'qa' | 'signals';

interface SummaryResponse {
  titre: string;
  synthese: string;
  faitsMarquants: string[];
  pointsVigilance: string[];
  recommandations: string[];
  periodLabel: string;
  totalServices: number;
  coverage: Record<string, number>;
}

interface AnomalyItem {
  id: string;
  kind: string;
  priorite: 'HAUTE' | 'MOYENNE' | 'INFO';
  reportId: string | null;
  serviceId: string;
  serviceName: string;
  serviceKind: 'PROVINCIAL' | 'FRONTALIER';
  regionName: string;
  status: string;
  rubric: string;
  rubricLabel: string;
  metricLabel: string;
  observed: number | null;
  baselineMedian: number | null;
  ratio: number | null;
  diagnostic: string;
  motifSuggestion: string;
}

interface AnomaliesResponse {
  periodLabel: string;
  resume: string;
  anomalies: AnomalyItem[];
  scannedServices: number;
}

interface SignalItem {
  id: string;
  pattern: string;
  niveau: 'ALERTE' | 'VIGILANCE' | 'SUIVI';
  titre: string;
  rubric: string;
  rubricLabel: string;
  metricLabel: string;
  regions: string[];
  series: Array<{ period: string; value: number }>;
  changePercent: number | null;
  interpretation: string;
  actionRecommandee: string;
}

interface SignalsResponse {
  periodLabel: string;
  syntheseVeille: string;
  signaux: SignalItem[];
}

interface QaTurn {
  role: 'user' | 'assistant';
  text: string;
}

const STARTER_QUESTIONS = [
  'Quelles régions ont le meilleur et le plus faible taux de validation ce mois-ci ?',
  'Compare l’activité des postes frontaliers et des services provinciaux.',
  'Quels services n’ont pas encore transmis leur rapport pour cette période ?',
  'Quels indicateurs présentent les évolutions les plus marquées par rapport à l’an dernier ?',
];

async function callCentralAi<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/ai/central', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erreur lors de l’analyse IA.');
  }
  return data as T;
}

export default function CentralAiHub({
  year,
  month,
  initialSection = 'summary',
  onOpenReport,
}: {
  year: number;
  month: number;
  initialSection?: CentralAiSection;
  onOpenReport: (serviceId: string) => void;
}) {
  const [section, setSection] = useState<CentralAiSection>(initialSection);

  // 1. Executive Summary state
  const [summaryMode, setSummaryMode] = useState<'month' | 'year'>('month');
  const [summaryRubric, setSummaryRubric] = useState('');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [copiedId, setCopiedId] = useState('');

  // 2. Anomalies state
  const [anomaliesBusy, setAnomaliesBusy] = useState(false);
  const [anomaliesError, setAnomaliesError] = useState('');
  const [anomaliesData, setAnomaliesData] = useState<AnomaliesResponse | null>(
    null,
  );
  const [priorityFilter, setPriorityFilter] = useState<string>('TOUS');

  // 3. Natural language Q&A state
  const [qaInput, setQaInput] = useState('');
  const [qaBusy, setQaBusy] = useState(false);
  const [qaError, setQaError] = useState('');
  const [qaTurns, setQaTurns] = useState<QaTurn[]>([]);

  // 5. Weak signals state
  const [signalsBusy, setSignalsBusy] = useState(false);
  const [signalsError, setSignalsError] = useState('');
  const [signalsData, setSignalsData] = useState<SignalsResponse | null>(null);

  const periodText = `${months[month - 1]} ${year}`;

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2500);
    } catch {
      // Clipboard API unavailable
    }
  }

  async function runSummary() {
    setSummaryBusy(true);
    setSummaryError('');
    try {
      const data = await callCentralAi<SummaryResponse>({
        action: 'summary',
        year,
        month,
        mode: summaryMode,
        group: 'all',
        ids: [],
        rubrics: summaryRubric ? [summaryRubric] : [],
      });
      setSummaryData(data);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Erreur lors de la génération.',
      );
    } finally {
      setSummaryBusy(false);
    }
  }

  async function runAnomalies() {
    setAnomaliesBusy(true);
    setAnomaliesError('');
    try {
      const data = await callCentralAi<AnomaliesResponse>({
        action: 'anomalies',
        year,
        month,
      });
      setAnomaliesData(data);
    } catch (err) {
      setAnomaliesError(
        err instanceof Error ? err.message : 'Erreur lors de l’audit qualité.',
      );
    } finally {
      setAnomaliesBusy(false);
    }
  }

  async function runSignals() {
    setSignalsBusy(true);
    setSignalsError('');
    try {
      const data = await callCentralAi<SignalsResponse>({
        action: 'signals',
        year,
        month,
      });
      setSignalsData(data);
    } catch (err) {
      setSignalsError(
        err instanceof Error ? err.message : 'Erreur lors de l’analyse de veille.',
      );
    } finally {
      setSignalsBusy(false);
    }
  }

  async function askQuestion(questionText: string) {
    const clean = questionText.trim();
    if (!clean || qaBusy) return;
    setQaError('');
    setQaBusy(true);
    const historyToSend = qaTurns.slice(-6);
    setQaTurns((prev) => [...prev, { role: 'user', text: clean }]);
    setQaInput('');
    try {
      const data = await callCentralAi<{ answer: string }>({
        action: 'qa',
        year,
        month,
        question: clean,
        history: historyToSend,
      });
      setQaTurns((prev) => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setQaError(
        err instanceof Error ? err.message : 'Impossible de répondre à la question.',
      );
    } finally {
      setQaBusy(false);
    }
  }

  function handleQaSubmit(e: FormEvent) {
    e.preventDefault();
    askQuestion(qaInput);
  }

  const tabs: Array<{
    id: CentralAiSection;
    label: string;
    Icon: typeof FileText;
  }> = [
    { id: 'summary', label: 'Synthèse exécutive', Icon: FileText },
    { id: 'anomalies', label: 'Contrôle qualité & Anomalies', Icon: ShieldAlert },
    { id: 'qa', label: 'Assistant analytique', Icon: MessageSquareText },
    { id: 'signals', label: 'Veille sanitaire (Signaux faibles)', Icon: Radar },
  ];

  const filteredAnomalies = (anomaliesData?.anomalies ?? []).filter(
    (item) => priorityFilter === 'TOUS' || item.priorite === priorityFilter,
  );

  const highCount = (anomaliesData?.anomalies ?? []).filter(
    (a) => a.priorite === 'HAUTE',
  ).length;
  const mediumCount = (anomaliesData?.anomalies ?? []).filter(
    (a) => a.priorite === 'MOYENNE',
  ).length;

  return (
    <section className="space-y-4">
      <nav
        aria-label="Modules d’analyse IA Direction centrale"
        className="panel flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? 'page' : undefined}
              className={`btn inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                section === id ? '' : 'alt'
              }`}
              onClick={() => setSection(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-slate-600 tabular-nums">
          Période active : {periodText}
        </span>
      </nav>

      {/* 1. SYNTHÈSE EXÉCUTIVE */}
      {section === 'summary' && (
        <div className="panel space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-lg text-navy flex items-center gap-2">
                <Sparkles size={18} className="text-teal" aria-hidden="true" />
                Synthèse exécutive nationale
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Génère une note de briefing institutionnelle consolidée à partir
                des rapports validés et de la couverture nationale.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Portée temporelle"
                value={summaryMode}
                disabled={summaryBusy}
                onChange={(e) =>
                  setSummaryMode(e.target.value as 'month' | 'year')
                }
              >
                <option value="month">Mois : {periodText}</option>
                <option value="year">Cumul annuel : {year}</option>
              </select>
              <select
                aria-label="Filtrer par rubrique"
                value={summaryRubric}
                disabled={summaryBusy}
                onChange={(e) => setSummaryRubric(e.target.value)}
                className="max-w-xs"
              >
                <option value="">Toutes les rubriques</option>
                {Object.entries(rubricLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {id} · {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                disabled={summaryBusy}
                onClick={runSummary}
              >
                {summaryBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {summaryBusy ? 'Rédaction en cours…' : 'Générer la synthèse'}
              </button>
            </div>
          </div>

          {summaryError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {summaryError}
            </div>
          )}

          {summaryData ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                    Note de synthèse · {summaryData.periodLabel}
                  </p>
                  <h3 className="text-lg font-bold text-navy mt-0.5">
                    {summaryData.titre}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn alt inline-flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0"
                  onClick={() => {
                    const memo = [
                      summaryData.titre,
                      `Période : ${summaryData.periodLabel}`,
                      '',
                      summaryData.synthese,
                      '',
                      'FAITS MARQUANTS :',
                      ...summaryData.faitsMarquants.map((f) => `- ${f}`),
                      '',
                      'POINTS DE VIGILANCE :',
                      ...summaryData.pointsVigilance.map((p) => `- ${p}`),
                      '',
                      'RECOMMANDATIONS :',
                      ...summaryData.recommandations.map((r) => `- ${r}`),
                    ].join('\n');
                    copyText('summary-memo', memo);
                  }}
                >
                  {copiedId === 'summary-memo' ? (
                    <>
                      <Check size={15} className="text-teal" />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      Copier la note
                    </>
                  )}
                </button>
              </div>

              <p className="text-sm leading-relaxed text-slate-800">
                {summaryData.synthese}
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <h4 className="font-bold text-sm text-navy">
                    Faits marquants
                  </h4>
                  <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                    {summaryData.faitsMarquants.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
                  <h4 className="font-bold text-sm text-amber-900">
                    Points de vigilance
                  </h4>
                  <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                    {summaryData.pointsVigilance.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                  <h4 className="font-bold text-sm text-emerald-900">
                    Recommandations
                  </h4>
                  <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                    {summaryData.recommandations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            !summaryBusy && (
              <p className="text-sm text-slate-600 py-4">
                Cliquez sur <strong>Générer la synthèse</strong> pour produire
                la note de direction consolidée pour{' '}
                {summaryMode === 'year' ? `l’année ${year}` : periodText}.
              </p>
            )
          )}
        </div>
      )}

      {/* 2. CONTRÔLE QUALITÉ & ANOMALIES */}
      {section === 'anomalies' && (
        <div className="panel space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-lg text-navy flex items-center gap-2">
                <ShieldAlert
                  size={18}
                  className="text-amber-700"
                  aria-hidden="true"
                />
                Contrôle qualité &amp; détection d’anomalies
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Compare chaque rapport de {periodText} à l’historique validé du
                service (pics inhabituels, chutes à zéro, taux hors bornes,
                défauts de transmission).
              </p>
            </div>
            <button
              type="button"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={anomaliesBusy}
              onClick={runAnomalies}
            >
              {anomaliesBusy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldAlert size={16} />
              )}
              {anomaliesBusy ? 'Audit en cours…' : 'Lancer l’audit qualité'}
            </button>
          </div>

          {anomaliesError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {anomaliesError}
            </div>
          )}

          {anomaliesData ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-xs font-semibold text-slate-600">
                    Services audités
                  </span>
                  <strong className="block text-2xl text-navy tabular-nums">
                    {anomaliesData.scannedServices}
                  </strong>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3">
                  <span className="text-xs font-semibold text-rose-800">
                    Priorité haute
                  </span>
                  <strong className="block text-2xl text-rose-900 tabular-nums">
                    {highCount}
                  </strong>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                  <span className="text-xs font-semibold text-amber-800">
                    Priorité moyenne
                  </span>
                  <strong className="block text-2xl text-amber-900 tabular-nums">
                    {mediumCount}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-800">
                <strong className="text-navy">Bilan d’audit : </strong>
                {anomaliesData.resume}
              </div>

              {anomaliesData.anomalies.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {['TOUS', 'HAUTE', 'MOYENNE', 'INFO'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`btn text-xs py-1.5 px-3 ${
                          priorityFilter === lvl ? '' : 'alt'
                        }`}
                        onClick={() => setPriorityFilter(lvl)}
                      >
                        {lvl === 'TOUS'
                          ? `Toutes (${anomaliesData.anomalies.length})`
                          : lvl}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {filteredAnomalies.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`badge ${
                                  item.priorite === 'HAUTE'
                                    ? 'REVOQUE'
                                    : item.priorite === 'MOYENNE'
                                      ? 'SOUMIS'
                                      : 'BROUILLON'
                                }`}
                              >
                                {item.priorite}
                              </span>
                              <strong className="text-navy text-sm">
                                {item.serviceName}
                              </strong>
                              <span className="text-xs text-slate-500">
                                {item.regionName} · {item.status}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-teal mt-1">
                              {item.rubric} · {item.metricLabel}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {item.observed != null && (
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg px-2.5 py-1 tabular-nums">
                                Observé : {item.observed.toLocaleString('fr-FR')}
                                {item.baselineMedian != null
                                  ? ` · Médiane : ${item.baselineMedian.toLocaleString('fr-FR')}`
                                  : ''}
                                {item.ratio != null && item.ratio > 0
                                  ? ` (${item.ratio}×)`
                                  : ''}
                              </span>
                            )}
                            {item.reportId && (
                              <button
                                type="button"
                                className="btn alt inline-flex items-center gap-1.5 text-xs py-1.5 px-2.5"
                                onClick={() => onOpenReport(item.serviceId)}
                              >
                                <Eye size={14} />
                                Consulter
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn alt inline-flex items-center gap-1.5 text-xs py-1.5 px-2.5"
                              onClick={() =>
                                copyText(item.id, item.motifSuggestion)
                              }
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check size={14} className="text-teal" />
                                  Motif copié
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  Copier motif
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-sm text-slate-800">
                          {item.diagnostic}
                        </p>
                        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <strong className="text-slate-700">
                            Motif suggéré :
                          </strong>{' '}
                          {item.motifSuggestion}
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            !anomaliesBusy && (
              <p className="text-sm text-slate-600 py-4">
                Lancez l’audit pour identifier les valeurs atypiques, écarts de
                saisie potentiels et retards de transmission sur {periodText}.
              </p>
            )
          )}
        </div>
      )}

      {/* 3. ASSISTANT ANALYTIQUE EN LANGAGE NATUREL */}
      {section === 'qa' && (
        <div className="panel space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-lg text-navy flex items-center gap-2">
                <MessageSquareText
                  size={18}
                  className="text-teal"
                  aria-hidden="true"
                />
                Assistant analytique VETRA
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Interrogez directement les données nationales consolidées en
                français ou en arabe (période de référence : {periodText} et
                comparatif {year - 1}/{year}).
              </p>
            </div>
            {qaTurns.length > 0 && (
              <button
                type="button"
                className="btn alt inline-flex items-center gap-1.5 text-xs"
                onClick={() => {
                  setQaTurns([]);
                  setQaError('');
                }}
              >
                <RotateCcw size={14} />
                Nouvelle conversation
              </button>
            )}
          </div>

          {qaTurns.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Questions rapides
              </p>
              <div className="grid md:grid-cols-2 gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={qaBusy}
                    className="text-left text-sm rounded-xl border border-slate-200 hover:border-teal hover:bg-slate-50 px-3.5 py-2.5 text-navy transition-colors"
                    onClick={() => askQuestion(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {qaTurns.length > 0 && (
            <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
              {qaTurns.map((turn, idx) => (
                <div
                  key={idx}
                  className={
                    turn.role === 'user'
                      ? 'ml-auto max-w-2xl rounded-xl bg-navy text-white px-4 py-3 text-sm'
                      : 'mr-auto max-w-3xl rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800'
                  }
                >
                  {turn.role === 'user' ? (
                    <p>{turn.text}</p>
                  ) : (
                    <div className="space-y-2 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-navy [&_h3]:font-bold [&_h3]:text-navy [&_p]:mb-1.5">
                      <Markdown>{turn.text}</Markdown>
                    </div>
                  )}
                </div>
              ))}
              {qaBusy && (
                <div className="mr-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                  <Loader2 size={15} className="animate-spin text-teal" />
                  Analyse des données consolidées…
                </div>
              )}
            </div>
          )}

          {qaError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {qaError}
            </div>
          )}

          <form onSubmit={handleQaSubmit} className="flex flex-wrap gap-2 pt-2">
            <input
              type="text"
              value={qaInput}
              disabled={qaBusy}
              maxLength={800}
              aria-label="Poser une question sur les données VETRA"
              placeholder="Posez votre question (ex. Quelles régions enregistrent le plus d’inspections ce trimestre ?)"
              className="flex-1 min-w-[240px]"
              onChange={(e) => setQaInput(e.target.value)}
            />
            <button
              type="submit"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={qaBusy || qaInput.trim().length < 3}
            >
              {qaBusy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Interroger
            </button>
          </form>
        </div>
      )}

      {/* 5. VEILLE SANITAIRE — SIGNAUX FAIBLES */}
      {section === 'signals' && (
        <div className="panel space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-lg text-navy flex items-center gap-2">
                <Radar size={18} className="text-teal" aria-hidden="true" />
                Veille sanitaire — Détection de signaux faibles
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Analyse multi-régionale sur 6 mois glissants (fin : {periodText})
                pour détecter les hausses continues, progressions simultanées
                entre régions ou décrochages de couverture.
              </p>
            </div>
            <button
              type="button"
              className="btn green inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              disabled={signalsBusy}
              onClick={runSignals}
            >
              {signalsBusy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Radar size={16} />
              )}
              {signalsBusy ? 'Analyse en cours…' : 'Détecter les signaux faibles'}
            </button>
          </div>

          {signalsError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {signalsError}
            </div>
          )}

          {signalsData ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-800">
                <strong className="text-navy">Synthèse de veille : </strong>
                {signalsData.syntheseVeille}
              </div>

              {signalsData.signaux.length > 0 && (
                <div className="grid lg:grid-cols-2 gap-4">
                  {signalsData.signaux.map((sig) => (
                    <article
                      key={sig.id}
                      className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`badge ${
                                sig.niveau === 'ALERTE'
                                  ? 'REVOQUE'
                                  : sig.niveau === 'VIGILANCE'
                                    ? 'SOUMIS'
                                    : 'BROUILLON'
                              }`}
                            >
                              {sig.niveau === 'ALERTE' && (
                                <AlertTriangle
                                  size={12}
                                  className="inline mr-1 -mt-0.5"
                                />
                              )}
                              {sig.niveau}
                            </span>
                            <span className="text-xs font-semibold text-teal">
                              {sig.rubric} · {sig.metricLabel}
                            </span>
                          </div>
                          <h3 className="font-bold text-navy text-sm">
                            {sig.titre}
                          </h3>
                        </div>
                        {sig.changePercent != null && (
                          <span className="text-xs font-bold text-navy bg-slate-100 rounded-lg px-2.5 py-1 tabular-nums">
                            {sig.changePercent > 0 ? '+' : ''}
                            {sig.changePercent} %
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        <strong className="text-slate-700">
                          Régions concernées :
                        </strong>{' '}
                        {sig.regions.join(', ')}
                      </p>

                      {sig.series.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                          {sig.series.map((pt) => (
                            <div
                              key={pt.period}
                              className="rounded-lg bg-slate-50 border border-slate-100 px-1.5 py-1.5"
                            >
                              <div className="text-[10px] text-slate-500 truncate">
                                {pt.period.slice(0, 3)}
                              </div>
                              <div className="text-xs font-bold text-navy tabular-nums">
                                {pt.value.toLocaleString('fr-FR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-slate-800">
                        {sig.interpretation}
                      </p>

                      <p className="text-xs text-emerald-950 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2">
                        <strong>Action recommandée :</strong>{' '}
                        {sig.actionRecommandee}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : (
            !signalsBusy && (
              <p className="text-sm text-slate-600 py-4">
                Lancez l’analyse pour repérer automatiquement les tendances
                émergentes sur les 6 derniers mois à travers l’ensemble des
                directions régionales.
              </p>
            )
          )}
        </div>
      )}
    </section>
  );
}
