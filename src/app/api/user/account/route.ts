// DELETE /api/user/account — удалить аккаунт пользователя со всеми записями
// GET /api/user/account — получить профиль (email, name, createdAt, totalEntries)
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
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    totalEntries: user._count.entries,
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  // Каскадное удаление настроено в schema.prisma (onDelete: Cascade)
  // поэтому удалятся и все записи пользователя
  await db.user.delete({ where: { id: userId } });

  return NextResponse.json({ deleted: true });
}
