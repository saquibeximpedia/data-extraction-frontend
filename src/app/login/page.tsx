import { redirect } from 'next/navigation';
import { CardShell } from '@/components/card-shell';
import { Icon } from '@/components/ui';
import { LoginForm } from '@/modules/auth/components/LoginForm';
import { currentUser } from '@/modules/auth/session';
import { setupProblems } from '@/modules/auth/setup';

/** Sign-in. A deployment whose Supabase settings are wrong would reject every sign-in, so it says why up front. */
export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  const problems = await setupProblems();

  return (
    <CardShell>
      <LoginForm disabled={problems.length > 0} />
      {problems.length > 0 && (
        <div className="note note-error setup-problems" role="alert">
          <Icon.Alert />
          <span>
            <b>This deployment can&apos;t sign anyone in yet.</b> Fix these settings on the server, then redeploy:
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </span>
        </div>
      )}
    </CardShell>
  );
}
