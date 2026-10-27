'use client';

import { useApp } from '@/lib/store';
import { UsersList } from '@/components/AdminView';
import { Empty, Panel } from '@/components/ui';

export default function UsersPage() {
  const { isAdmin } = useApp();
  return isAdmin ? (
    <UsersList />
  ) : (
    <Panel>
      <Empty>Only admins can manage users.</Empty>
    </Panel>
  );
}
