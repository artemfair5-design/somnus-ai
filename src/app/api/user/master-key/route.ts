// GET /api/user/master-key — возвращает зашифрованный master key текущего пользователя
// (для расшифровки паролем на клиенте при логине).
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      encryptedMasterKey: true,
      masterKeyIv: true,
      masterKeySalt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  return NextResponse.json({
    encryptedMasterKey: user.encryptedMasterKey,
    masterKeyIv: user.masterKeyIv,
    masterKeySalt: user.masterKeySalt,
  });
}
