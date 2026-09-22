'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Moon, Lock, Loader2, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  createEncryptedMasterKey, unlockMasterKey, storeMasterKey, loadStoredMasterKey, clearStoredMasterKey,
} from '@/lib/client-crypto';
import { DecryptedEntry, Entry, decryptEntry } from '@/lib/entries';
import { calculateStreak, StreakInfo } from '@/lib/streaks';
import { AppShell, View } from '@/components/shared/app-shell';
import { Onboarding, isOnboardingDone } from '@/components/shared/onboarding';
import { HomeView } from '@/components/views/home-view';
import { NewEntryView } from '@/components/views/new-entry-view';
import { HistoryView } from '@/components/views/history-view';
import { InsightsView } from '@/components/views/insights-view';
import { SettingsView } from '@/components/views/settings-view';
import { EntryDetail } from '@/components/shared/entry-detail';

type KeyState = 'loading' | 'unlocked' | 'needs-unlock';

// ===== Login Screen =====
function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let masterKeyPayload: { encryptedMasterKey: string; masterKeyIv: string; masterKeySalt: string } | undefined;

      if (mode === 'register') {
        const mk = await createEncryptedMasterKey(password);
        masterKeyPayload = {
          encryptedMasterKey: mk.encryptedMasterKey,
          masterKeyIv: mk.masterKeyIv,
          masterKeySalt: mk.masterKeySalt,
        };
        storeMasterKey(mk.serializedMasterKey);
      }

      const res = await signIn('credentials', {
        email,
        password,
        name: mode === 'register' ? name : undefined,
        mode,
        encryptedMasterKey: masterKeyPayload?.encryptedMasterKey,
        masterKeyIv: masterKeyPayload?.masterKeyIv,
        masterKeySalt: masterKeyPayload?.masterKeySalt,
        redirect: false,
      });

      if (res?.error) {
        clearStoredMasterKey();
        toast.error(res.error);
      } else {
        toast.success(mode === 'register' ? 'Аккаунт создан!' : 'С возвращением!');
        onLoggedIn();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-200/20 via-violet-400/20 to-cyan-300/20 border border-white/10 mb-4">
            <Moon className="w-7 h-7 text-amber-200" />
          </div>
          <h1 className="text-3xl font-serif text-foreground mb-2">Somnus AI</h1>
          <p className="text-muted-foreground text-sm">Твой персональный аналитик сновидений</p>
        </div>

        <Card className="p-6 backdrop-blur-xl bg-card/60 border-white/10">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Имя (необязательно)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к тебе обращаться" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" />
                <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Пароль используется для шифрования твоих записей — мы его не видим
                </p>
              </div>
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'register' ? 'Создать аккаунт' : 'Войти'}
              </Button>
            </form>
          </Tabs>
        </Card>

        <Card className="p-4 mt-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-emerald-200">End-to-end шифрование.</strong>{' '}
              Записи шифруются на твоём устройстве до отправки. Даже мы не можем их прочитать —
              ключ есть только у тебя.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// ===== Unlock Screen =====
function UnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/user/master-key');
      if (!res.ok) throw new Error('Не удалось получить ключ');
      const { encryptedMasterKey, masterKeyIv, masterKeySalt } = await res.json();

      const { serialized } = await unlockMasterKey(password, encryptedMasterKey, masterKeyIv, masterKeySalt);
      storeMasterKey(serialized);
      toast.success('Хранилище разблокировано');
      onUnlock();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось разблокировать');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-200/20 via-violet-400/20 to-cyan-300/20 border border-white/10 mb-4">
            <Lock className="w-7 h-7 text-amber-200" />
          </div>
          <h1 className="text-2xl font-serif text-foreground mb-2">Разблокировать хранилище</h1>
          <p className="text-muted-foreground text-sm">Введи пароль, чтобы расшифровать свои записи</p>
        </div>

        <Card className="p-6 backdrop-blur-xl bg-card/60 border-white/10">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlock-password">Пароль</Label>
              <Input id="unlock-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль от аккаунта" autoFocus />
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Разблокировать'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

// ===== Main App =====
export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<View>('home');
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selected, setSelected] = useState<DecryptedEntry | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [keyState, setKeyState] = useState<KeyState>('loading');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [streak, setStreak] = useState<StreakInfo>({
    current: 0, longest: 0, totalDays: 0, lastEntryDate: null, todayHasEntry: false,
  });

  // Загрузка master key
  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      const stored = await loadStoredMasterKey();
      if (stored) {
        setMasterKey(stored);
        setKeyState('unlocked');
      } else {
        setKeyState('needs-unlock');
      }
      // Показываем онбординг при первом входе
      if (!isOnboardingDone()) {
        setShowOnboarding(true);
      }
    })();
  }, [status]);

  // Загрузка записей + расшифровка
  const loadEntries = useCallback(async () => {
    if (!masterKey) return;
    setLoadingEntries(true);
    try {
      const res = await fetch('/api/entries?limit=100');
      const data = await res.json();
      const items: Entry[] = data.items || [];
      const decrypted: DecryptedEntry[] = [];
      for (const entry of items) {
        try {
          decrypted.push(await decryptEntry(entry, masterKey));
        } catch (e) {
          console.error('Failed to decrypt entry', entry.id, e);
        }
      }
      setEntries(decrypted);
      // Считаем streak
      const dates = decrypted.map((e) => new Date(e.createdAt));
      setStreak(calculateStreak(dates));
    } catch {
      toast.error('Не удалось загрузить записи');
    } finally {
      setLoadingEntries(false);
    }
  }, [masterKey]);

  useEffect(() => {
    if (masterKey) loadEntries();
  }, [masterKey, loadEntries]);

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту запись безвозвратно?')) return;
    try {
      await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Запись удалена');
      loadEntries(); // обновим streak
    } catch {
      toast.error('Не удалось удалить');
    }
  };

  const handleWipeAll = async () => {
    if (!confirm('Удалить ВСЕ записи безвозвратно?')) return;
    if (!confirm('Точно? Все сны и анализы будут стёрты.')) return;
    try {
      await fetch('/api/entries/all', { method: 'DELETE' });
      setEntries([]);
      setStreak({ current: 0, longest: 0, totalDays: 0, lastEntryDate: null, todayHasEntry: false });
      toast.success('Все записи удалены');
    } catch {
      toast.error('Не удалось удалить все записи');
    }
  };

  const handleSignOut = () => {
    clearStoredMasterKey();
    setMasterKey(null);
    setEntries([]);
    signOut();
  };

  const handleAccountDeleted = () => {
    clearStoredMasterKey();
    setMasterKey(null);
    setEntries([]);
    signOut({ redirect: false });
    window.location.reload();
  };

  // Состояния
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-200" />
      </div>
    );
  }

  if (!session) return <LoginScreen onLoggedIn={() => window.location.reload()} />;

  if (keyState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-200" />
      </div>
    );
  }

  if (keyState === 'needs-unlock' || !masterKey) {
    return <UnlockScreen onUnlock={() => setKeyState('unlocked')} />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <AppShell
      current={view}
      onNavigate={setView}
      streak={streak.current}
      unlocked={keyState === 'unlocked'}
    >
      {view === 'home' && (
        <HomeView
          entries={entries}
          streak={streak}
          onNavigate={setView}
          onSelectEntry={setSelected}
        />
      )}

      {view === 'new' && (
        <NewEntryView
          masterKey={masterKey}
          onCreated={() => {
            loadEntries();
            setView('history');
          }}
        />
      )}

      {view === 'history' && (
        <HistoryView
          entries={entries}
          loading={loadingEntries}
          onSelect={setSelected}
          onDelete={handleDelete}
        />
      )}

      {view === 'insights' && <InsightsView />}

      {view === 'settings' && (
        <SettingsView
          masterKey={masterKey}
          entries={entries}
          onPasswordChanged={() => {}}
          onAccountDeleted={handleAccountDeleted}
        />
      )}

      {/* Entry Detail Modal */}
      {selected && (
        <EntryDetail
          entry={selected}
          masterKey={masterKey}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            loadEntries();
            setSelected(null);
          }}
          onDeleted={() => {
            loadEntries();
            setSelected(null);
            setView('history');
          }}
        />
      )}
    </AppShell>
  );
}
