// NextAuth config — Credentials provider (email + password)
// v0.2: при регистрации клиент дополнительно отправляет encrypted master key
// (PBKDF2 + AES-GCM), который мы сохраняем в БД. Это позволяет реализовать
// zero-knowledge архитектуру: сервер не может расшифровать записи пользователя.

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

interface RegisterFields {
  encryptedMasterKey?: string;
  masterKeyIv?: string;
  masterKeySalt?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
        name: { label: 'Имя', type: 'text' },
        mode: { label: 'Режим', type: 'text' }, // "login" | "register"
        // Поля только для регистрации:
        encryptedMasterKey: { label: 'EMK', type: 'text' },
        masterKeyIv: { label: 'EMK_IV', type: 'text' },
        masterKeySalt: { label: 'EMK_SALT', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email и пароль обязательны');
        }

        const mode = credentials.mode || 'login';

        // === Регистрация ===
        if (mode === 'register') {
          const existing = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
          });
          if (existing) {
            throw new Error('Пользователь с таким email уже существует');
          }

          const enc = credentials as RegisterFields & typeof credentials;
          if (!enc.encryptedMasterKey || !enc.masterKeyIv || !enc.masterKeySalt) {
            throw new Error('Отсутствуют данные шифрования');
          }

          const hashed = await bcrypt.hash(credentials.password, 10);
          const user = await db.user.create({
            data: {
              email: credentials.email.toLowerCase(),
              password: hashed,
              name: credentials.name || null,
              encryptedMasterKey: enc.encryptedMasterKey,
              masterKeyIv: enc.masterKeyIv,
              masterKeySalt: enc.masterKeySalt,
            },
          });
          return { id: user.id, email: user.email, name: user.name };
        }

        // === Логин ===
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) {
          throw new Error('Неверный email или пароль');
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          throw new Error('Неверный email или пароль');
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'somnus-dev-secret-change-in-prod',
};
