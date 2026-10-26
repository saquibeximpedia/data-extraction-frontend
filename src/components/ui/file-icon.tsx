import { Icon } from './icons';

/** A file's type as a small tile: CSV, spreadsheet or zip */
export function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const kind = ext === 'zip' ? 'zip' : ext === 'csv' ? 'csv' : 'xls';
  return (
    <span className={`file-icon ext-${kind}`} aria-hidden="true">
      {kind === 'zip' ? <Icon.Archive size={17} /> : kind === 'csv' ? <Icon.Csv size={17} /> : <Icon.Sheet size={17} />}
    </span>
  );
}
