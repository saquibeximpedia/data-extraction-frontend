'use client';

import { AdminView } from '@/components/AdminView';

export default function AdminPage() {
  return (
    <>
      <div className="page-head reveal">
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Manage accounts and the country details users see.</p>
      </div>
      <AdminView />
    </>
  );
}
