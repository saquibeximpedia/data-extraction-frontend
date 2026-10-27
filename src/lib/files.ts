// Stored files, shared by the browser and the server

/** Uploaded files are stored as "{CC}_{YYYY-MM}__{original name}"; people see the original name */
export const displayName = (fileName: string) => (fileName.includes('__') ? fileName.split('__').slice(1).join('__') : fileName);

/** What can be uploaded, by extension */
export const UPLOAD_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  zip: 'application/zip',
};

export const UPLOAD_ACCEPT = Object.keys(UPLOAD_TYPES).map((ext) => `.${ext}`).join(',');
export const isUploadable = (name: string) => Boolean(UPLOAD_TYPES[name.split('.').pop()?.toLowerCase() ?? '']);
