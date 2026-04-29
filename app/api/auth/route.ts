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

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      telegramId?: string
      username?: string
    }

    const telegramId = body.telegramId?.trim()
    const username = body.username?.trim() || null

    if (!telegramId) {
      return Response.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle<UserRow>()

    if (selectError) {
      return Response.json({ error: selectError.message }, { status: 500 })
    }

    if (existingUser) {
      return Response.json({ user: existingUser })
    }

    const { data: createdUser, error: insertError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        username,
        plan: 'free',
        generations_today: 0,
        last_reset: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single<UserRow>()

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    return Response.json({ user: createdUser })
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
