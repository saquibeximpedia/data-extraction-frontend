'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import type { TradeFlow } from '@/lib/types';
import { fmtMonth, HS_RULES } from '@/lib/format';
import { Button, CodeAvatar, Field, Icon, MonthRangePicker, Segmented, Select, useToast } from './ui';

type Flow = 'ALL' | TradeFlow;
type Mode = 'test' | 'complete';

/** Same splitting rule as the API: commas, semicolons, spaces or new lines */
const splitCodes = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))];

export function ExtractPanel() {
  const { countries, selected, setSelected, files, health, refreshActivity } = useApp();
  const country = countries?.find((c) => c.code === selected);
  const toast = useToast();
  const isProd = Boolean(health?.isProd);

  const [hsText, setHsText] = useState('');
  const [showCustomHs, setShowCustomHs] = useState(false);
  const [mode, setMode] = useState<Mode>('test');
  const effectiveMode: Mode = isProd ? 'complete' : mode;
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [flow, setFlow] = useState<Flow>('ALL');
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState('');
  const hsRef = useRef<HTMLTextAreaElement>(null);

  // Picking a country resets the months to its latest published one
  useEffect(() => {
    if (!country) return;
    const latest = country.autoSyncPeriods[country.autoSyncPeriods.length - 1];
    if (latest) {
      setStart(latest);
      setEnd(latest);
    }
    setFlow((current) => (current === 'ALL' || country.supportedTradeTypes.includes(current) ? current : 'ALL'));
    setRunError('');
  }, [country?.code]);

  // Grow the HS code box with pasted lists, up to a few lines
  useEffect(() => {
    const el = hsRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [hsText, showCustomHs]);

  const codes = splitCodes(hsText);
  const periods = country?.autoSyncPeriods ?? [];

  // Determine which months already have an export file from the files list
  const extractedMonths = useMemo(() => {
    if (!country || !files) return [];
    const set = new Set<string>();
    for (const f of files) {
      const m = f.relativePath.match(/([A-Z]{2,3})_(\d{4}-\d{2})/);
      if (m && m[1] === country.code) {
        set.add(m[2]);
      }
    }
    return Array.from(set);
  }, [country?.code, files]);

  const hasOverlap = start && end && extractedMonths.some((p) => p >= start && p <= end);

  const activeSavedCount = effectiveMode === 'test'
    ? (country?.testHsCodeCount ?? country?.hsCodeCount ?? 0)
    : (country?.hsCodeCount ?? 0);

  async function run() {
    if (!country) return;
    setBusy(true);
    setRunError('');
    try {
      await api.extract({
        countryCode: country.code,
        startDate: start,
        endDate: end,
        hsCodes: showCustomHs && hsText.trim() ? hsText.trim() : undefined,
        tradeType: flow,
        mode: effectiveMode,
      });
      const what = showCustomHs && codes.length
        ? `${codes.length} custom HS code${codes.length === 1 ? '' : 's'}`
        : `${effectiveMode === 'test' ? 'test' : 'all'} ${activeSavedCount.toLocaleString()} saved codes`;
      const when = start === end ? fmtMonth(start) : `${fmtMonth(start)} – ${fmtMonth(end)}`;
      toast('ok', 'Extraction started', `${country.name} · ${what} · ${when}`);
      refreshActivity();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : 'Could not reach the API server.');
    } finally {
      setBusy(false);
    }
  }

  const supports = (f: TradeFlow) => !!country?.supportedTradeTypes.includes(f);

  return (
    <section className="panel glass reveal" style={{ '--i': 3 } as React.CSSProperties}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">New extraction</h2>
          <p className="panel-desc">Fetch data for a country and month range now.</p>
        </div>
      </div>

      <div className="extract-grid">
        <Field label="Country" htmlFor="country">
          <Select
            id="country"
            value={country?.code}
            onChange={setSelected}
            options={(countries ?? []).map((c) => ({
              value: c.code,
              label: c.name,
              meta: c.code,
              hint: c.enabled
                ? `${c.lagMonths}m lag · ${c.supportedTradeTypes.map((t) => t.toLowerCase()).join(' & ')} · ${c.hsCodeCount.toLocaleString()} saved (${c.testHsCodeCount ?? 0} test)`
                : `Needs ${c.missingConfig.join(', ')} on the server`,
              disabled: !c.enabled,
              prefix: <CodeAvatar code={c.code} muted={!c.enabled} />,
            }))}
          />
        </Field>

        <Field label="Months" htmlFor="months">
          <MonthRangePicker
            id="months"
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
            marked={extractedMonths}
            markedLabel="Already extracted"
            presets={
              periods.length
                ? [
                    { label: 'Latest published', start: periods[periods.length - 1], end: periods[periods.length - 1] },
                    { label: `Last ${periods.length} months`, start: periods[0], end: periods[periods.length - 1] },
                  ]
                : []
            }
          />
        </Field>

        <Field label="Trade flow">
          <Segmented<Flow>
            label="Trade flow"
            value={flow}
            onChange={setFlow}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'IMPORT', label: 'Import', disabled: !supports('IMPORT') },
              { value: 'EXPORT', label: 'Export', disabled: !supports('EXPORT') },
            ]}
          />
        </Field>

        <Field label="Dataset mode" aside={isProd ? <span className="field-aside">Production (Complete only)</span> : undefined}>
          <Segmented<Mode>
            label="Dataset mode"
            value={effectiveMode}
            onChange={(m) => !isProd && setMode(m)}
            options={[
              {
                value: 'test',
                label: country?.testHsCodeCount ? `Test (${country.testHsCodeCount})` : 'Test (20)',
                disabled: isProd,
              },
              {
                value: 'complete',
                label: country?.hsCodeCount ? `Complete (${country.hsCodeCount.toLocaleString()})` : 'Complete',
              },
            ]}
          />
        </Field>

        {!showCustomHs ? (
          <div className="extract-hs-bar">
            <div className="hs-bar-info">
              <span className={`hs-mode-pill hs-mode-${effectiveMode}`}>
                {effectiveMode === 'test' ? '🧪 Test set' : '📦 Complete set'}
              </span>
              <span className="hs-bar-text">
                Using <b>{activeSavedCount.toLocaleString()}</b> {effectiveMode} HS codes from server (descriptions ignored)
              </span>
            </div>
            <button
              type="button"
              className="chip-btn hs-custom-btn"
              onClick={() => setShowCustomHs(true)}
            >
              + Custom HS codes
            </button>
          </div>
        ) : (
          <div className="extract-hs">
            <Field
              label="Custom HS codes"
              htmlFor="hs"
              aside={
                <div className="field-aside-group">
                  {codes.length > 0 && (
                    <span className="field-aside">{codes.length} code{codes.length === 1 ? '' : 's'}</span>
                  )}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setHsText('');
                      setShowCustomHs(false);
                    }}
                  >
                    Hide & use {mode} codes ({activeSavedCount.toLocaleString()})
                  </button>
                </div>
              }
            >
              <textarea
                id="hs"
                ref={hsRef}
                rows={2}
                className="control textarea mono"
                placeholder={country ? `Paste codes (e.g. 01012900). Descriptions, formulas, and headers are ignored.` : 'Select a country first'}
                value={hsText}
                onChange={(e) => setHsText(e.target.value)}
                spellCheck={false}
              />
            </Field>
            <p className="field-help">One code, or paste several separated by commas or new lines. Descriptions are ignored. {country ? HS_RULES[country.code] : ''}</p>
          </div>
        )}
      </div>

      {runError && (
        <div className="note note-error" role="alert">
          <Icon.Alert /> <span>{runError}</span>
        </div>
      )}

      {!runError && hasOverlap && (
        <div className="note note-warn">
          <Icon.Alert />
          <span>
            Selected month(s) already have exports. Re-running will safely archive existing files with an overwrite timestamp before saving new data.
          </span>
        </div>
      )}

      <div className="panel-foot">
        <span className="foot-summary">
          {country && start && end
            ? `${country.name} · ${start === end ? fmtMonth(start) : `${fmtMonth(start)} – ${fmtMonth(end)}`} · ${showCustomHs && codes.length ? `${codes.length} custom codes` : `${effectiveMode} codes`}`
            : ' '}
        </span>
        <Button variant="primary" icon={<Icon.Play />} loading={busy} disabled={!country || !start || !end} onClick={run}>
          Run extraction
        </Button>
      </div>
    </section>
  );
}

