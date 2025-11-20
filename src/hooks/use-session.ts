'use client';

import { useEffect, useState } from 'react';
import { getSession, type Session } from '@/lib/auth';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(getSession());
    setHydrated(true);
  }, []);

  return { session, hydrated };
}


