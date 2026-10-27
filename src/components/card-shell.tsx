import { ThemeToggle } from './ui';

/** A single centred card outside the signed-in pages (sign-in, share links, not found), with the theme toggle in the corner */
export function CardShell({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="signin">
      <div className="signin-corner">
        <ThemeToggle />
      </div>
      <main className={`signin-body ${className}`}>{children}</main>
    </div>
  );
}
