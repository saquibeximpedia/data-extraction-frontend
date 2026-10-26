'use client';

import { useApp } from '@/lib/store';
import { UsersList } from '@/components/AdminView';
import { PageHead } from '@/components/PageHead';
import { Empty, Panel } from '@/components/ui';

export default function UsersPage() {
  const { isAdmin } = useApp();
  return (
    <>
      <PageHead title="Users" sub="Accounts that can sign in. Admins can also edit country details." />
      {isAdmin ? (
        <UsersList />
      ) : (
        <Panel>
          <Empty>Only admins can manage users.</Empty>
        </Panel>
      )}
    </>
  );
}
