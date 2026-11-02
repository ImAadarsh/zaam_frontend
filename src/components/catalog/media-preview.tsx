'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export const LEGACY_STORAGE_MESSAGE = 'File unavailable (legacy storage)';

/** Objects in the old S3 bucket are permanently inaccessible (AllAccessDisabled). */
export function isLegacyStorageUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith('amazonaws.com');
  } catch {
    return false;
  }
}

/**
 * When panels run on localhost, rewrite absolute /uploads URLs that were stamped with a
 * remote PUBLIC_API_URL (e.g. erp-api.zaamaitech.co.uk) so local disk files still preview.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (typeof window === 'undefined') return url;
  const localBrowser = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (!localBrowser) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith('/uploads/')) return url;
    const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');
    return `${apiBase}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function MediaThumb({
  url,
  alt,
  className = 'h-12 w-12'
}: {
  url?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const legacy = isLegacyStorageUrl(url);
  const src = resolveMediaUrl(url);

  if (!src || failed || legacy) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded border bg-muted/40 text-muted-foreground`}
        title={legacy ? LEGACY_STORAGE_MESSAGE : 'Preview unavailable'}
      >
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ''}
      className={`${className} rounded border object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

export function MediaLink({
  url,
  children,
  className
}: {
  url?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const href = resolveMediaUrl(url);
  if (!href) return <span className="text-xs text-muted-foreground">No file</span>;
  if (isLegacyStorageUrl(url)) {
    return (
      <span className="text-xs text-amber-700" title="Re-upload this file to restore it">
        {LEGACY_STORAGE_MESSAGE}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
