'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Lock, Sparkles, Heart, Brain, TrendingUp, Pencil, Loader2, Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { encryptString } from '@/lib/client-crypto';
import { DecryptedEntry, Analysis } from '@/lib/entries';

interface EntryDetailProps {
  entry: DecryptedEntry;
  masterKey: CryptoKey;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function EntryDetail({ entry, masterKey, onClose, onUpdated, onDeleted }: EntryDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content || '');
  const [editDayEvents, setEditDayEvents] = useState(entry.dayEvents || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const analysis = entry.analysis;
  const emotions = analysis?.emotions || [];
  const symbols = analysis?.symbols || [];
  const realityLinks = analysis?.realityLinks || [];

  const handleSave = async () => {
    if (editContent.trim().length < 10) {
      toast.error('Запись слишком короткая');
      return;
    }
    setSaving(true);
    try {
      // Перешифровываем изменённые поля. Если content изменился — перешифровываем и analysis.
      const contentChanged = editContent !== entry.content;
      const dayEventsChanged = editDayEvents !== (entry.dayEvents || '');

      const updateData: any = {};

      if (contentChanged) {
        // Получаем новый AI-анализ
        const analyzeRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent,
            dayEvents: editDayEvents || undefined,
            entryType: entry.entryType,
          }),
        });
        const analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok) throw new Error(analyzeData.error);
        const newAnalysis: Analysis = analyzeData.analysis;

        // Шифруем новый content
        const encContent = await encryptString(editContent, masterKey);
        updateData.encryptedContent = encContent.ciphertext;
        updateData.contentIv = encContent.iv;

        // Шифруем новый analysis
        const encAnalysis = await encryptString(JSON.stringify(newAnalysis), masterKey);
        updateData.encryptedAnalysis = encAnalysis.ciphertext;
        updateData.analysisIv = encAnalysis.iv;

        // Обновляем метаданные
        updateData.moodScore = newAnalysis.moodScore;
        updateData.topEmotion = newAnalysis.emotions[0]?.name || null;
      }

      if (dayEventsChanged) {
        if (editDayEvents.trim()) {
          const encDayEvents = await encryptString(editDayEvents, masterKey);
          updateData.encryptedDayEvents = encDayEvents.ciphertext;
          updateData.dayEventsIv = encDayEvents.iv;
        } else {
          updateData.encryptedDayEvents = null;
          updateData.dayEventsIv = null;
        }
      }

      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(contentChanged ? 'Запись обновлена, AI переанализировал' : 'Запись сохранена');
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить эту запись безвозвратно?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      toast.success('Запись удалена');
      onDeleted();
    } catch {
      toast.error('Не удалось удалить');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <Badge variant="outline" className="mb-2">
              {entry.entryType === 'dream' ? '🌙 Сон' : '💫 Тревога'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString('ru-RU')}
              {entry.editedAt && (
                <span className="ml-2 italic">
                  (изм. {new Date(entry.editedAt).toLocaleString('ru-RU')})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!isEditing && (
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content (editable or read-only) */}
        {isEditing ? (
          <div className="space-y-3 mb-5">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Твоя запись</p>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[160px] bg-background/40"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">События дня</p>
              <Input
                value={editDayEvents}
                onChange={(e) => setEditDayEvents(e.target.value)}
                className="bg-background/40"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI переанализирует…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Сохранить
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Отмена
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              При изменении текста AI переанализирует запись. Эмоции, архетипы и связи обновятся.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Твоя запись</h4>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{entry.content}</p>
            </div>

            {entry.dayEvents && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">События дня</h4>
                <p className="text-sm text-foreground/70">{entry.dayEvents}</p>
              </div>
            )}

            {entry.moodScore !== null && (
              <div className="p-4 rounded-xl bg-secondary/40 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Настроение записи</span>
                  <span className="text-2xl font-serif text-amber-200">{entry.moodScore}/100</span>
                </div>
                <div className="h-2 bg-background/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400"
                    style={{ width: `${entry.moodScore}%` }}
                  />
                </div>
              </div>
            )}

            {analysis?.summary && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-200" /> Краткий вывод AI
                </h4>
                <p className="text-foreground leading-relaxed">{analysis.summary}</p>
              </div>
            )}

            {emotions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-300" /> Эмоциональный профиль
                </h4>
                <div className="flex flex-wrap gap-2">
                  {emotions.map((e, i) => (
                    <Badge key={i} variant="secondary" className="gap-2">
                      {e.name}
                      <span className="text-xs text-muted-foreground">
                        {Math.round(e.intensity * 100)}%
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {symbols.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-300" /> Архетипы по Юнгу
                </h4>
                <div className="space-y-3">
                  {symbols.map((s, i) => (
                    <div key={i} className="p-3 rounded-lg bg-secondary/40 border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-violet-500/20 text-violet-200 border-violet-400/30">
                          {s.archetype}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{s.image}</span>
                      </div>
                      <p className="text-sm text-foreground/80">{s.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {realityLinks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-300" /> Связь с реальностью
                </h4>
                <div className="space-y-3">
                  {realityLinks.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg bg-secondary/40 border border-white/5">
                      <div className="text-sm font-medium mb-1">{r.dayEvent}</div>
                      <p className="text-sm text-foreground/80">{r.connection}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-emerald-300/70">
              <Lock className="w-3 h-3" />
              Запись расшифрована локально на твоём устройстве
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
