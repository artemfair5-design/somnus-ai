// GET  /api/entries  — список зашифрованных записей пользователя
// POST /api/entries  — сохранить уже зашифрованную запись (plaintext НЕ передаётся)
//
// Архитектура zero-knowledge:
// - plaintext (сон, тревога, AI-анализ) шифруется на клиенте master key
// - сервер хранит только зашифрованные данные + метаданные (moodScore, topEmotion)
// - сервер не может прочитать содержимое записей
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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const cursor = url.searchParams.get('cursor');

  const entries = await db.dreamEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      createdAt: true,
      entryType: true,
      inputMethod: true,
      moodScore: true,
      topEmotion: true,
      // Зашифрованные поля — клиент расшифрует сам
      encryptedContent: true,
      contentIv: true,
      encryptedDayEvents: true,
      dayEventsIv: true,
      encryptedAnalysis: true,
      analysisIv: true,
    },
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, -1) : entries;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

interface CreateEntryBody {
  encryptedContent: string;
  contentIv: string;
  encryptedDayEvents?: string;
  dayEventsIv?: string;
  encryptedAnalysis?: string;
  analysisIv?: string;
  entryType?: 'dream' | 'anxiety';
  inputMethod?: 'text' | 'voice';
  moodScore?: number;
  topEmotion?: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    const body = (await req.json()) as CreateEntryBody;

    // Валидация: должны быть зашифрованные данные
    if (!body.encryptedContent || !body.contentIv) {
      return NextResponse.json(
        { error: 'Отсутствуют зашифрованные данные' },
        { status: 400 }
      );
    }

    if (typeof body.moodScore !== 'number' || body.moodScore < 0 || body.moodScore > 100) {
      return NextResponse.json(
        { error: 'Некорректный moodScore' },
        { status: 400 }
      );
    }

    const entry = await db.dreamEntry.create({
      data: {
        userId,
        encryptedContent: body.encryptedContent,
        contentIv: body.contentIv,
        encryptedDayEvents: body.encryptedDayEvents || null,
        dayEventsIv: body.dayEventsIv || null,
        encryptedAnalysis: body.encryptedAnalysis || null,
        analysisIv: body.analysisIv || null,
        entryType: body.entryType || 'dream',
        inputMethod: body.inputMethod || 'text',
        moodScore: body.moodScore,
        topEmotion: body.topEmotion || null,
      },
      select: {
        id: true,
        createdAt: true,
        entryType: true,
        inputMethod: true,
        moodScore: true,
        topEmotion: true,
      },
    });

    return NextResponse.json({ entry });
  } catch (err: any) {
    console.error('Create entry error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Не удалось сохранить запись' },
      { status: 500 }
    );
  }
}
