'use client';

import { useEffect, useState } from 'react';
import { CountryUpload, DROPZONE_HINT } from '@/components/country-upload';
import { Button, Field, Icon, Modal, Select } from '@/components/ui';
import type { Country } from '@/lib/types';

/** The month and file fields before a country is chosen: the same layout, disabled, so nothing moves once one is */
function UploadPlaceholder() {
  return (
    <fieldset className="upload-fields" disabled>
      <div className="upload-grid">
        <div className="field">
          <span className="field-label">Month</span>
          <button type="button" className="control select-trigger" disabled>
            <Icon.Calendar size={15} />
            <span className="select-value placeholder">Choose a country first</span>
          </button>
        </div>
        <div className="field">
          <span className="field-label">Files</span>
          <div className="dropzone is-disabled">
            <Icon.Upload size={18} />
            {DROPZONE_HINT}
          </div>
        </div>
      </div>
      <div className="panel-foot">
        <label className="toggle">
          <input type="checkbox" className="check" disabled /> Mark the month completed
        </label>
        <Button variant="primary" icon={<Icon.Upload size={14} />} disabled>
          Upload file
        </Button>
      </div>
    </fieldset>
  );
}

/** Upload popup: pick the country, then its month and files; closes once they are in */
export function UploadModal({ open, onClose, countries, initialCode }: { open: boolean; onClose: () => void; countries: Country[]; initialCode?: string }) {
  const [code, setCode] = useState('');
  useEffect(() => {
    if (open) setCode(initialCode?.toUpperCase() ?? '');
  }, [open, initialCode]);

  const picked = countries.find((c) => c.code === code);
  return (
    <Modal open={open} onClose={onClose} title="Upload files" icon={<Icon.Upload size={17} />} wide>
      <div className="upload-form">
        <Field label="Country" htmlFor="up-country">
          <Select
            id="up-country"
            value={picked?.code}
            placeholder="Choose a country"
            options={countries.map((c) => ({ value: c.code, label: c.name, meta: c.kind === 'manual' ? `${c.code} · download-only` : c.code }))}
            onChange={setCode}
          />
        </Field>
        {picked ? <CountryUpload key={picked.code} country={picked} showSource={false} onUploaded={onClose} /> : <UploadPlaceholder />}
      </div>
    </Modal>
  );
}
