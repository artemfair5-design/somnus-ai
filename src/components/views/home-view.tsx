'use client';

import { motion } from 'framer-motion';
import { Plus, Flame, Sparkles, TrendingUp, ArrowRight, Moon, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DecryptedEntry, isToday, formatDate } from '@/lib/entries';
import { StreakInfo, getNextMilestone } from '@/lib/streaks';
import type { View } from '@/components/shared/app-shell';

interface HomeViewProps {
  entries: DecryptedEntry[];
  streak: StreakInfo;
  onNavigate: (v: View) => void;
  onSelectEntry: (e: DecryptedEntry) => void;
}

export function HomeView({ entries, streak, onNavigate, onSelectEntry }: HomeViewProps) {
  const todayEntries = entries.filter((e) => isToday(e.createdAt));
  const recentEntries = entries.slice(0, 3);
  const nextMilestone = getNextMilestone(streak.current);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="space-y-6">
      {/* Greeting + streak */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-serif text-2xl md:text-3xl mb-1">{greeting}.</h1>
        <p className="text-muted-foreground text-sm">
          {todayEntries.length > 0
            ? `Сегодня уже ${todayEntries.length} ${pluralize(todayEntries.length, ['запись', 'записи', 'записей'])}.`
            : 'Сегодня ещё нет записей. Надиктуй сон или тревогу.'}
        </p>
      </motion.div>

      {/* Streak card */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-5 h-5 text-amber-200" />
              <span className="text-3xl font-serif text-amber-200">{streak.current}</span>
              <span className="text-sm text-muted-foreground">дн. подряд</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {streak.longest > 0 && `Рекорд: ${streak.longest} дн. · `}
              Всего {streak.totalDays} {pluralize(streak.totalDays, ['день', 'дня', 'дней'])} с записями
            </p>
            {nextMilestone && (
              <p className="text-[11px] text-amber-200/70 mt-2">
                {nextMilestone.icon} {nextMilestone.label} через {nextMilestone.days - streak.current} дн.
              </p>
            )}
          </div>
          <Button
            onClick={() => onNavigate('new')}
            size="lg"
            className="gap-2 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Запись
          </Button>
        </div>
      </Card>

      {/* Today's quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10 cursor-pointer hover:border-white/20 transition-all"
          onClick={() => onNavigate('new')}>
          <Moon className="w-5 h-5 text-violet-300 mb-2" />
          <p className="text-sm font-medium">Записать сон</p>
          <p className="text-xs text-muted-foreground">Голосом или текстом</p>
        </Card>
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10 cursor-pointer hover:border-white/20 transition-all"
          onClick={() => onNavigate('insights')}>
          <TrendingUp className="w-5 h-5 text-cyan-300 mb-2" />
          <p className="text-sm font-medium">Паттерны</p>
          <p className="text-xs text-muted-foreground">Динамика и эмоции</p>
        </Card>
      </div>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg">Недавние записи</h2>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Все <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentEntries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="p-4 backdrop-blur-xl bg-card/40 border-white/10 hover:border-white/20 transition-all cursor-pointer"
                  onClick={() => onSelectEntry(entry)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{entry.entryType === 'dream' ? '🌙' : '💫'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </span>
                      {entry.editedAt && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">изм.</Badge>
                      )}
                    </div>
                    {entry.moodScore !== null && (
                      <span className="text-sm font-mono text-amber-200">{entry.moodScore}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 line-clamp-2 mb-2">
                    {entry.content}
                  </p>
                  <div className="flex items-center gap-2">
                    {entry.topEmotion && (
                      <Badge variant="outline" className="text-[10px]">{entry.topEmotion}</Badge>
                    )}
                    {entry.analysis?.symbols?.[0] && (
                      <Badge variant="outline" className="text-[10px] text-violet-300">
                        {entry.analysis.symbols[0].archetype}
                      </Badge>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {recentEntries.length === 0 && (
        <Card className="p-8 text-center backdrop-blur-xl bg-card/40 border-white/10">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-3">
            Это твой первый раз в Somnus AI.
          </p>
          <Button onClick={() => onNavigate('new')} variant="outline" size="sm" className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Создать первую запись
          </Button>
        </Card>
      )}
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}
