// POST /api/transcribe — транскрипция голосового сообщения через Z.ai ASR
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { transcribeAudio } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { audio, mimeType } = body as { audio?: string; mimeType?: string };

    if (!audio) {
      return NextResponse.json({ error: 'Аудиоданные не переданы' }, { status: 400 });
    }

    const text = await transcribeAudio(audio, mimeType || 'audio/webm');
    return NextResponse.json({ text });
  } catch (err: any) {
    console.error('Transcribe error:', err);
    return NextResponse.json(
      { error: err?.message || 'Не удалось транскрибировать аудио' },
      { status: 500 }
    );
  }
}
