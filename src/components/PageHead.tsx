import Link from 'next/link';
import { Icon } from './ui';

/** Page title with an optional back link, subtitle and actions on the right */
export function PageHead({
  title,
  sub,
  back,
  actions,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head reveal">
      {back && (
        <Link href={back.href} className="link back-link">
          <Icon.ChevronLeft size={14} /> {back.label}
        </Link>
      )}
      <div className="page-head-row">
        <div>
          <h1 className="page-title">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  );
}
