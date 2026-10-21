import { forwardRef } from 'react';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Square button holding only an icon; still needs an aria-label */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconOnly, className = '', children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`btn btn-${variant} btn-${size} ${iconOnly ? 'btn-icon' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Same look as Button, for links (e.g. downloads) */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; icon?: React.ReactNode }) {
  return (
    <a className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children}
    </a>
  );
}
