import { createClient } from '@supabase/supabase-js'

type UserRow = {
  id: string
  telegram_id: string
  username: string | null
  plan: 'free' | 'pro'
  generations_today: number
  last_reset: string | null
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const geminiApiKey = process.env.GEMINI_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

if (!geminiApiKey) {
  throw new Error('Missing GEMINI_API_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

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

    const prompt = `
Ты помощник для Slato — редактора Instagram-каруселей.
Верни ТОЛЬКО валидный JSON без markdown и комментариев.
Тема: "${topic}".

Структура JSON:
{
  "carousel": [
    { "h": "краткий заголовок слайда 1", "p": "текст слайда 1", "tag": "короткий тег" },
    { "h": "краткий заголовок слайда 2", "p": "текст слайда 2", "tag": "короткий тег" },
    { "h": "краткий заголовок слайда 3", "p": "текст слайда 3", "tag": "короткий тег" },
    { "h": "краткий заголовок слайда 4", "p": "текст слайда 4", "tag": "короткий тег" },
    { "h": "краткий заголовок слайда 5", "p": "текст слайда 5", "tag": "короткий тег" }
  ],
  "reels": "короткий сценарий для Reels по теме",
  "telegram": "короткий пост для Telegram по теме",
  "threads": "короткий пост для Threads по теме"
}
`

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
