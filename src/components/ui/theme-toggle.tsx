'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

type Theme = 'light' | 'dark';
const KEY = 'tx_theme';

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Uses the saved choice, otherwise the OS preference.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

/** Round glass button that switches light / dark and remembers the choice */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button type="button" className="glass-btn glass glass-btn-icon" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}
