export type Session = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName?: string; lastName?: string; organizationId: string; roles: string[] };
};

const KEY = 'zaam_session';

export function setSession(accessToken: string, refreshToken: string, user: Session['user']) {
  const s: Session = { accessToken, refreshToken, user };
  if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s));
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function clearSession() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}


