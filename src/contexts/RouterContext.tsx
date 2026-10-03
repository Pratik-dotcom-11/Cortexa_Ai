import React, { createContext, useContext, useState, useEffect } from 'react';

interface RouterContextType {
  path: string;
  navigate: (to: string) => void;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  // Use hash-based routing to ensure compatibility in preview iframes without 404s
  const getInitialPath = (): string => {
    const hash = window.location.hash.replace(/^#/, '');
    return hash || '/';
  };

  const [pathWithQuery, setPathWithQuery] = useState<string>(getInitialPath);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setPathWithQuery(hash || '/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (to: string) => {
    const targetHash = to.startsWith('#') ? to : `#${to}`;
    window.location.hash = targetHash;
    setPathWithQuery(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [cleanPath, queryString] = pathWithQuery.split('?');
  const searchParams = new URLSearchParams(queryString || '');

  // Extract common route params
  const params: Record<string, string> = {};
  const segments = cleanPath.split('/').filter(Boolean);
  
  // Pattern matching: /subjects/:id
  if (segments[0] === 'subjects' && segments[1]) {
    params.id = segments[1];
  }
  // Pattern matching: /materials/:id
  if (segments[0] === 'materials' && segments[1]) {
    params.id = segments[1];
  }
  // Pattern matching: /quiz/:id
  if (segments[0] === 'quiz' && segments[1]) {
    params.id = segments[1];
  }

  return (
    <RouterContext.Provider
      value={{
        path: cleanPath || '/',
        navigate,
        params,
        searchParams,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

export function Link({
  to,
  children,
  className,
  activeClassName,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  onClick?: () => void;
}) {
  const { path, navigate } = useRouter();
  const isActive = path === to || (to !== '/' && path.startsWith(to));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick();
    navigate(to);
  };

  return (
    <a
      href={`#${to}`}
      onClick={handleClick}
      className={`${className || ''} ${isActive && activeClassName ? activeClassName : ''}`}
    >
      {children}
    </a>
  );
}
