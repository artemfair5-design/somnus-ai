// OpenRouter AI client — server-side only.
// Использует OpenRouter API (https://openrouter.ai/api/v1) для LLM.
// Поддерживает несколько моделей: DeepSeek, Llama, Qwen.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
const OPENROUTER_SITE_URL = process.env.NEXTAUTH_URL || 'https://somnus-ai2.vercel.app';
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME || 'Somnus AI';

if (!OPENROUTER_API_KEY) {
  console.warn('⚠️ OPENROUTER_API_KEY is not set in environment variables');
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
- moodScore: 0 (тяжёлая тревога) .. 100 (спокойствие, принятие)

ВАЖНО: ответ должен быть ТОЛЬКО валидным JSON, без markdown, без \`\`\`json блоков.`;

// =====================================================
// Транскрипция аудио через OpenRouter (мультимодальная модель)
// =====================================================
export async function transcribeAudio(audioBase64: string, mimeType = 'audio/webm'): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY не настроен на сервере');
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_SITE_URL,
        'X-Title': OPENROUTER_SITE_NAME,
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Транскрибируй это аудио дословно на русском языке. Верни только текст без комментариев.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter ASR HTTP error:', response.status, errText);
      throw new Error(`ASR HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json() as any;
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      throw new Error('ASR вернул пустой ответ');
    }
    return text;
  } catch (err: any) {
    console.error('OpenRouter ASR error:', err?.message || err);
    throw new Error(`Не удалось транскрибировать аудио: ${err?.message || 'unknown error'}`);
  }
}

// =====================================================
// Анализ сна через OpenRouter LLM (DeepSeek по умолчанию)
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
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY не настроен на сервере');
  }

  const userPrompt = entryType === 'dream'
    ? `Проанализируй сон:\n\n${dreamText}${dayEvents ? `\n\nСобытия дня: ${dayEvents}` : ''}`
    : `Проанализируй тревожное состояние:\n\n${dreamText}${dayEvents ? `\n\nКонтекст дня: ${dayEvents}` : ''}`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_SITE_URL,
        'X-Title': OPENROUTER_SITE_NAME,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: DREAM_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter LLM HTTP error:', response.status, errText);
      throw new Error(`LLM HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json() as any;
    const raw = (data.choices?.[0]?.message?.content || '').trim();

    if (!raw) {
      console.error('OpenRouter LLM empty response:', JSON.stringify(data).substring(0, 500));
      throw new Error('AI вернул пустой ответ');
    }

    // Извлекаем JSON (модели иногда оборачивают в markdown)
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      console.error('OpenRouter LLM no JSON in response:', raw.substring(0, 500));
      throw new Error('AI не вернул валидный JSON');
    }

    const parsed = JSON.parse(jsonStr) as DreamAnalysis;

    if (!parsed.summary || typeof parsed.moodScore !== 'number') {
      console.error('OpenRouter LLM incomplete response:', JSON.stringify(parsed).substring(0, 500));
      throw new Error('Неполный ответ AI');
    }

    return parsed;
  } catch (err: any) {
    console.error('OpenRouter analysis error:', err?.message || err);
    throw new Error(`Не удалось проанализировать запись: ${err?.message || 'unknown error'}`);
  }
}