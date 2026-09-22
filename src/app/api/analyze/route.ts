// POST /api/analyze — принимает расшифрованный текст, возвращает AI-анализ.
// ВАЖНО: сервер НЕ сохраняет plaintext. Только пересылает в Z.ai и возвращает результат.
// Логи запросов отключены, чтобы не оставлять следов plaintext в dev.log.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeDream } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content, dayEvents, entryType } = body as {
      content?: string;
      dayEvents?: string;
      entryType?: 'dream' | 'anxiety';
    };

    if (!content || content.trim().length < 10) {
      return NextResponse.json(
        { error: 'Запись слишком короткая (минимум 10 символов)' },
        { status: 400 }
      );
    }

    // AI-анализ. Plaintext НЕ логируется и НЕ сохраняется.
    const analysis = await analyzeDream(
      content,
      dayEvents,
      entryType || 'dream'
    );

    return NextResponse.json({ analysis });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Не удалось проанализировать запись' },
      { status: 500 }
    );
  }
}
