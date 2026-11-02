import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './use-session';
import { toast } from 'sonner';
import { allowedPagesFromSession, canAccessPath } from '@/lib/page-access';

/**
 * Hook to check if user may open the current page.
 * Allows SUPER_ADMIN, any of `requiredRoles`, or an explicit IAM page grant for this path
 * (so custom roles like B2B_M are not blocked after Module Hub already showed the card).
 * Redirects to /modules when denied; to /login when hydration is done and there is no session.
 */
export function useRoleCheck(requiredRoles: string[], redirectTo = '/modules') {
  const { session, hydrated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [hasAccess, setHasAccess] = useState(false);

  // Stabilize array identity so the effect doesn't re-fire every render
  const rolesKey = useMemo(
    () => requiredRoles.map((r) => r.toUpperCase()).sort().join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requiredRoles.join('|')]
  );

  useEffect(() => {
    if (!hydrated) return;

    if (!session?.accessToken) {
      router.replace('/login');
      setHasAccess(false);
      return;
    }

    const userRoles = session.user?.roles || [];
    const roleCodes = userRoles
      .map((r: any) => (typeof r === 'string' ? r : r?.code || r?.name || ''))
      .map((r: string) => r.toUpperCase());

    const needed = rolesKey ? rolesKey.split('|') : [];
    const hasRequiredRole =
      roleCodes.includes('SUPER_ADMIN') || needed.some((role) => roleCodes.includes(role));
    const allowedPages = allowedPagesFromSession(session);
    const hasPageGrant = canAccessPath(pathname, allowedPages);

    if (!hasRequiredRole && !hasPageGrant) {
      toast.error('You do not have permission to access this page. Please contact an administrator.');
      setHasAccess(false);
      router.replace(redirectTo);
      return;
    }

    setHasAccess(true);
  }, [hydrated, session, rolesKey, router, redirectTo, pathname]);

  return { hasAccess, hydrated };
}
