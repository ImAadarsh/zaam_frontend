'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { login } from '@/lib/api';
import { setSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ email, password });
      setSession(res.accessToken, res.refreshToken, res.user);
      router.replace('/modules');
    } catch (e: any) {
      const message =
        e?.response?.data?.error?.message ??
        e?.response?.data?.message ??
        e?.message ??
        'Login failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left hero pane */}
      <div className="hidden lg:flex relative items-center justify-center overflow-hidden">
        {/* Dark gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zaam-black via-zaam-charcoal to-black" />
        {/* Gold radial glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full opacity-30"
             style={{ background: 'radial-gradient(closest-side, #D4A017, transparent)' }} />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-[520px] w-[520px] rounded-full opacity-20"
             style={{ background: 'radial-gradient(closest-side, #D4A017, transparent)' }} />
        {/* Brand mark with blend to hide white bg of JPEG */}
        <div className="relative z-10 text-center px-10">
          <div className="mx-auto mb-6">
            <Image
              src="/brand/h-golden.png"
              alt="Zaam Gold"
              width={260}
              height={92}
              className="mx-auto mix-blend-multiply"
              priority
            />
          </div>
          <h1 className="text-4xl font-semibold text-zaam-gold">Zaam ERP Admin</h1>
          <p className="text-white/80 mt-3 max-w-md mx-auto">
            Premium. Modern. Powerful. Operate your enterprise with speed and precision.
          </p>
        </div>
        {/* Fine gold lines overlay */}
        <svg className="pointer-events-none absolute inset-0 opacity-15" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D4A017" />
              <stop offset="100%" stopColor="#B88914" />
            </linearGradient>
          </defs>
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={i} x1={i * 80} y1="0" x2={i * 40} y2="1000" stroke="url(#g)" strokeWidth="0.5" />
          ))}
        </svg>
      </div>

      {/* Right auth card */}
      <div className="relative flex items-center justify-center p-6 lg:p-10 bg-[#0A0A0A0A]">
        <div className="w-full max-w-md backdrop-blur-md bg-white/85 dark:bg-white/90 border border-zaam-soft rounded-2xl shadow-card p-8 animate-scale-in">
          <div className="flex justify-center mb-6">
            <Image
              src="/brand/h-black.png"
              alt="Zaam Logo"
              width={160}
              height={56}
              className="mix-blend-multiply"
              priority
            />
          </div>
          <h2 className="text-2xl font-semibold mb-2 text-zaam-black">Welcome back</h2>
          <p className="text-sm text-zaam-grey mb-6">Log in to manage your organization</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                className="input"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                className="input"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="btn btn-primary w-full h-11 text-base" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          <p className="text-xs text-zaam-grey mt-6 text-center">
            Tip: Use the email: <b>admin@zaam.co.uk</b> <br /> and password: <b>ChangeMe!123</b> to login.
          </p>
        </div>
      </div>
    </div>
  );
}


