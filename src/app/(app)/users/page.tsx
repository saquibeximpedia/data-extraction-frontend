import { requireAdmin } from '@/modules/auth/session';
import { UsersTable } from '@/modules/users/components/UsersTable';
import { listUsers } from '@/modules/users/queries';

/** Every account (admins only) */
export default async function UsersPage() {
  const me = await requireAdmin();
  return <UsersTable users={await listUsers()} meId={me.id} />;
}
