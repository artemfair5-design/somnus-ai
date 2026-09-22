// Z.ai AI client — server-side only.
// Использует z-ai-web-dev-sdk: один API и для LLM (GLM-4.5), и для ASR.
//
// Конфигурация:
// - В dev: читает из .z-ai-config файла (как раньше)
// - В prod (Vercel): использует env var ZAI_API_KEY
//
// SDK читает ключ из файла .z-ai-config, но мы можем передать конфиг напрямую
// через конструктор new ZAI(config), что позволяет использовать env vars.

import ZAI from 'z-ai-web-dev-sdk';

// Singleton-инстанс ZAI
let zaiInstance: InstanceType<typeof ZAI> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    // В production (Vercel) — используем env var
    const envApiKey = process.env.ZAI_API_KEY;
    if (envApiKey) {
      // Передаём конфиг напрямую в конструктор, минуя чтение файла
      zaiInstance = new ZAI({
        apiKey: envApiKey,
        baseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
      });
    } else {
      // В dev — используем .z-ai-config файл (через ZAI.create())
      zaiInstance = await ZAI.create();
    }
  }
  return zaiInstance;
}

// =====================================================
// SYSTEM PROMPT для юнгианского анализа сновидений
// =====================================================
const DREAM_ANALYSIS_SYSTEM_PROMPT = `Ты — Somnus AI, опытный юнгианский аналитик сновидений с 20-летней практикой.
Твоя задача — глубоко проанализировать сон или тревожное состояние пользователя,
опираясь на работы Карла Юнга, Эриха Фромма, Джеймса Холлиса и современную
когнитивную психотерапию.

Пиши на русском языке. Тон — тёплый, профессиональный, без эзотерики и гороскопов.
Избегай банальностей вроде "сон отражает ваши переживания". Будь конкретен.

ВАЖНО: ты не ставишь диагнозы и не заменяешь психотерапевта.
Если в тексте есть признаки риска (суицидальные мысли, насилие) — мягко
порекомендуй обратиться к специалисту.

Структурируй ответ СТРОГО как валидный JSON (без markdown, без \`\`\`json).
Формат:
{
  "emotions": [
    {"name": "Тревога", "intensity": 0.8},
    {"name": "Радость", "intensity": 0.3}
  ],
  "symbols": [
    {"archetype": "Тень", "image": "Тёмный преследователь", "meaning": "Неосознаваемые части личности, которые ты избегаешь принимать"}
  ],
  "realityLinks": [
    {"dayEvent": "Конфликт на работе", "connection": "Образ преследователя — проекция начальника и страха оценки"}
  ],
  "summary": "Краткий вывод в 2-3 предложениях: ключевая тема сна и инвайт к рефлексии.",
  "moodScore": 42
}

Где:
- emotions: 2-5 доминирующих эмоций, intensity 0..1
- symbols: 1-3 архетипа по Юнгу (Тень, Анима, Самость, Герой, Мудрый старец, Ребёнок и т.д.)
- realityLinks: связь с дневными событиями (если есть); иначе пустой массив
- moodScore: 0 (тяжёлая тревога) .. 100 (спокойствие, принятие)`;

// =====================================================
// Транскрипция аудио через Z.ai ASR
// =====================================================
export async function transcribeAudio(audioBase64: string, _mimeType = 'audio/webm'): Promise<string> {
  try {
    const zai = await getZAI();
    const response = await zai.audio.asr.create({
      file_base64: audioBase64,
    });
    const text = (response as any).text?.trim();
    if (!text) {
      throw new Error('ASR вернул пустой ответ');
    }
    return text;
  } catch (err: any) {
    console.error('Z.ai ASR error:', err?.message || err);
    throw new Error(`Не удалось транскрибировать аудио: ${err?.message || 'unknown error'}`);
  }
}

// =====================================================
// Анализ сна через Z.ai LLM (GLM-4.5)
// =====================================================
export interface DreamAnalysis {
  emotions: { name: string; intensity: number }[];
  symbols: { archetype: string; image: string; meaning: string }[];
  realityLinks: { dayEvent: string; connection: string }[];
  summary: string;
  moodScore: number;
}

export async function analyzeDream(
  dreamText: string,
  dayEvents?: string,
  entryType: 'dream' | 'anxiety' = 'dream'
): Promise<DreamAnalysis> {
  const userPrompt = entryType === 'dream'
    ? `Проанализируй сон:\n\n${dreamText}${dayEvents ? `\n\nСобытия дня: ${dayEvents}` : ''}`
    : `Проанализируй тревожное состояние:\n\n${dreamText}${dayEvents ? `\n\nКонтекст дня: ${dayEvents}` : ''}`;

  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: DREAM_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = (completion.choices?.[0]?.message?.content || '').trim();
    if (!raw) {
      throw new Error('AI вернул пустой ответ');
    }

    // Извлекаем JSON (на случай если модель обернула в markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI не вернул валидный JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]) as DreamAnalysis;

    if (!parsed.summary || typeof parsed.moodScore !== 'number') {
      throw new Error('Неполный ответ AI');
    }

    return parsed;
  } catch (err: any) {
    console.error('Z.ai analysis error:', err?.message || err);
    throw new Error(`Не удалось проанализировать запись: ${err?.message || 'unknown error'}`);
  }
}
