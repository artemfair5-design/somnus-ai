'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis as RechartsXAxis, Cell,
} from 'recharts';
import type { Stats } from '@/lib/entries';

const PERIODS = [
  { days: 7, label: '7 дн' },
  { days: 30, label: '30 дн' },
  { days: 90, label: '90 дн' },
  { days: 365, label: 'Год' },
];

const MOOD_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981'];

export function InsightsView() {
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stats?period=${period}`);
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-xl bg-secondary/30 animate-pulse" />
        <div className="h-32 rounded-xl bg-secondary/30 animate-pulse" />
        <div className="h-64 rounded-xl bg-secondary/30 animate-pulse" />
      </div>
    );
  }

  if (!stats || stats.totalEntries === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl md:text-3xl">Паттерны</h1>
        <Card className="p-12 text-center backdrop-blur-xl bg-card/40 border-white/10">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-1">Недостаточно данных</p>
          <p className="text-xs text-muted-foreground/70">
            Сделай минимум 3 записи за выбранный период, чтобы увидеть паттерны
          </p>
        </Card>
      </div>
    );
  }

  const chartData = stats.moodTrend.map((d) => ({
    date: new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    score: d.score,
  }));

  const trendIcon = stats.moodTrendDelta === null ? <Minus className="w-4 h-4" />
    : stats.moodTrendDelta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-300" />
    : stats.moodTrendDelta < 0 ? <TrendingDown className="w-4 h-4 text-rose-300" />
    : <Minus className="w-4 h-4" />;

  const trendText = stats.moodTrendDelta === null ? 'нет данных'
    : stats.moodTrendDelta > 0 ? `+${stats.moodTrendDelta} к предыдущему периоду`
    : stats.moodTrendDelta < 0 ? `${stats.moodTrendDelta} к предыдущему периоду`
    : 'стабильно';

  const dreamPercent = stats.totalEntries > 0
    ? Math.round((stats.breakdown.dream / stats.totalEntries) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl mb-1">Паттерны</h1>
        <p className="text-muted-foreground text-sm">Долгосрочная динамика и инсайты</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 p-1 bg-secondary/30 rounded-xl w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriod(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p.days
                ? 'bg-amber-200/20 text-amber-200'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10">
          <p className="text-xs text-muted-foreground mb-1">Всего записей</p>
          <p className="text-2xl font-serif text-amber-200">{stats.totalEntries}</p>
        </Card>
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10">
          <p className="text-xs text-muted-foreground mb-1">Среднее настроение</p>
          <p className="text-2xl font-serif text-cyan-300">
            {stats.avgMood ?? '—'}
            {stats.avgMood !== null && <span className="text-sm text-muted-foreground">/100</span>}
          </p>
        </Card>
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10">
          <p className="text-xs text-muted-foreground mb-1">Топ-эмоция</p>
          <p className="text-2xl font-serif text-violet-300">
            {stats.topEmotions[0]?.name || '—'}
          </p>
        </Card>
      </div>

      {/* Trend */}
      {stats.moodTrendDelta !== null && (
        <Card className="p-4 backdrop-blur-xl bg-card/40 border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/40 flex items-center justify-center">
              {trendIcon}
            </div>
            <div>
              <p className="text-sm font-medium">Тренд настроения</p>
              <p className="text-xs text-muted-foreground">{trendText}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Mood chart */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <h3 className="font-serif text-lg mb-4">Динамика настроения</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={11} />
            <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.5)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: 'rgba(20, 25, 50, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#d4b066"
              strokeWidth={2}
              dot={{ fill: '#d4b066', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Breakdown */}
      <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
        <h3 className="font-serif text-lg mb-4">Распределение по типам</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex h-3 rounded-full overflow-hidden bg-secondary/30 mb-2">
              <div
                className="bg-violet-400/70"
                style={{ width: `${dreamPercent}%` }}
              />
              <div
                className="bg-rose-400/70"
                style={{ width: `${100 - dreamPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>🌙 Сны: {stats.breakdown.dream}</span>
              <span>💫 Тревоги: {stats.breakdown.anxiety}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Top emotions */}
      {stats.topEmotions.length > 0 && (
        <Card className="p-5 backdrop-blur-xl bg-card/40 border-white/10">
          <h3 className="font-serif text-lg mb-4">Частые эмоции</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, stats.topEmotions.length * 32)}>
            <BarChart data={stats.topEmotions} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <RechartsXAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <XAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" fontSize={12} width={90} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(20, 25, 50, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {stats.topEmotions.map((_, i) => (
                  <Cell key={i} fill={MOOD_COLORS[i % MOOD_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
