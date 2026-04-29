import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

type UserRow = {
  id: string
  telegram_id: string
  plan: 'free' | 'pro'
  generations_today: number
}

type TelegramUpdate = {
  message?: {
    text?: string
    from?: {
      id: number
      username?: string
    }
    chat: {
      id: number
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
const telegramWebAppUrl = process.env.TELEGRAM_WEBAPP_URL

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

if (!telegramBotToken) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function verifySignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) {
    return false
  }

  const normalizedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader

  const expected = createHmac('sha256', telegramBotToken)
    .update(rawBody)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(normalizedSignature, 'hex')

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: Record<string, unknown>
) {
  await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...options,
    }),
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signatureHeader =
    request.headers.get('x-telegram-signature') ??
    request.headers.get('x-signature')

  if (!verifySignature(rawBody, signatureHeader)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = JSON.parse(rawBody) as TelegramUpdate
  const message = update.message

  if (!message?.text || !message.from) {
    return Response.json({ ok: true })
  }

  const command = message.text.trim().split(' ')[0]
  const telegramId = String(message.from.id)

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle<UserRow>()

  if (!user) {
    await supabase.from('users').insert({
      telegram_id: telegramId,
      username: message.from.username ?? null,
      plan: 'free',
      generations_today: 0,
      last_reset: new Date().toISOString().slice(0, 10),
    })
  }

  if (command === '/start') {
    const welcome =
      'Привет! Я Slato. Помогу генерировать карусели для Instagram и тексты для Reels, Telegram и Threads.'

    await sendTelegramMessage(message.chat.id, welcome, {
      reply_markup: telegramWebAppUrl
        ? {
            inline_keyboard: [
              [{ text: 'Открыть редактор', web_app: { url: telegramWebAppUrl } }],
            ],
          }
        : undefined,
    })

    return Response.json({ ok: true })
  }

  if (command === '/status') {
    const plan = user?.plan ?? 'free'
    const used = user?.generations_today ?? 0
    const left = plan === 'free' ? Math.max(0, 3 - used) : 'безлимит'

    await sendTelegramMessage(
      message.chat.id,
      `Текущий план: ${plan}\nОсталось генераций сегодня: ${left}`
    )

    return Response.json({ ok: true })
  }

  if (command === '/upgrade') {
    await sendTelegramMessage(
      message.chat.id,
      'Pro версия: безлимитные генерации, приоритетная скорость и расширенные шаблоны контента.'
    )
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}
