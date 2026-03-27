'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';

const ACTIVE_THEME = 'pulse';
const COOKIE_NAME = 'active_theme';

function setThemeCookie(theme: string) {
  if (typeof window === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
}

type ThemeContextType = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme
}: {
  children: ReactNode;
  initialTheme?: string;
}) {
  // Always use Pulse theme regardless of cookie or initialTheme
  const [activeTheme, setActiveTheme] = useState<string>(ACTIVE_THEME);

  useEffect(() => {
    // Force Pulse theme and clear any stale theme cookies
    setThemeCookie(ACTIVE_THEME);
    document.documentElement.setAttribute('data-theme', ACTIVE_THEME);

    // Remove any leftover theme classes from body
    Array.from(document.body.classList)
      .filter((className) => className.startsWith('theme-'))
      .forEach((className) => {
        document.body.classList.remove(className);
      });
  }, []);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      'useThemeConfig must be used within an ActiveThemeProvider'
    );
  }
  return context;
}
