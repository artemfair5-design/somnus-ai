'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Download, Lock, Trash2, Loader2, ShieldCheck, AlertTriangle,
  CheckCircle2, KeyRound,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  storeMasterKey,
} from '@/lib/client-crypto';
import { DecryptedEntry } from '@/lib/entries';

interface SettingsViewProps {
  masterKey: CryptoKey;
  entries: DecryptedEntry[];
  onPasswordChanged: () => void;
  onAccountDeleted: () => void;
}

export function SettingsView({ masterKey, entries, onPasswordChanged, onAccountDeleted }: SettingsViewProps) {
  const [profile, setProfile] = useState<{ email: string; name: string | null; createdAt: string; totalEntries: number } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  // Delete account state
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/user/account')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setProfile(data);
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  // === Export all data (decrypted, client-side) ===
  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      app: 'Somnus AI',
      version: '0.2',
      user: { email: profile?.email, name: profile?.name },
      entries: entries.map((e) => ({
        createdAt: e.createdAt,
        editedAt: e.editedAt,
        entryType: e.entryType,
        inputMethod: e.inputMethod,
        moodScore: e.moodScore,
        topEmotion: e.topEmotion,
        content: e.content,
        dayEvents: e.dayEvents,
        analysis: e.analysis,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `somnus-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Данные экспортированы');
  };

  // === Change password (re-encrypt master key with new password) ===
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== newPwdConfirm) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (newPwd.length < 6) {
      toast.error('Минимум 6 символов');
      return;
    }

    setChangingPwd(true);
    try {
      // 1. Достаём текущий raw master key из sessionStorage (base64)
      const stored = sessionStorage.getItem('somnus_mk_v1');
      if (!stored) throw new Error('Master key не найден в sessionStorage');

      // 2. Перешифровываем этот же master key новым паролем
      const { reEncryptMasterKey } = await import('@/lib/client-crypto');
      const reEncrypted = await reEncryptMasterKey(stored, newPwd);

      // 3. Отправляем на сервер
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPwd,
          newPassword: newPwd,
          newEncryptedMasterKey: reEncrypted.encryptedMasterKey,
          newMasterKeyIv: reEncrypted.masterKeyIv,
          newMasterKeySalt: reEncrypted.masterKeySalt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 4. Master key в sessionStorage не изменился (он же тот же).
      toast.success('Пароль изменён. Записи не затронуты.');
      setCurrentPwd('');
      setNewPwd('');
      setNewPwdConfirm('');
      setShowPasswordForm(false);
      onPasswordChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сменить пароль');
    } finally {
      setChangingPwd(false);
    }
  };

  // === Delete account ===
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== profile?.email) {
      toast.error('Введи email для подтверждения');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Не удалось удалить аккаунт');
      toast.success('Аккаунт удалён');
      onAccountDeleted();
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl mb-1">Настройки</h1>
        <p className="text-muted-foreground text-sm">Профиль, безопасность, данные</p>
      </div>

      {/* Profile */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200/30 to-violet-400/30 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-amber-200" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{profile?.email}</p>
            <p className="text-xs text-muted-foreground">
              {profile?.name || 'Без имени'} · с {new Date(profile?.createdAt || '').toLocaleDateString('ru-RU')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          <div>
            <p className="text-xs text-muted-foreground">Всего записей</p>
            <p className="text-lg font-serif text-amber-200">{profile?.totalEntries ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Шифрование</p>
            <p className="text-sm font-medium text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Активно
            </p>
          </div>
        </div>
      </Card>

      {/* Export data */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium mb-1 flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-300" /> Экспорт данных
            </h3>
            <p className="text-xs text-muted-foreground">
              Скачать все свои записи и анализы в JSON. Расшифровывается локально.
            </p>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            disabled={entries.length === 0}
          >
            Скачать
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <button
          onClick={() => setShowPasswordForm((s) => !s)}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div>
            <h3 className="font-medium mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-200" /> Сменить пароль
            </h3>
            <p className="text-xs text-muted-foreground">
              Пароль используется для разблокировки записей. Записи не будут затронуты.
            </p>
          </div>
        </button>

        {showPasswordForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            onSubmit={handleChangePassword}
            className="mt-4 pt-4 border-t border-white/5 space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cur-pwd" className="text-xs">Текущий пароль</Label>
              <Input
                id="cur-pwd"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                className="bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd" className="text-xs">Новый пароль</Label>
              <Input
                id="new-pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={6}
                className="bg-background/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd-conf" className="text-xs">Повтори новый пароль</Label>
              <Input
                id="new-pwd-conf"
                type="password"
                value={newPwdConfirm}
                onChange={(e) => setNewPwdConfirm(e.target.value)}
                required
                minLength={6}
                className="bg-background/40"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={changingPwd} className="flex-1 gap-2">
                {changingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Сменить пароль
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowPasswordForm(false)}>
                Отмена
              </Button>
            </div>
          </motion.form>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="p-5 backdrop-blur-xl bg-rose-500/5 border-rose-500/20">
        <button
          onClick={() => setShowDeleteForm((s) => !s)}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div>
            <h3 className="font-medium mb-1 flex items-center gap-2 text-rose-200">
              <AlertTriangle className="w-4 h-4" /> Удалить аккаунт
            </h3>
            <p className="text-xs text-muted-foreground">
              Безвозвратно. Все записи будут стёрты с сервера.
            </p>
          </div>
        </button>

        {showDeleteForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-4 border-t border-rose-500/10 space-y-3"
          >
            <p className="text-xs text-muted-foreground">
              Введи свой email <code className="text-rose-200">{profile?.email}</code> для подтверждения:
            </p>
            <Input
              type="email"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={profile?.email}
              className="bg-background/40 border-rose-500/20"
            />
            <Button
              onClick={handleDeleteAccount}
              variant="destructive"
              disabled={deleting || deleteConfirm !== profile?.email}
              className="w-full gap-2"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Удалить аккаунт навсегда
            </Button>
          </motion.div>
        )}
      </Card>

      {/* About */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <h3 className="font-medium mb-3">О приложении</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>End-to-end шифрование AES-256</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Ключ есть только у тебя (PBKDF2, 150k итераций)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>AI-анализ: Юнг, Фромм, Холлис, когнитивная психотерапия</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Версия 0.2 · PWA · Анализ снов и тревог</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
