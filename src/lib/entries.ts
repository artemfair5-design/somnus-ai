// Общие типы и helpers для расшифровки записей.
// Используются в нескольких views, чтобы не дублировать логику.

import { decryptString } from '@/lib/client-crypto';

export type Entry = {
  id: string;
  encryptedContent: string;
  contentIv: string;
  encryptedDayEvents: string | null;
  dayEventsIv: string | null;
  encryptedAnalysis: string | null;
  analysisIv: string | null;
  entryType: string;
  inputMethod: string;
  moodScore: number | null;
  topEmotion: string | null;
  createdAt: string;
  editedAt: string | null;
};

export type Analysis = {
  emotions: { name: string; intensity: number }[];
  symbols: { archetype: string; image: string; meaning: string }[];
  realityLinks: { dayEvent: string; connection: string }[];
  summary: string;
  moodScore: number;
};

export type DecryptedEntry = Entry & {
  content?: string;
  dayEvents?: string | null;
  analysis?: Analysis | null;
};

export type Stats = {
  period: { days: number; since: string; until: string };
  totalEntries: number;
  avgMood: number | null;
  prevAvgMood: number | null;
  moodTrendDelta: number | null;
  moodTrend: { date: string; score: number; type: string }[];
  topEmotions: { name: string; count: number }[];
  breakdown: { dream: number; anxiety: number };
};

export async function decryptEntry(
  entry: Entry,
  masterKey: CryptoKey
): Promise<DecryptedEntry> {
  const content = await decryptString(entry.encryptedContent, entry.contentIv, masterKey);

  let dayEvents: string | null = null;
  if (entry.encryptedDayEvents && entry.dayEventsIv) {
    try {
      dayEvents = await decryptString(entry.encryptedDayEvents, entry.dayEventsIv, masterKey);
    } catch {}
  }

  let analysis: Analysis | null = null;
  if (entry.encryptedAnalysis && entry.analysisIv) {
    try {
      const analysisJson = await decryptString(entry.encryptedAnalysis, entry.analysisIv, masterKey);
      analysis = JSON.parse(analysisJson) as Analysis;
    } catch {}
  }

  return { ...entry, content, dayEvents, analysis };
}

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString('ru-RU', opts || {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(d: string | Date): string {
  return new Date(d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function isToday(d: string | Date): boolean {
  const date = new Date(d);
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
}
