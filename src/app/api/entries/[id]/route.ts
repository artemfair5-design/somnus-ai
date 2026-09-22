// PATCH /api/entries/[id] — отредактировать запись (re-encrypt на клиенте)
// DELETE /api/entries/[id] — удалить одну запись
// DELETE /api/entries?id=all — удалить все записи пользователя
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

interface PatchBody {
  encryptedContent?: string;
  contentIv?: string;
  encryptedDayEvents?: string | null;
  dayEventsIv?: string | null;
  encryptedAnalysis?: string;
  analysisIv?: string;
  moodScore?: number;
  topEmotion?: string | null;
  entryType?: 'dream' | 'anxiety';
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const { id } = await params;

  // Проверка владельца
  const existing = await db.dreamEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as PatchBody;

    // Собираем только переданные поля
    const updateData: any = { editedAt: new Date() };
    if (body.encryptedContent && body.contentIv) {
      updateData.encryptedContent = body.encryptedContent;
      updateData.contentIv = body.contentIv;
    }
    if (body.encryptedDayEvents !== undefined) {
      updateData.encryptedDayEvents = body.encryptedDayEvents;
      updateData.dayEventsIv = body.dayEventsIv;
    }
    if (body.encryptedAnalysis && body.analysisIv) {
      updateData.encryptedAnalysis = body.encryptedAnalysis;
      updateData.analysisIv = body.analysisIv;
    }
    if (typeof body.moodScore === 'number') {
      updateData.moodScore = body.moodScore;
    }
    if (body.topEmotion !== undefined) {
      updateData.topEmotion = body.topEmotion;
    }
    if (body.entryType) {
      updateData.entryType = body.entryType;
    }

    const updated = await db.dreamEntry.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        createdAt: true,
        editedAt: true,
        entryType: true,
        inputMethod: true,
        moodScore: true,
        topEmotion: true,
      },
    });

    return NextResponse.json({ entry: updated });
  } catch (err: any) {
    console.error('PATCH entry error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Не удалось обновить запись' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const { id } = await params;

  // Спец-режим: удалить всё
  if (id === 'all' || id === 'wipe') {
    const result = await db.dreamEntry.deleteMany({ where: { userId } });
    return NextResponse.json({ deleted: result.count });
  }

  // Обычный режим: удалить одну запись (с проверкой владельца)
  const existing = await db.dreamEntry.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  }
  if (existing.userId !== userId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  await db.dreamEntry.delete({ where: { id } });
  return NextResponse.json({ deleted: 1 });
}
