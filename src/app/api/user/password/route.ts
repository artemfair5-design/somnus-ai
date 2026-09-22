// POST /api/user/password — сменить пароль (перешифровать master key).
// Принимает { currentPassword, newPassword, newEncryptedMasterKey, newMasterKeyIv, newMasterKeySalt }
// где newEncryptedMasterKey — это master key, зашифрованный новым паролем на клиенте.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  newEncryptedMasterKey: string;
  newMasterKeyIv: string;
  newMasterKeySalt: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Неавторизован' }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    const body = (await req.json()) as ChangePasswordBody;

    if (!body.currentPassword || !body.newPassword || body.newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Новый пароль должен быть минимум 6 символов' },
        { status: 400 }
      );
    }

    if (!body.newEncryptedMasterKey || !body.newMasterKeyIv || !body.newMasterKeySalt) {
      return NextResponse.json(
        { error: 'Отсутствуют данные шифрования для нового пароля' },
        { status: 400 }
      );
    }

    // Проверяем текущий пароль
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const valid = await bcrypt.compare(body.currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 403 });
    }

    // Хэшируем новый пароль + сохраняем новый зашифрованный master key
    const newHash = await bcrypt.hash(body.newPassword, 10);
    await db.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        encryptedMasterKey: body.newEncryptedMasterKey,
        masterKeyIv: body.newMasterKeyIv,
        masterKeySalt: body.newMasterKeySalt,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Change password error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Не удалось сменить пароль' },
      { status: 500 }
    );
  }
}
