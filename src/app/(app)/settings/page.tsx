'use client';

import { PageHead } from '@/components/PageHead';
import { SettingsView } from '@/components/SettingsView';

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Settings" sub="Where this browser finds the extraction service." />
      <SettingsView />
    </>
  );
}
