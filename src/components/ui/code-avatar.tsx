/** Country code as a small square avatar */
export function CodeAvatar({ code, muted }: { code: string; muted?: boolean }) {
  return <span className={`code-avatar ${muted ? 'muted' : ''}`}>{code.slice(0, 2)}</span>;
}
