import { AppHeader } from '@/components/app-header';
import { requireUser } from '@/modules/auth/session';
import { AppProvider } from '@/modules/service/store';

/** Every signed-in page: sends anyone without a session to /login, and shares the header and the extraction service's state */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  return (
    <AppProvider me={me}>
      <AppHeader />
      <main className="page">{children}</main>
    </AppProvider>
  );
}
