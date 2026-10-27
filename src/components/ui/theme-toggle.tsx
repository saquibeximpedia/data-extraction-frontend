'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons';

type Theme = 'light' | 'dark';
const KEY = 'tx_theme';

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Uses the saved choice, otherwise the OS preference.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

/** The current theme and a toggle that switches light / dark and remembers the choice */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  }, []);

  return { theme, toggle };
}

/** Icon button that switches light / dark (pages without the account menu: sign-in, share links) */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}
