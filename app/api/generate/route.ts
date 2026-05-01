import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

type UserRow = {
  id: string
  telegram_id: string
  username: string | null
  plan: 'free' | 'pro'
  generations_today: number
  last_reset: string | null
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function dateKeyToday() {
  return new Date().toISOString().slice(0, 10)
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
  const candidate = fenced?.[1] ?? trimmed
  return JSON.parse(candidate)
}

export async function POST(request: Request) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY ?? ''
    if (!geminiApiKey) {
      return Response.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 })
    }

    const body = (await request.json()) as {
      topic?: string
      telegramId?: string
    }

    const topic = body.topic?.trim()
    const telegramId = body.telegramId?.trim()

    if (!topic || !telegramId) {
      return Response.json(
        { error: 'topic and telegramId are required' },
        { status: 400 }
      )
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle<UserRow>()

    if (userError) {
      return Response.json({ error: userError.message }, { status: 500 })
    }

    if (!user) {
      return Response.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const today = dateKeyToday()
    let generationsToday = user.generations_today ?? 0

    if (user.last_reset !== today) {
      generationsToday = 0
      const { error: resetError } = await supabase
        .from('users')
        .update({ generations_today: 0, last_reset: today })
        .eq('id', user.id)

      if (resetError) {
        return Response.json({ error: resetError.message }, { status: 500 })
      }
    }

    if (user.plan === 'free' && generationsToday >= 3) {
      return Response.json(
        { error: 'Лимит исчерпан. Перейди на Pro' },
        { status: 429 }
      )
    }

    const prompt = `Ты эксперт по вирусному контенту для Instagram. Тема: "${topic}".

Создай карусель из 5 слайдов по этой структуре:
- Слайд 1 (ХУКОВЫЙ): Цепляющий заголовок-провокация или вопрос который останавливает скролл. Короткий текст — интрига, обещание пользы.
- Слайд 2 (ПРОБЛЕМА): Описываем боль аудитории. Конкретно, без воды. Читатель должен узнать себя.
- Слайды 3-4 (ПОЛЬЗА): Конкретные советы, цифры, факты. Каждый пункт — отдельная ценность. Никакой воды.
- Слайд 5 (CTA): Призыв сохранить, поделиться или написать в комментариях. Конкретный вопрос к аудитории.

Требования к текстам:
- Заголовок: максимум 8 слов, цепляет с первого взгляда
- Текст: 2-3 предложения, конкретика и цифры
- Стиль: разговорный, живой, без канцелярита
- Язык: русский

Верни ТОЛЬКО JSON без markdown.

Дополнительно сгенерируй короткие тексты для Reels, Telegram и Threads по той же теме.

Строго такой формат (ровно 5 объектов в carousel, поля h, p, tag — tag кратко отражает тип слайда: ХУК, ПРОБЛЕМА, ПОЛЬЗА, CTA и т.п.):
{
  "carousel": [
    { "h": "", "p": "", "tag": "" },
    { "h": "", "p": "", "tag": "" },
    { "h": "", "p": "", "tag": "" },
    { "h": "", "p": "", "tag": "" },
    { "h": "", "p": "", "tag": "" }
  ],
  "reels": "",
  "telegram": "",
  "threads": ""
}`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      return Response.json(
        { error: `Gemini error: ${errorText}` },
        { status: geminiResponse.status }
      )
    }

    const geminiJson = (await geminiResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const generatedText =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    if (!generatedText) {
      return Response.json(
        { error: 'Gemini вернул пустой ответ' },
        { status: 502 }
      )
    }

    const payload = extractJson(generatedText)

    const { error: updateError } = await supabase
      .from('users')
      .update({
        generations_today: generationsToday + 1,
        last_reset: today,
      })
      .eq('id', user.id)

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json(payload)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Не удалось обработать запрос'
    return Response.json({ error: message }, { status: 500 })
  }
}
