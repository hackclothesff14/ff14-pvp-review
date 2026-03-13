import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('opponent')
    .order('opponent')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 同じ相手と複数回対戦していても、名前は1つだけにする（Set で重複除去）
  const names = [...new Set((data ?? []).map((r) => r.opponent?.trim()).filter(Boolean))].sort()
  return NextResponse.json(names)
}
