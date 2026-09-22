// Streak calculation — считает серию последовательных дней с записями.
// Не зависит от сервера: работает с уже расшифрованным списком записей на клиенте.

export interface StreakInfo {
  current: number;       // текущая серия (дней)
  longest: number;       // самая длинная серия
  totalDays: number;     // всего уникальных дней с записями
  lastEntryDate: Date | null;
  todayHasEntry: boolean;
}

export function calculateStreak(entryDates: Date[]): StreakInfo {
  if (entryDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      totalDays: 0,
      lastEntryDate: null,
      todayHasEntry: false,
    };
  }

  // Получаем уникальные дни в формате YYYY-MM-DD
  const daySet = new Set<string>();
  for (const d of entryDates) {
    daySet.add(toDayKey(d));
  }

  const sortedDays = Array.from(daySet).sort();
  const today = toDayKey(new Date());
  const yesterday = toDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const todayHasEntry = daySet.has(today);
  const lastEntryDate = new Date(sortedDays[sortedDays.length - 1] + 'T12:00:00');

  // Текущая серия: считаем назад с сегодня или вчера
  // (если сегодня нет записи — это не обрывает серию, пока день не закончился)
  let current = 0;
  let cursor = todayHasEntry ? today : yesterday;

  while (daySet.has(cursor)) {
    current += 1;
    const d = new Date(cursor + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    cursor = toDayKey(d);
  }

  // Самая длинная серия
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const dayKey of sortedDays) {
    const d = new Date(dayKey + 'T12:00:00');
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
      if (diff === 1) {
        run += 1;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  return {
    current,
    longest: Math.max(longest, current),
    totalDays: daySet.size,
    lastEntryDate,
    todayHasEntry,
  };
}

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Уровни достижений по сериям
export const STREAK_MILESTONES = [
  { days: 1, label: 'Первый шаг', icon: '🌙' },
  { days: 3, label: 'Наблюдатель', icon: '✨' },
  { days: 7, label: 'Неделя осознанности', icon: '🔮' },
  { days: 14, label: 'Две недели', icon: '💫' },
  { days: 30, label: 'Месяц практики', icon: '🌟' },
  { days: 90, label: 'Сезон', icon: '👑' },
  { days: 180, label: 'Полгода', icon: '🜂' },
  { days: 365, label: 'Год', icon: '🜄' },
];

export function getNextMilestone(currentStreak: number) {
  return STREAK_MILESTONES.find((m) => m.days > currentStreak) || null;
}

export function getLastMilestone(currentStreak: number) {
  const reached = STREAK_MILESTONES.filter((m) => m.days <= currentStreak);
  return reached[reached.length - 1] || null;
}
