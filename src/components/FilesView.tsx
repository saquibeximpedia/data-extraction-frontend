'use client';

import { useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/store';
import { fmtDate, fmtMonth, fmtRelative, fmtSize, fmtTime } from '@/lib/format';
import { useChangedKeys } from '@/lib/hooks';
import { Badge, Button, ButtonLink, CodeAvatar, ConfirmModal, Icon, Menu, Skeleton, useToast, type MenuItem } from './ui';

/**
 * Parses files like:
 * "THA/2026/THA_2026-08.csv"
 * "THA/THA_2026-08.csv"
 * "THA/2026/THA_2026-08_overwritten_2026-10-19_120400.csv"
 */
function parseName(relativePath: string) {
  const m = relativePath.match(/([A-Z]{2,3})(?:.*?)_(\d{4}-\d{2})(?:_overwritten_([0-9\-_]+))?\.(csv|xlsx)$/i);
  if (m) {
    const rawStamp = m[3];
    let formattedStamp: string | null = null;
    if (rawStamp) {
      const parts = rawStamp.split('_');
      formattedStamp = parts[0];
    }
    return {
      code: m[1].toUpperCase(),
      period: m[2],
      isOverwritten: !!rawStamp,
      overwrittenAt: formattedStamp,
    };
  }
  return null;
}

export function FilesView() {
  const { files: data, runs, refreshing, refreshFiles, refreshActivity } = useApp();
  const toast = useToast();
  const files = data ?? [];
  const loading = data === null;
  const changed = useChangedKeys(files.map((f) => ({ key: f.relativePath, signature: f.modifiedAt })));

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'OVERWRITTEN'>('ALL');
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stoppingActive, setStoppingActive] = useState(false);

  const activeRun = runs?.find((r) => r.status === 'RUNNING') ?? null;

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const info = parseName(f.relativePath);
      if (filterStatus === 'ACTIVE' && info?.isOverwritten) {
        return false;
      }
      if (filterStatus === 'OVERWRITTEN' && !info?.isOverwritten) {
        return false;
      }
      return true;
    });
  }, [files, filterStatus]);

  async function handleConfirmDelete() {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteFile(fileToDelete);
      toast('ok', 'File deleted', fileToDelete);
      setFileToDelete(null);
      refreshFiles();
    } catch (err) {
      toast('err', 'Could not delete file', err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleStopActiveRun() {
    if (!activeRun) return;
    setStoppingActive(true);
    try {
      await api.stopRun(activeRun.id);
      toast('ok', 'Extraction stopped', 'Process was safely aborted without affecting the server.');
      refreshActivity();
    } catch (err: any) {
      toast('err', 'Could not stop extraction', err.message);
    } finally {
      setStoppingActive(false);
    }
  }

  return (
    <>
      <section className="panel glass panel-flush reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="panel-head padded" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="panel-desc">
              {loading ? 'Loading…' : `${filteredFiles.length} file${filteredFiles.length === 1 ? '' : 's'}`}
            </p>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                className={`chip-btn ${filterStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ALL')}
              >
                All files
              </button>
              <button
                type="button"
                className={`chip-btn ${filterStatus === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ACTIVE')}
              >
                Active only
              </button>
              <button
                type="button"
                className={`chip-btn ${filterStatus === 'OVERWRITTEN' ? 'active' : ''}`}
                onClick={() => setFilterStatus('OVERWRITTEN')}
              >
                Overwritten only
              </button>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<Icon.Refresh size={14} />} loading={refreshing.files} onClick={refreshFiles}>
            Refresh
          </Button>
        </div>

        {/* Active download / extraction notice */}
        {activeRun && (
          <div className="active-download-banner">
            <div className="active-download-left">
              <Badge tone="blue" live>
                Active download
              </Badge>
              <div className="active-download-text">
                <span className="cell-strong">
                  {activeRun.params?.plans?.map((p: any) => `${p.countryCode} [${p.periods?.join(', ')}]`).join(', ') || 'Running extraction'}
                </span>
                <span className="cell-sub" style={{ marginLeft: 8 }}>
                  Started {fmtTime(activeRun.startedAt)}
                </span>
              </div>
            </div>
            <div className="active-download-right">
              <ButtonLink size="sm" variant="secondary" icon={<Icon.ChevronRight size={13} />} href="/runs">
                View in runs
              </ButtonLink>
              <Button
                size="sm"
                variant="ghost"
                icon={<Icon.Stop size={13} />}
                loading={stoppingActive}
                onClick={handleStopActiveRun}
                style={{ color: 'var(--red)', borderColor: 'var(--red-line)' }}
              >
                Stop
              </Button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>File & Month</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 100 }}>Size</th>
                <th style={{ width: 120 }}>Updated</th>
                <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>
                    <Skeleton height={28} />
                  </td>
                </tr>
              )}
              {!loading && filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No files found. Run an extraction to create some.
                  </td>
                </tr>
              )}
              {filteredFiles.map((f) => {
                const info = parseName(f.relativePath);

                const actions: MenuItem[] = [
                  {
                    label: 'Download file',
                    icon: <Icon.Download size={14} />,
                    href: api.downloadUrl(f.relativePath),
                  },
                  {
                    label: 'View in runs',
                    icon: <Icon.File size={14} />,
                    href: '/runs',
                  },
                  {
                    label: 'Delete file',
                    icon: <Icon.Trash size={14} />,
                    separator: true,
                    onSelect: () => setFileToDelete(f.relativePath),
                  },
                ];

                return (
                  <tr key={f.relativePath} className={changed.has(f.relativePath) ? 'flash' : ''}>
                    <td>
                      <div className="file-cell">
                        {info && <CodeAvatar code={info.code} />}
                        <span>
                          <div className="cell-strong">{info ? `${info.code} · ${fmtMonth(info.period)}` : f.fileName}</div>
                          <div className="cell-sub mono">{f.relativePath}</div>
                        </span>
                      </div>
                    </td>
                    <td>
                      {info?.isOverwritten ? (
                        <Badge tone="amber">
                          Overwritten {info.overwrittenAt ? `· ${info.overwrittenAt}` : ''}
                        </Badge>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </td>
                    <td className="cell-sub-color">{fmtSize(f.sizeBytes)}</td>
                    <td className="cell-sub-color" title={fmtDate(f.modifiedAt)}>
                      {fmtRelative(f.modifiedAt)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                        <ButtonLink size="sm" icon={<Icon.Download size={14} />} href={api.downloadUrl(f.relativePath)}>
                          Download
                        </ButtonLink>
                        <Menu items={actions} label="File options" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Popup UI Component for Safe Deletion */}
      <ConfirmModal
        open={Boolean(fileToDelete)}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete File"
        description={
          <>
            Are you sure you want to delete <b className="mono">{fileToDelete}</b>? This file will be permanently removed from disk.
          </>
        }
        confirmLabel="Delete File"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </>
  );
}
