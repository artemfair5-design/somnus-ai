'use client';

import { motion } from 'framer-motion';
import { Home, Plus, History, BarChart3, Settings, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type View = 'home' | 'new' | 'history' | 'insights' | 'settings';

export const VIEWS: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Сегодня', icon: Home },
  { id: 'new', label: 'Запись', icon: Plus },
  { id: 'history', label: 'История', icon: History },
  { id: 'insights', label: 'Паттерны', icon: BarChart3 },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

interface AppShellProps {
  current: View;
  onNavigate: (v: View) => void;
  children: React.ReactNode;
  streak?: number;
  unlocked: boolean;
}

export function AppShell({ current, onNavigate, children, streak = 0, unlocked }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header (mobile + desktop) */}
      <header className="border-b border-white/5 backdrop-blur-xl bg-background/60 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-200/30 to-violet-400/30 flex items-center justify-center border border-white/10">
              <Moon className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <h1 className="font-serif text-lg leading-none">Somnus AI</h1>
              {unlocked && (
                <p className="text-[10px] text-emerald-300/70 flex items-center gap-1">
                  {streak > 0 ? (
                    <>
                      <span className="text-amber-200">🔥 {streak}</span>
                      <span className="opacity-50">·</span>
                      <span>дн. подряд</span>
                    </>
                  ) : (
                    'Готов к записи'
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop: side nav */}
      <div className="flex-1 max-w-5xl mx-auto w-full flex gap-6 px-4 py-6">
        <nav className="hidden md:flex flex-col gap-1 w-56 flex-shrink-0 sticky top-24 self-start">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onNavigate(v.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                current === v.id
                  ? 'bg-white/5 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <v.icon className="w-4 h-4" />
              {v.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 backdrop-blur-2xl bg-background/80 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {VIEWS.map((v) => {
            const active = current === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onNavigate(v.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  active ? 'text-amber-200' : 'text-muted-foreground'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-px h-0.5 w-8 bg-amber-200 rounded-full"
                  />
                )}
                <v.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{v.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer (desktop) */}
      <footer className="hidden md:block border-t border-white/5 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-3 text-center">
          <p className="text-[11px] text-muted-foreground">
            Somnus AI · End-to-end шифрование · Сервер не видит твои записи
          </p>
        </div>
      </footer>
    </div>
  );
}
