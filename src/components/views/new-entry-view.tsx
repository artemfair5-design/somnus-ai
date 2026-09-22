'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Moon, Mic, Square, Send, Sparkles, Heart, BookOpen, Loader2, Lock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { encryptString } from '@/lib/client-crypto';
import type { Analysis } from '@/lib/entries';

interface NewEntryViewProps {
  masterKey: CryptoKey;
  onCreated: () => void;
}

export function NewEntryView({ masterKey, onCreated }: NewEntryViewProps) {
  const [text, setText] = useState('');
  const [dayEvents, setDayEvents] = useState('');
  const [entryType, setEntryType] = useState<'dream' | 'anxiety'>('dream');
  const [inputMethod, setInputMethod] = useState<'text' | 'voice'>('text');
  const [submitting, setSubmitting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const { isRecording, audioBlob, duration, error: micError, start, stop, reset } = useVoiceRecorder();

  useEffect(() => {
    if (micError) toast.error(micError);
  }, [micError]);

  useEffect(() => {
    if (!audioBlob) return;
    const transcribe = async () => {
      setTranscribing(true);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mimeType: 'audio/webm' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setText(data.text);
          toast.success('Голос распознан');
        };
        reader.readAsDataURL(audioBlob);
      } catch (err: any) {
        toast.error(err?.message || 'Не удалось распознать голос');
      } finally {
        setTranscribing(false);
      }
    };
    transcribe();
  }, [audioBlob]);

  const submit = async () => {
    if (text.trim().length < 10) {
      toast.error('Запись слишком короткая (минимум 10 символов)');
      return;
    }
    setSubmitting(true);

    try {
      // 1. AI-анализ (plaintext уходит на сервер, но НЕ сохраняется)
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          dayEvents: dayEvents || undefined,
          entryType,
        }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error);
      const analysis: Analysis = analyzeData.analysis;

      // 2. Шифруем на клиенте
      const encryptedContent = await encryptString(text, masterKey);
      const encryptedDayEvents = dayEvents.trim()
        ? await encryptString(dayEvents, masterKey)
        : null;
      const encryptedAnalysis = await encryptString(JSON.stringify(analysis), masterKey);

      const topEmotion = analysis.emotions[0]?.name || null;

      // 3. Сохраняем зашифрованное на сервер
      const saveRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedContent: encryptedContent.ciphertext,
          contentIv: encryptedContent.iv,
          encryptedDayEvents: encryptedDayEvents?.ciphertext,
          dayEventsIv: encryptedDayEvents?.iv,
          encryptedAnalysis: encryptedAnalysis.ciphertext,
          analysisIv: encryptedAnalysis.iv,
          entryType,
          inputMethod,
          moodScore: analysis.moodScore,
          topEmotion,
        }),
      });
      if (!saveRes.ok) {
        const saveData = await saveRes.json();
        throw new Error(saveData.error);
      }

      toast.success('Сон проанализирован и зашифрован');
      setText('');
      setDayEvents('');
      reset();
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить запись');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl mb-1">Новая запись</h1>
        <p className="text-muted-foreground text-sm">Опиши сон или тревогу — AI даст обратную связь</p>
      </div>

      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <Tabs value={entryType} onValueChange={(v) => setEntryType(v as 'dream' | 'anxiety')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dream" className="gap-2">
              <Moon className="w-4 h-4" /> Сон
            </TabsTrigger>
            <TabsTrigger value="anxiety" className="gap-2">
              <Heart className="w-4 h-4" /> Тревога
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 mb-4">
          <Button
            variant={inputMethod === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setInputMethod('text'); reset(); }}
            className="gap-2"
          >
            <BookOpen className="w-4 h-4" /> Текст
          </Button>
          <Button
            variant={inputMethod === 'voice' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('voice')}
            className="gap-2"
          >
            <Mic className="w-4 h-4" /> Голос
          </Button>
        </div>

        {inputMethod === 'voice' && (
          <div className="mb-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 border border-white/5">
              {!isRecording ? (
                <Button onClick={start} variant="default" size="sm" className="gap-2">
                  <Mic className="w-4 h-4" /> Начать запись
                </Button>
              ) : (
                <Button onClick={stop} variant="destructive" size="sm" className="gap-2">
                  <Square className="w-4 h-4" /> Остановить
                </Button>
              )}
              {isRecording && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400">{duration}с</span>
                </div>
              )}
              {transcribing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Транскрибируем…
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              entryType === 'dream'
                ? 'Опиши свой сон. Что видел, что чувствовал, какие образы запомнились...'
                : 'Опиши, что тебя тревожит. Не редактируй — пиши как есть...'
            }
            className="min-h-[180px] resize-y bg-background/40"
          />
          <Input
            value={dayEvents}
            onChange={(e) => setDayEvents(e.target.value)}
            placeholder="События дня через запятую (необязательно)"
            className="bg-background/40"
          />
          <Button
            onClick={submit}
            disabled={submitting || transcribing || text.trim().length < 10}
            className="w-full gap-2"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI анализирует + шифрует…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Зашифровать и проанализировать
              </>
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground/70 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Запись шифруется на твоём устройстве до отправки на сервер
          </p>
        </div>
      </Card>

      {/* What you'll get */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-200" /> Что ты получишь
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span><strong className="text-foreground">Эмоциональный профиль</strong> — доминирующие эмоции с интенсивностью</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span><strong className="text-foreground">Архетипы по Юнгу</strong> — Тень, Анима, Самость, Герой и др.</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span><strong className="text-foreground">Связь с реальностью</strong> — как сон отражает дневные события</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span><strong className="text-foreground">Настроение записи</strong> — числовая оценка 0-100</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
