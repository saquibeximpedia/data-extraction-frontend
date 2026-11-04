'use client';

import { useCallback, useEffect, useState } from 'react';
import { extractor } from '@/modules/service/client';
import { describe } from './files';
import { errorText } from './result';
import type { ExportFile } from './types';

/**
 * Files kept on the extraction service because Storage couldn't take them (over one upload, or
 * the upload failed), listed from this browser (the service may only be reachable from here) and
 * described like stored files. `error` says why they couldn't be listed, e.g. the service is off.
 */
export function useServerFiles() {
  const [files, setFiles] = useState<ExportFile[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const list = await extractor.serverFiles();
      setFiles(
        list.map((f) => ({
          fileName: f.path.split('/').pop() ?? f.path,
          relativePath: f.path,
          sizeBytes: f.size,
          modifiedAt: f.modifiedAt,
          ...describe(f.path),
          uploadedBy: null,
          location: 'server',
        }))
      );
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, error, refresh };
}
