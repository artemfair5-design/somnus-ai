// GET /api/stats — агрегаты для графика настроения.
// Поддерживает periods: 7, 30, 90, 365 дней (через ?period=30).
// Сервер не видит содержимое записей — статистика только по открытым метаданным.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('period') || '30'), 1), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await db.dreamEntry.findMany({
    where: {
      userId,
      createdAt: { gte: since },
      moodScore: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      moodScore: true,
      entryType: true,
      topEmotion: true,
    },
  });

  // Группируем topEmotion за период
  const emotionCounts: Record<string, number> = {};
  for (const e of entries) {
    if (!e.topEmotion) continue;
    emotionCounts[e.topEmotion] = (emotionCounts[e.topEmotion] || 0) + 1;
  }

  const topEmotions = Object.entries(emotionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const avgMood = entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + (e.moodScore || 0), 0) / entries.length)
    : null;

  // Динамика по дням (агрегируем несколько записей в день в среднее)
  const dayMap: Record<string, { sum: number; count: number; date: Date }> = {};
  for (const e of entries) {
    const dayKey = new Date(e.createdAt).toISOString().split('T')[0];
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = { sum: 0, count: 0, date: new Date(e.createdAt) };
    }
    dayMap[dayKey].sum += e.moodScore || 0;
    dayMap[dayKey].count += 1;
  }

  const moodTrend = Object.values(dayMap)
    .map((d) => ({
      date: d.date,
      score: Math.round(d.sum / d.count),
      type: 'mixed',
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Сравнение с предыдущим периодом (для тренда)
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - days);

  const prevEntries = await db.dreamEntry.findMany({
    where: {
      userId,
      createdAt: { gte: prevSince, lt: since },
      moodScore: { not: null },
    },
    select: { moodScore: true },
  });

  const prevAvgMood = prevEntries.length > 0
    ? Math.round(prevEntries.reduce((sum, e) => sum + (e.moodScore || 0), 0) / prevEntries.length)
    : null;

  const moodTrendDelta = avgMood !== null && prevAvgMood !== null
    ? avgMood - prevAvgMood
    : null;

  // Распределение по типам
  const dreamCount = entries.filter((e) => e.entryType === 'dream').length;
  const anxietyCount = entries.filter((e) => e.entryType === 'anxiety').length;

  return NextResponse.json({
    period: { days, since, until: new Date() },
    totalEntries: entries.length,
    avgMood,
    prevAvgMood,
    moodTrendDelta,
    moodTrend,
    topEmotions,
    breakdown: {
      dream: dreamCount,
      anxiety: anxietyCount,
    },
  });
}
