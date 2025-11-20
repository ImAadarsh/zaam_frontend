'use client';
import Link from 'next/link';
import { Shield, Users, KeySquare, FileClock, LayoutDashboard, Grid, LogOut, X, ArrowLeftRight, User } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession } from '@/lib/auth';
import { useUI } from '@/lib/ui';
import { useEffect } from 'react';

export function Sidebar() {
  const pathname = usePathname();
  const root = (pathname || '/').split('/')[1] || '';
  const isIAM = root === 'iam';
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUI();

  function doLogout() {
    clearSession();
    router.replace('/login');
  }

  // Close drawer on ESC and lock body scroll while open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') toggleSidebar(false);
    }
    document.addEventListener('keydown', onKey);
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
        document.removeEventListener('keydown', onKey);
      };
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen, toggleSidebar]);

  // Auto-close on route change
  useEffect(() => {
    toggleSidebar(false);
  }, [pathname, toggleSidebar]);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[280px] bg-[#0f0f0f]/95 backdrop-blur-2xl text-white p-5 border-r border-white/5 flex-col shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-50">
        <div className="flex items-center gap-3 px-2 mb-6 mt-2">
          <div className="relative h-8 w-32">
            <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" />
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-2 mb-4" />
        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1 scrollbar-none">
          <Item href="/dashboard" icon={<LayoutDashboard size={20} />} label="Global Dashboard" active={pathname === '/dashboard'} />
          {isIAM && (
            <>
              <div className="mt-6 mb-2 text-[10px] uppercase tracking-widest font-semibold text-white/40 px-3">Identity & Access</div>
              <Item href="/iam/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/iam/dashboard'} />
              <Item href="/iam/users" icon={<Users size={18} />} label="Users" active={pathname?.startsWith('/iam/users')} />
              <Item href="/iam/roles" icon={<Shield size={18} />} label="Roles" active={pathname?.startsWith('/iam/roles')} />
              <Item href="/iam/api-keys" icon={<KeySquare size={18} />} label="API Keys" active={pathname?.startsWith('/iam/api-keys')} />
              <Item href="/iam/audit-logs" icon={<FileClock size={18} />} label="Audit Logs" active={pathname?.startsWith('/iam/audit-logs')} />
            </>
          )}
        </nav>
        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
          <Link
            href="/profile"
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <User size={18} className="group-hover:text-primary transition-colors" />
            <span className="font-medium text-sm">Profile</span>
          </Link>
          <Link
            href="/modules"
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <ArrowLeftRight size={18} className="group-hover:text-primary transition-colors" />
            <span className="font-medium text-sm">Switch Module</span>
          </Link>
          <button
            onClick={doLogout}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => toggleSidebar(false)} />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-[#0f0f0f] text-white p-5 border-r border-white/10 flex flex-col shadow-2xl animate-slide-in">
            <div className="flex items-center justify-between px-1 mb-6">
              <div className="relative h-8 w-32">
                <Image src="/brand/h-golden.png" alt="Zaam" fill className="object-contain object-left" />
              </div>
              <button aria-label="Close menu" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition" onClick={() => toggleSidebar(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="h-px bg-white/10 mx-2 mb-4" />
            <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              <Item href="/dashboard" icon={<LayoutDashboard size={20} />} label="Global Dashboard" active={pathname === '/dashboard'} />
              {isIAM && (
                <>
                  <div className="mt-6 mb-2 text-[10px] uppercase tracking-widest font-semibold text-white/40 px-3">Identity & Access</div>
                  <Item href="/iam/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={pathname === '/iam/dashboard'} />
                  <Item href="/iam/users" icon={<Users size={18} />} label="Users" active={pathname?.startsWith('/iam/users')} />
                  <Item href="/iam/roles" icon={<Shield size={18} />} label="Roles" active={pathname?.startsWith('/iam/roles')} />
                  <Item href="/iam/api-keys" icon={<KeySquare size={18} />} label="API Keys" active={pathname?.startsWith('/iam/api-keys')} />
                  <Item href="/iam/audit-logs" icon={<FileClock size={18} />} label="Audit Logs" active={pathname?.startsWith('/iam/audit-logs')} />
                </>
              )}
            </nav>
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
              <Link
                href="/profile"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <User size={18} />
                <span className="font-medium">Profile</span>
              </Link>
              <Link
                href="/modules"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <ArrowLeftRight size={18} />
                <span className="font-medium">Switch Module</span>
              </Link>
              <button
                onClick={() => { toggleSidebar(false); doLogout(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <LogOut size={18} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Item({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${active
        ? 'bg-gradient-to-r from-zaam-500/20 to-transparent text-zaam-400 shadow-[inset_2px_0_0_0_#D4A017]'
        : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
    >
      <span className={`transition-colors ${active ? 'text-zaam-500' : 'group-hover:text-white'}`}>{icon}</span>
      <span>{label}</span>
      {active && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-zaam-500/20 pointer-events-none" />
      )}
    </Link>
  );
}
