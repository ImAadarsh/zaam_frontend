import { Sun, MoonStar, Menu, ChevronDown, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useUI } from '@/lib/ui';
import { useState } from 'react';

export type HeaderAction = {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
};

export function Header({ title, actions }: { title: string; actions?: HeaderAction[] }) {
  const { theme, setTheme } = useTheme();
  const { toggleSidebar } = useUI();
  const [showActions, setShowActions] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-16 backdrop-blur-xl bg-white/70 dark:bg-[#0f0f0f]/70 border-b border-border/50 flex items-center justify-between px-4 md:px-6 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => toggleSidebar(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-4">
          <div className="relative h-6 w-[140px] md:hidden">
            <Image src="/brand/golden-shine.png" alt="Zaam" fill className="object-contain object-left" />
          </div>
          <div className="hidden md:block h-5 w-px bg-border/60" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground/90">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions && actions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Features</span>
              <ChevronDown size={16} />
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-40 py-1 animate-in fade-in zoom-in-95">
                  {actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        action.onClick();
                        setShowActions(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
          <MoonStar className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400" />
        </button>
      </div>
    </header>
  );
}
