import type { Session } from '@/lib/auth';
import { NAV_MODULES, type NavPage } from '@/lib/nav-pages.generated';
import { MODULE_LABEL_BY_SLUG } from '@/lib/nav-module-slugs';

/**
 * Role page permissions (`roles.permissions.pages`) resolved by the API at login / GET /api/iam/me.
 * When the API reports none configured, the roles' built-in pages apply (see builtInPagesForRoles).
 * `null` = unrestricted (SUPER_ADMIN only).
 */
export type AllowedPages = ReadonlySet<string> | null;

const ALL_PAGES: NavPage[] = (() => {
  const seen = new Map<string, NavPage>();
  NAV_MODULES.forEach((m) => m.pages.forEach((p) => { if (!seen.has(p.key)) seen.set(p.key, p); }));
  return Array.from(seen.values());
})();

/** Routes every signed-in user may open regardless of page permissions. */
const ALWAYS_ALLOWED = ['/', '/login', '/auth', '/modules', '/profile'];

function pagesForModuleSlug(moduleRoot: string): NavPage[] {
  const label = MODULE_LABEL_BY_SLUG[moduleRoot];
  if (label) {
    const group = NAV_MODULES.find((m) => m.module === label);
    if (group) return group.pages;
  }
  // Fallback: path-root match (covers General /dashboard and unknown slugs).
  return ALL_PAGES.filter((p) => pathRoot(p.path) === moduleRoot);
}

/** Pages the given role codes can open through the built-in role checks (sidebar + page guards). */
export function builtInPagesForRoles(roleCodes: string[]): string[] {
  const codes = roleCodes.map((r) => String(r || '').toUpperCase());
  const all = codes.includes('SUPER_ADMIN');
  const keys = new Set<string>();
  NAV_MODULES.forEach((m) => m.pages.forEach((p) => {
    if (all || !p.roles || p.roles.some((r) => codes.includes(r))) keys.add(p.key);
  }));
  return Array.from(keys);
}

export function allowedPagesFromSession(session: Session | null): AllowedPages {
  const user = session?.user;
  if (!user) return null;
  const roles = (user.roles || []).map((r: any) => String(typeof r === 'string' ? r : r?.code || '').toUpperCase());
  if (roles.includes('SUPER_ADMIN')) return null;
  if (Array.isArray(user.pages)) return new Set(user.pages);
  return new Set(builtInPagesForRoles(roles));
}

function pathRoot(path: string): string {
  return path.split('/')[1] || '';
}

function matchesPath(pathname: string, pagePath: string): boolean {
  return pathname === pagePath || pathname.startsWith(`${pagePath}/`);
}

/** Nav page owning a URL path (longest matching page path). */
export function navPageForPath(pathname: string): NavPage | null {
  let best: NavPage | null = null;
  for (const p of ALL_PAGES) {
    if (matchesPath(pathname, p.path) && (!best || p.path.length > best.path.length)) best = p;
  }
  return best;
}

export function hasModuleAccess(moduleRoot: string, allowed: AllowedPages): boolean {
  if (!allowed) return true;
  return pagesForModuleSlug(moduleRoot).some((p) => allowed.has(p.key));
}

export function canAccessPath(pathname: string | null | undefined, allowed: AllowedPages): boolean {
  if (!allowed || !pathname) return true;
  const path = pathname.split('?')[0];
  if (ALWAYS_ALLOWED.some((p) => (p === '/' ? path === '/' : matchesPath(path, p)))) return true;
  const page = navPageForPath(path);
  if (page) return allowed.has(page.key);
  // Detail / sub pages without their own nav entry follow their hub module when known,
  // otherwise the URL path root (legacy).
  const root = pathRoot(path);
  const modulePages = pagesForModuleSlug(root);
  if (modulePages.length > 0) return hasModuleAccess(root, allowed);
  const isModuleRoute = ALL_PAGES.some((p) => pathRoot(p.path) === root);
  return isModuleRoute ? hasModuleAccess(root, allowed) : true;
}

/** Best landing page inside a module: its dashboard when allowed, else the first allowed page. */
export function firstAllowedPath(allowed: AllowedPages, moduleRoot?: string): string | null {
  const candidates = (moduleRoot ? pagesForModuleSlug(moduleRoot) : ALL_PAGES).filter(
    (p) => !allowed || allowed.has(p.key)
  );
  const dash = moduleRoot
    ? candidates.find((p) => p.path === `/${moduleRoot}/dashboard`)
    : undefined;
  return (dash ?? candidates[0])?.path ?? null;
}
