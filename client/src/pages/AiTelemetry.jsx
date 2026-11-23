import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Sparkles,
    RefreshCw,
    Download,
    Search,
    Mic,
    Keyboard,
    ThumbsUp,
    ThumbsDown,
    Cpu,
    Database,
    Clock,
    Layers,
    Code,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';
import {
    getAssistantTelemetry,
    getAssistantDiagnostics,
    recordAssistantTelemetry,
} from '../services/api';
import './AiTelemetry.css';

const SOURCE_LABELS = {
    openai_responses: { label: 'OpenAI (1 paso)', badgeClass: 'ait-badge-openai' },
    openai_responses_with_data: {
        label: 'OpenAI + Datos Bajo Demanda',
        badgeClass: 'ait-badge-ondemand',
    },
    contextual_planner: { label: 'Contextual Fallback', badgeClass: 'ait-badge-fallback' },
    local_matcher: { label: 'Local Matcher', badgeClass: 'ait-badge-local' },
};

const formatDateTime = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-CO', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    } catch {
        return iso;
    }
};

const AiTelemetry = () => {
    const [traces, setTraces] = useState([]);
    const [summary, setSummary] = useState({
        totalTraces: 0,
        positiveCount: 0,
        negativeCount: 0,
        datasetFile: '',
    });
    const [diagnostics, setDiagnostics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterMode, setFilterMode] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedJsonIds, setExpandedJsonIds] = useState({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [telRes, diagRes] = await Promise.all([
                getAssistantTelemetry({ limit: 200 }),
                getAssistantDiagnostics().catch(() => null),
            ]);
            const telData = telRes?.data || telRes || {};
            const list = Array.isArray(telData.traces) ? [...telData.traces].reverse() : [];
            setTraces(list);
            setSummary({
                totalTraces: telData.totalTraces ?? list.length,
                positiveCount: telData.positiveCount ?? list.filter((t) => t.reward === 1).length,
                negativeCount: telData.negativeCount ?? list.filter((t) => t.reward === -1).length,
                datasetFile: telData.datasetFile || 'server/scratch/assistant_rl_dataset.jsonl',
            });
            if (diagRes?.data) {
                setDiagnostics(diagRes.data);
            }
        } catch (err) {
            console.error('Error loading AI telemetry:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRateTrace = async (traceId, reward) => {
        setTraces((prev) =>
            prev.map((t) => (t.traceId === traceId ? { ...t, reward } : t))
        );
        try {
            await recordAssistantTelemetry({
                eventType: 'feedback',
                traceId,
                reward,
            });
        } catch (err) {
            console.error('Failed to save rating:', err);
        }
    };

    const toggleRawJson = (traceId) => {
        setExpandedJsonIds((prev) => ({ ...prev, [traceId]: !prev[traceId] }));
    };

    const computedStats = useMemo(() => {
        let totalInput = 0;
        let totalCached = 0;
        let latencySum = 0;
        let latencyCount = 0;
        let openAiCount = 0;
        let onDemandCount = 0;
        let fallbackCount = 0;
        let voiceCount = 0;

        for (const t of traces) {
            if (t.viaVoice) voiceCount += 1;
            if (t.plannerSource === 'openai_responses') openAiCount += 1;
            else if (t.plannerSource === 'openai_responses_with_data') {
                openAiCount += 1;
                onDemandCount += 1;
            } else if (t.plannerSource === 'contextual_planner') fallbackCount += 1;

            const m = t.metrics || {};
            if (typeof m.input_tokens === 'number') totalInput += m.input_tokens;
            if (typeof m.cached_tokens === 'number') totalCached += m.cached_tokens;
            if (typeof m.latency_ms === 'number' && m.latency_ms > 0) {
                latencySum += m.latency_ms;
                latencyCount += 1;
            }
        }

        const cacheHitPct =
            totalInput > 0 ? Math.round((totalCached / totalInput) * 1000) / 10 : 0;
        const avgLatencyMs = latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0;
        const posCount = traces.filter((t) => t.reward === 1).length;
        const negCount = traces.filter((t) => t.reward === -1).length;

        return {
            totalInput,
            totalCached,
            cacheHitPct,
            avgLatencyMs,
            openAiCount,
            onDemandCount,
            fallbackCount,
            voiceCount,
            posCount,
            negCount,
        };
    }, [traces]);

    const filteredTraces = useMemo(() => {
        return traces.filter((t) => {
            if (filterMode === 'openai' && !String(t.plannerSource).startsWith('openai')) {
                return false;
            }
            if (
                filterMode === 'ondemand' &&
                t.plannerSource !== 'openai_responses_with_data' &&
                !t.plan?.onDemandDataUsed
            ) {
                return false;
            }
            if (filterMode === 'fallback' && t.plannerSource !== 'contextual_planner') {
                return false;
            }
            if (filterMode === 'positive' && t.reward !== 1) return false;
            if (filterMode === 'negative' && t.reward !== -1) return false;
            if (filterMode === 'unrated' && (t.reward === 1 || t.reward === -1)) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const hay = [
                    t.userText,
                    t.assistantFinalText,
                    t.plan?.responseTemplate,
                    t.plan?.targetModule,
                    t.applicationContext?.currentRoute,
                    t.traceId,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [traces, filterMode, searchQuery]);

    const handleExportJsonl = () => {
        const lines = filteredTraces.map((t) => JSON.stringify(t)).join('\n');
        const blob = new Blob([lines + '\n'], { type: 'application/x-ndjson' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `upay_assistant_telemetry_${new Date().toISOString().slice(0, 10)}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="ai-telemetry-page">
            {/* Header */}
            <div className="ait-header">
                <div className="ait-header-left">
                    <div className="ait-header-icon">
                        <Sparkles size={24} />
                    </div>
                    <div className="ait-header-title">
                        <h1>Telemetría IA & Dataset RLHF</h1>
                        <p>
                            Radiografía en vivo de cada pregunta, Prompt Caching, llamadas de datos
                            bajo demanda y calificación para Fine-Tuning
                        </p>
                    </div>
                </div>
                <div className="ait-header-actions">
                    <button className="ait-btn" onClick={handleExportJsonl}>
                        <Download size={16} />
                        <span>Exportar JSONL ({filteredTraces.length})</span>
                    </button>
                    <button className="ait-btn ait-btn-primary" onClick={loadData}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="ait-kpi-grid">
                <div className="ait-kpi-card">
                    <div className="ait-kpi-top">
                        <span>Turnos Capturados</span>
                        <Layers size={16} />
                    </div>
                    <div className="ait-kpi-value">{traces.length}</div>
                    <div className="ait-kpi-sub">
                        <span>🎙️ {computedStats.voiceCount} por voz</span>
                        <span>·</span>
                        <span>⌨️ {traces.length - computedStats.voiceCount} por texto</span>
                    </div>
                </div>

                <div className="ait-kpi-card">
                    <div className="ait-kpi-top">
                        <span>Prompt Cache Hit Rate</span>
                        <Cpu size={16} />
                    </div>
                    <div className="ait-kpi-value" style={{ color: '#059669' }}>
                        {computedStats.cacheHitPct}%
                    </div>
                    <div className="ait-kpi-sub">
                        <span>
                            {computedStats.totalCached.toLocaleString()} /{' '}
                            {computedStats.totalInput.toLocaleString()} tokens cacheados
                        </span>
                    </div>
                </div>

                <div className="ait-kpi-card">
                    <div className="ait-kpi-top">
                        <span>Motor de Decisión</span>
                        <Database size={16} />
                    </div>
                    <div className="ait-kpi-value">{computedStats.openAiCount} OpenAI</div>
                    <div className="ait-kpi-sub">
                        <span style={{ color: '#7e22ce', fontWeight: 600 }}>
                            ⚡ {computedStats.onDemandCount} con datos bajo demanda
                        </span>
                        <span>·</span>
                        <span>{computedStats.fallbackCount} fallback</span>
                    </div>
                </div>

                <div className="ait-kpi-card">
                    <div className="ait-kpi-top">
                        <span>Latencia & Feedback RLHF</span>
                        <Clock size={16} />
                    </div>
                    <div className="ait-kpi-value">
                        {(computedStats.avgLatencyMs / 1000).toFixed(1)}s
                    </div>
                    <div className="ait-kpi-sub">
                        <span style={{ color: '#059669', fontWeight: 700 }}>
                            👍 {computedStats.posCount}
                        </span>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            👎 {computedStats.negCount}
                        </span>
                        <span>
                            Sin calificar:{' '}
                            {Math.max(
                                0,
                                traces.length - computedStats.posCount - computedStats.negCount
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="ait-filters-bar">
                <div className="ait-chip-group">
                    {[
                        { id: 'all', label: `Todos (${traces.length})` },
                        { id: 'openai', label: `OpenAI (${computedStats.openAiCount})` },
                        {
                            id: 'ondemand',
                            label: `⚡ Datos bajo demanda (${computedStats.onDemandCount})`,
                        },
                        { id: 'fallback', label: `Fallback (${computedStats.fallbackCount})` },
                        { id: 'positive', label: `👍 Positivos (${computedStats.posCount})` },
                        { id: 'negative', label: `👎 Negativos (${computedStats.negCount})` },
                        { id: 'unrated', label: 'Sin calificar' },
                    ].map((chip) => (
                        <button
                            key={chip.id}
                            className={`ait-chip ${filterMode === chip.id ? 'active' : ''}`}
                            onClick={() => setFilterMode(chip.id)}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>

                <div className="ait-search-box">
                    <Search size={16} color="#64748b" />
                    <input
                        type="text"
                        placeholder="Buscar por pregunta, placa, módulo o respuesta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Traces Timeline */}
            {filteredTraces.length === 0 ? (
                <div
                    className="ait-kpi-card"
                    style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}
                >
                    {loading
                        ? 'Cargando trazas de telemetría...'
                        : 'No hay trazas que coincidan con el filtro seleccionado.'}
                </div>
            ) : (
                <div className="ait-traces-list">
                    {filteredTraces.map((trace) => {
                        const srcInfo = SOURCE_LABELS[trace.plannerSource] || {
                            label: trace.plannerSource || 'Desconocido',
                            badgeClass: 'ait-badge-route',
                        };
                        const m = trace.metrics || {};
                        const cacheRatioPct =
                            typeof m.cache_hit_ratio === 'number'
                                ? Math.round(m.cache_hit_ratio * 100)
                                : null;
                        const actions = trace.executedActions?.length
                            ? trace.executedActions
                            : trace.plan?.actions || [];
                        const resolvedEntries = Object.entries(trace.resolvedPlaceholders || {});
                        const toolCalls = Array.isArray(m.on_demand_tool_calls)
                            ? m.on_demand_tool_calls
                            : [];
                        const activeFilters = trace.applicationContext?.activeFilters || {};

                        return (
                            <div
                                key={trace.traceId}
                                className={`ait-trace-card ${
                                    trace.reward === 1
                                        ? 'reward-pos'
                                        : trace.reward === -1
                                        ? 'reward-neg'
                                        : toolCalls.length > 0 || trace.plan?.onDemandDataUsed
                                        ? 'ondemand-used'
                                        : ''
                                }`}
                            >
                                {/* Card Header */}
                                <div className="ait-trace-header">
                                    <div className="ait-trace-meta">
                                        <span className={`ait-badge ${srcInfo.badgeClass}`}>
                                            {srcInfo.label}
                                        </span>
                                        <span
                                            className={`ait-badge ${
                                                trace.viaVoice
                                                    ? 'ait-badge-voice'
                                                    : 'ait-badge-text'
                                            }`}
                                        >
                                            {trace.viaVoice ? (
                                                <>
                                                    <Mic size={12} /> Voz
                                                </>
                                            ) : (
                                                <>
                                                    <Keyboard size={12} /> Texto
                                                </>
                                            )}
                                        </span>
                                        <span className="ait-badge ait-badge-route">
                                            Pantalla:{' '}
                                            {trace.applicationContext?.currentRoute || '/'} (
                                            {trace.applicationContext?.currentModule || 'dashboard'}
                                            )
                                        </span>
                                        {trace.plan?.targetModule && (
                                            <span className="ait-badge ait-badge-route">
                                                Destino: {trace.plan.targetModule} (
                                                {trace.plan.scope})
                                            </span>
                                        )}
                                        {trace.plan?.needsClarification && (
                                            <span className="ait-badge ait-badge-fallback">
                                                <AlertTriangle size={12} /> Pidió aclaración
                                            </span>
                                        )}
                                    </div>
                                    <div className="ait-trace-time">
                                        {formatDateTime(trace.timestamp)} ·{' '}
                                        <code>{trace.traceId}</code>
                                    </div>
                                </div>

                                {/* Card Body: Dialogue vs X-Ray Pipeline */}
                                <div className="ait-trace-body">
                                    {/* Left: User Question & Assistant Final Response */}
                                    <div className="ait-dialogue-col">
                                        <div>
                                            <div className="ait-box-label">
                                                Pregunta del usuario ({trace.lang || 'es-CO'})
                                            </div>
                                            <div className="ait-user-bubble">
                                                “{trace.userText}”
                                            </div>
                                        </div>

                                        <div>
                                            <div className="ait-box-label">
                                                Respuesta leída y escrita en el chat
                                            </div>
                                            <div className="ait-assistant-bubble">
                                                <div>
                                                    {trace.assistantFinalText ||
                                                        trace.plan?.responseTemplate ||
                                                        '—'}
                                                </div>
                                                {trace.plan?.responseTemplate &&
                                                    trace.assistantFinalText &&
                                                    trace.plan.responseTemplate !==
                                                        trace.assistantFinalText && (
                                                        <div className="ait-template-hint">
                                                            Plantilla OpenAI:{' '}
                                                            {trace.plan.responseTemplate}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Pipeline Inspection */}
                                    <div className="ait-pipeline-col">
                                        <div className="ait-box-label">
                                            Radiografía de Ejecución
                                        </div>

                                        <div className="ait-pipeline-row">
                                            <span className="ait-pipeline-key">
                                                Filtros previos:
                                            </span>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: '6px',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                {Object.entries(activeFilters)
                                                    .filter(([, v]) => v !== '' && v !== null)
                                                    .map(([k, v]) => (
                                                        <span key={k} className="ait-code-pill">
                                                            {k}: {String(v)}
                                                        </span>
                                                    ))}
                                                {trace.applicationContext?.selectedItem && (
                                                    <span className="ait-code-pill">
                                                        selectedItem:{' '}
                                                        {trace.applicationContext.selectedItem}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {toolCalls.length > 0 && (
                                            <div className="ait-pipeline-row">
                                                <span className="ait-pipeline-key">
                                                    Tool Bajo Demanda:
                                                </span>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    {toolCalls.map((tc, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="ait-code-pill tool-call"
                                                        >
                                                            ⚡ {tc.tool}({JSON.stringify(tc.args)})
                                                            → {tc.recordsReturned}/
                                                            {tc.totalMatching} registros
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="ait-pipeline-row">
                                            <span className="ait-pipeline-key">
                                                Acciones UI ({actions.length}):
                                            </span>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: '6px',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                {actions.length === 0 ? (
                                                    <span className="ait-code-pill">
                                                        Ninguna (solo respuesta conversacional)
                                                    </span>
                                                ) : (
                                                    actions.map((act, idx) => (
                                                        <span key={idx} className="ait-code-pill">
                                                            <CheckCircle2
                                                                size={12}
                                                                color="#10b981"
                                                            />
                                                            {act.name}({JSON.stringify(act.params)})
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="ait-pipeline-row">
                                            <span className="ait-pipeline-key">
                                                Datos resueltos:
                                            </span>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: '6px',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                {resolvedEntries.length === 0 ? (
                                                    <span
                                                        style={{
                                                            color: '#64748b',
                                                            fontSize: '0.78rem',
                                                        }}
                                                    >
                                                        {toolCalls.length > 0
                                                            ? 'Inyectados directamente por fetch_module_records'
                                                            : 'Sin placeholders en plantilla'}
                                                    </span>
                                                ) : (
                                                    resolvedEntries.map(([k, v]) => (
                                                        <span
                                                            key={k}
                                                            className="ait-code-pill placeholder-pill"
                                                        >
                                                            {`{{${k}}}`} = <strong>{v}</strong>
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {m.fallback_reason && (
                                            <div className="ait-pipeline-row">
                                                <span
                                                    className="ait-pipeline-key"
                                                    style={{ color: '#b45309' }}
                                                >
                                                    Motivo Fallback:
                                                </span>
                                                <span
                                                    className="ait-code-pill"
                                                    style={{
                                                        borderColor: '#fde68a',
                                                        background: '#fffbeb',
                                                        color: '#92400e',
                                                    }}
                                                >
                                                    {m.fallback_reason}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer: Metrics & RLHF Rating */}
                                <div className="ait-trace-footer">
                                    <div className="ait-metrics-strip">
                                        <span className="ait-metric-item">
                                            <Clock size={13} />
                                            <strong>{m.latency_ms ?? '—'} ms</strong>
                                        </span>

                                        {typeof m.input_tokens === 'number' && (
                                            <>
                                                <span className="ait-metric-item">
                                                    Tokens In: <strong>{m.input_tokens}</strong> (
                                                    Cached: <strong>{m.cached_tokens ?? 0}</strong>)
                                                </span>
                                                <span className="ait-metric-item">
                                                    Tokens Out: <strong>{m.output_tokens}</strong>
                                                </span>
                                            </>
                                        )}

                                        {cacheRatioPct !== null && (
                                            <span className="ait-metric-item">
                                                Cache Hit:{' '}
                                                <strong style={{ color: '#059669' }}>
                                                    {cacheRatioPct}%
                                                </strong>
                                                <span className="ait-cache-bar">
                                                    <span
                                                        className="ait-cache-fill"
                                                        style={{ width: `${cacheRatioPct}%` }}
                                                    />
                                                </span>
                                            </span>
                                        )}

                                        <button
                                            className="ait-raw-toggle"
                                            onClick={() => toggleRawJson(trace.traceId)}
                                        >
                                            <Code
                                                size={13}
                                                style={{
                                                    display: 'inline',
                                                    marginRight: '4px',
                                                    verticalAlign: 'middle',
                                                }}
                                            />
                                            {expandedJsonIds[trace.traceId]
                                                ? 'Ocultar JSON'
                                                : 'Ver JSON crudo'}
                                        </button>
                                    </div>

                                    <div className="ait-feedback-group">
                                        <span
                                            style={{
                                                fontSize: '0.76rem',
                                                color: '#64748b',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Calificar para RLHF:
                                        </span>
                                        <button
                                            className={`ait-rate-btn ${
                                                trace.reward === 1 ? 'active-pos' : ''
                                            }`}
                                            onClick={() => handleRateTrace(trace.traceId, 1)}
                                            title="Marcar como respuesta correcta (+1)"
                                        >
                                            <ThumbsUp size={14} /> Correcta
                                        </button>
                                        <button
                                            className={`ait-rate-btn ${
                                                trace.reward === -1 ? 'active-neg' : ''
                                            }`}
                                            onClick={() => handleRateTrace(trace.traceId, -1)}
                                            title="Marcar como respuesta a mejorar (-1)"
                                        >
                                            <ThumbsDown size={14} /> Mejorar
                                        </button>
                                    </div>
                                </div>

                                {expandedJsonIds[trace.traceId] && (
                                    <pre className="ait-raw-json">
                                        {JSON.stringify(trace, null, 2)}
                                    </pre>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AiTelemetry;
