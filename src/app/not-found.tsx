import Link from 'next/link';
import { CardShell } from '@/components/card-shell';

/** Any address the app doesn't have */
export default function NotFound() {
  return (
    <CardShell>
      <div className="signin-card not-found">
        <span className="not-found-code">404</span>
        <div>
          <h1 className="signin-title">Page not found</h1>
          <p className="signin-sub">This address doesn&apos;t lead anywhere in the app.</p>
        </div>
        <Link href="/" className="btn btn-primary btn-md">
          Go to the dashboard
        </Link>
      </div>
    </CardShell>
  );
}
