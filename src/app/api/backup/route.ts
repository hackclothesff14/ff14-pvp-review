import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * reviews テーブルを全件 JSON でエクスポートするバックアップ用 API。
 * 環境変数 BACKUP_SECRET が設定されている場合は ?secret=xxx が一致するときのみ応答する。
 */
export async function GET(request: NextRequest) {
  const secret = process.env.BACKUP_SECRET
  if (secret) {
    const given = request.nextUrl.searchParams.get('secret')
    if (given !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    table: 'reviews',
    count: data?.length ?? 0,
    rows: data ?? [],
  }

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="stella-note-backup-${payload.exportedAt.slice(0, 10)}.json"`,
    },
  })
}
