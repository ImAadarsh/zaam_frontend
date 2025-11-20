import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './use-session';
import { toast } from 'sonner';

/**
 * Hook to check if user has required roles
 * Redirects to /modules if user doesn't have required roles
 */
export function useRoleCheck(requiredRoles: string[], redirectTo = '/modules') {
  const { session, hydrated } = useSession();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }

    const userRoles = session.user?.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      toast.error('You do not have permission to access this page. Please contact an administrator.');
      router.replace(redirectTo);
      return;
    }

    setHasAccess(true);
  }, [hydrated, session, requiredRoles, router, redirectTo]);

  return { hasAccess, hydrated };
}

