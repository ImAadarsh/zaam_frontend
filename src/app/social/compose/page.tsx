'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SocialPage } from '@/components/social/social-page';
import { PermissionLock } from '@/components/social/permission-lock';
import { PlatformTag } from '@/components/social/platform-tag';
import { useSession } from '@/hooks/use-session';
import { useRoleCheck } from '@/hooks/use-role-check';
import { getMetaConnectUrl, listSocialAccounts, publishSocialNow } from '@/lib/api';

function isOrganic(a: any) {
  return (
    (a.platform === 'facebook' || a.platform === 'instagram') &&
    a.accountHandle !== 'ads' &&
    a.accountHandle !== '__meta_user__' &&
    !String(a.accountId || '').startsWith('act_') &&
    a.isActive !== false
  );
}

export default function SocialComposePage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const { hasAccess } = useRoleCheck(['ADMIN', 'SUPER_ADMIN', 'SOCIAL_MANAGER']);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [mediaUrlsText, setMediaUrlsText] = useState('');
  const [postType, setPostType] = useState('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const organic = useMemo(() => accounts.filter(isOrganic), [accounts]);

  useEffect(() => {
    if (!hydrated || !hasAccess) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    listSocialAccounts()
      .then((res) => {
        const accs = res.data || [];
        setAccounts(accs);
        const ig = accs.find((a: any) => a.platform === 'instagram' && isOrganic(a));
        const fb = accs.find((a: any) => a.platform === 'facebook' && isOrganic(a));
        setSelected([ig?.id, fb?.id].filter(Boolean).map(String));
      })
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoading(false));
  }, [hydrated, hasAccess, router, session?.accessToken]);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const publish = async () => {
    if (!selected.length) {
      toast.error('Select at least one destination');
      return;
    }
    if (!content.trim()) {
      toast.error('Caption is required');
      return;
    }
    const mediaUrls = mediaUrlsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const igSelected = organic.filter((a) => selected.includes(String(a.id)) && a.platform === 'instagram');
    if (igSelected.length && mediaUrls.length === 0) {
      toast.error('Instagram requires a public image/video URL');
      return;
    }
    setSubmitting(true);
    setResults(null);
    try {
      const { data } = await publishSocialNow({
        accountIds: selected,
        content,
        postType,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        linkUrl: linkUrl || undefined,
        hashtags: hashtags || undefined
      });
      setResults(data || []);
      const ok = (data || []).filter((r: any) => r.ok);
      const fail = (data || []).filter((r: any) => !r.ok);
      if (ok.length) toast.success(`Published to ${ok.length} destination(s)`);
      if (fail.length) toast.error(`${fail.length} destination(s) failed — see Graph errors below`);
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SocialPage
      title="Social · Composer"
      crumbs={[{ label: 'Social', href: '/social/dashboard' }, { label: 'Composer' }]}
      backHref="/social/posts"
      loading={!hydrated || loading}
      denied={!hasAccess}
    >
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Composer</h1>
          <p className="text-sm text-muted-foreground">
            Publish now to connected Pages and Instagram. Graph errors are shown as-is — a failed post is never marked published.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h3 className="font-medium">Destinations</h3>
          {organic.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Page/IG accounts. Connect Meta first.</p>
          ) : (
            <div className="grid gap-2">
              {organic.map((a) => (
                <label key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <input type="checkbox" checked={selected.includes(String(a.id))} onChange={() => toggle(String(a.id))} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{a.accountName}</span>
                      <PlatformTag platform={a.platform} extra={a.accountHandle} />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 text-muted-foreground">Type</span>
              <select value={postType} onChange={(e) => setPostType(e.target.value)} className="h-10 w-full rounded-md border px-3 bg-background">
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="carousel">Carousel</option>
                <option value="reel">Reel / Short</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 text-muted-foreground">Link (Facebook)</span>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-10 w-full rounded-md border px-3 bg-background" />
            </label>
          </div>
          <label className="text-sm block">
            <span className="block mb-1 text-muted-foreground">Caption</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-32 w-full rounded-md border p-3 bg-background" />
          </label>
          <label className="text-sm block">
            <span className="block mb-1 text-muted-foreground">Public media URLs (required for Instagram)</span>
            <textarea value={mediaUrlsText} onChange={(e) => setMediaUrlsText(e.target.value)} className="min-h-20 w-full rounded-md border p-3 bg-background text-sm" placeholder="https://…jpg" />
          </label>
          <label className="text-sm block">
            <span className="block mb-1 text-muted-foreground">Hashtags</span>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="h-10 w-full rounded-md border px-3 bg-background" />
          </label>
          <button
            onClick={publish}
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {submitting ? 'Publishing…' : 'Publish now'}
          </button>
        </div>

        {results && (
          <div className="space-y-3">
            {results.map((r) =>
              r.ok ? (
                <div key={r.accountId} className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                  Published to {r.accountName} ({r.platform}) — id {r.post?.platformPostId || r.post?.id}
                  {r.post?.platformPostUrl && (
                    <a className="block text-primary mt-1" href={r.post.platformPostUrl} target="_blank" rel="noreferrer">
                      Open on Meta
                    </a>
                  )}
                </div>
              ) : (
                <PermissionLock
                  key={r.accountId}
                  title={`Not published · ${r.accountName || r.accountId}`}
                  message={r.error || 'Graph denied this publish.'}
                  missingPermission={r.missingPermission}
                  product={r.missingPermission === 'instagram_content_publish' ? 'Instagram API' : 'Pages API'}
                  onReconnect={async () => {
                    const { data } = await getMetaConnectUrl();
                    if (data?.authUrl) window.location.href = data.authUrl;
                  }}
                />
              )
            )}
          </div>
        )}
      </div>
    </SocialPage>
  );
}
