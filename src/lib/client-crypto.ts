// Client-side crypto module — Web Crypto API (PBKDF2 + AES-GCM).
// Все операции шифрования происходят в браузере. Ключ НИКОГДА не покидает клиент.
//
// Шаги:
// 1. При регистрации:
//    - generateMasterKey() → random 256-bit key
//    - derivePassKey(password, salt) → AES-GCM key из пароля (PBKDF2)
//    - encryptMasterKey(masterKey, passKey, iv) → зашифрованный master_key
//    - отправляем на сервер: { encrypted, iv, salt }
//
// 2. При логине:
//    - GET /api/user/master-key → { encrypted, iv, salt }
//    - derivePassKey(password, salt)
//    - decryptMasterKey(encrypted, iv, passKey) → masterKey
//    - sessionStorage.set('somnus_mk', ...)  (base64 raw ключа)
//
// 3. При создании записи:
//    - POST /api/analyze { plaintext } → analysis (plaintext)
//    - encryptString(content, masterKey) → { ciphertext, iv }
//    - encryptString(JSON(analysis), masterKey) → { ciphertext, iv }
//    - POST /api/entries { encrypted fields + moodScore + topEmotion }
//
// 4. При чтении:
//    - GET /api/entries → [{ encryptedContent, contentIv, ... }]
//    - decryptString(encryptedContent, contentIv, masterKey) → plaintext

const enc = new TextEncoder();
const dec = new TextDecoder();

// ===== Утилиты base64 =====
function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ===== Генерация случайных байтов =====
function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

// ===== PBKDF2 → AES-GCM ключ из пароля =====
async function derivePassKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 150_000, // рекомендация OWASP для online-сценариев
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ===== Генерация случайного master key (256-bit AES-GCM) =====
async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — нужно для экспорта в base64
    ['encrypt', 'decrypt']
  );
}

// ===== Экспорт/импорт master key в base64 (для sessionStorage) =====
async function exportMasterKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToBase64(raw);
}

async function importMasterKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBuf(base64);
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ===== Шифрование master key паролем (для хранения на сервере) =====
export interface EncryptedMasterKey {
  encrypted: string; // base64
  iv: string;        // base64
  salt: string;      // base64
}

export async function createEncryptedMasterKey(password: string): Promise<{
  encryptedMasterKey: string;
  masterKeyIv: string;
  masterKeySalt: string;
  rawMasterKey: CryptoKey;
  serializedMasterKey: string; // для sessionStorage
}> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const passKey = await derivePassKey(password, salt);
  const masterKey = await generateMasterKey();
  const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    passKey,
    masterKeyRaw
  );

  return {
    encryptedMasterKey: bufToBase64(encrypted),
    masterKeyIv: bufToBase64(iv),
    masterKeySalt: bufToBase64(salt),
    rawMasterKey: masterKey,
    serializedMasterKey: await exportMasterKey(masterKey),
  };
}

export async function unlockMasterKey(
  password: string,
  encryptedMasterKey: string,
  masterKeyIv: string,
  masterKeySalt: string
): Promise<{ key: CryptoKey; serialized: string }> {
  const salt = base64ToBuf(masterKeySalt);
  const iv = base64ToBuf(masterKeyIv);
  const encrypted = base64ToBuf(encryptedMasterKey);

  const passKey = await derivePassKey(password, salt);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      passKey,
      encrypted as BufferSource
    );
  } catch {
    throw new Error('Неверный пароль — невозможно расшифровать ключ');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    decrypted,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return {
    key,
    serialized: bufToBase64(decrypted),
  };
}

// ===== Шифрование произвольной строки =====
export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64
}

export async function encryptString(
  plaintext: string,
  masterKey: CryptoKey
): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    masterKey,
    enc.encode(plaintext)
  );
  return {
    ciphertext: bufToBase64(encrypted),
    iv: bufToBase64(iv),
  };
}

export async function decryptString(
  ciphertext: string,
  ivBase64: string,
  masterKey: CryptoKey
): Promise<string> {
  const iv = base64ToBuf(ivBase64);
  const data = base64ToBuf(ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    masterKey,
    data as BufferSource
  );
  return dec.decode(decrypted);
}

// ===== Работа с sessionStorage =====
const STORAGE_KEY = 'somnus_mk_v1';

export function storeMasterKey(serialized: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, serialized);
}

export async function loadStoredMasterKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined') return null;
  const serialized = sessionStorage.getItem(STORAGE_KEY);
  if (!serialized) return null;
  try {
    return await importMasterKey(serialized);
  } catch {
    return null;
  }
}

export function clearStoredMasterKey(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

// ===== Перешифровка master key новым паролем (для смены пароля) =====
// Принимает raw master key (base64), возвращает его же, но зашифрованный новым паролем.
export async function reEncryptMasterKey(
  masterKeyBase64: string,
  newPassword: string
): Promise<{ encryptedMasterKey: string; masterKeyIv: string; masterKeySalt: string }> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const passKey = await derivePassKey(newPassword, salt);

  const raw = base64ToBuf(masterKeyBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    passKey,
    raw as BufferSource
  );

  return {
    encryptedMasterKey: bufToBase64(encrypted),
    masterKeyIv: bufToBase64(iv),
    masterKeySalt: bufToBase64(salt),
  };
}
