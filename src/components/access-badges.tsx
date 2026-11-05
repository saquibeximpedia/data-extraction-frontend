import type { CountryAccess } from '@/lib/types';
import { Badge } from './ui';

const API_TITLE = "Extracted by the extraction service through the source's API and saved to the database";
const DIRECT_TITLE = 'Files download straight from the source to your device; nothing is saved on the server';
const UPLOAD_TITLE = 'No API or download link: files are uploaded by hand';

/** The same as one short label, for tight places such as a dropdown: "API", "Direct", "API · Direct" or "Upload" */
export function accessLabel(access: CountryAccess): { text: string; title: string } {
  if (access.api && access.direct) return { text: 'API · Direct', title: `${API_TITLE}. Its files can also be downloaded directly.` };
  if (access.api) return { text: 'API', title: API_TITLE };
  if (access.direct) return { text: 'Direct', title: DIRECT_TITLE };
  return { text: 'Upload', title: UPLOAD_TITLE };
}

/** Whether a country is extracted through an API, downloaded straight from the source, or both; uploaded by hand when neither */
export function AccessBadges({ access }: { access: CountryAccess }) {
  return (
    <span className="access-badges">
      {access.api && (
        <Badge tone="blue" title={API_TITLE}>
          API
        </Badge>
      )}
      {access.direct && (
        <Badge tone="green" title={DIRECT_TITLE}>
          Direct download
        </Badge>
      )}
      {!access.api && !access.direct && <Badge title={UPLOAD_TITLE}>Upload</Badge>}
    </span>
  );
}
