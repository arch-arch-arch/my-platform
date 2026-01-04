import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tier = searchParams.get('tier')
  const n = searchParams.get('n')
  const weekId = searchParams.get('week') || 'week-1'

  if (!tier || !n) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Chemin avec la semaine
  const path = `${weekId}/${tier}/${n}.jpg`

  const { data, error } = await supabaseAdmin.storage
    .from('media-private')
    .createSignedUrl(path, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}