import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseMatchResults } from '@/lib/constants'

export const metadata = {
  title: '分析 | FF14 PVP クリスタルコンフリクト',
  description: 'MAPごとの勝率分析',
}

type SearchParams = { from?: string; to?: string }

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { from, to } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('reviews').select('id, review_date, matches').order('review_date', { ascending: false })
  if (from?.trim()) query = query.gte('review_date', from.trim())
  if (to?.trim()) query = query.lte('review_date', to.trim())

  const { data: reviews, error } = await query

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl">
          <p className="text-red-600 dark:text-red-400">読み込みに失敗しました: {error.message}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← 一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  const mapStats: Record<string, { wins: number; total: number }> = {}
  for (const r of reviews ?? []) {
    const matches = parseMatchResults(r.matches)
    for (const m of matches) {
      const mapName = m.map?.trim()
      if (!mapName) continue
      if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, total: 0 }
      mapStats[mapName].total += 1
      if (m.result === '勝ち') mapStats[mapName].wins += 1
    }
  }

  const sortedMaps = Object.entries(mapStats).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            ← 一覧に戻る
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">分析</h1>
        </div>

        <form method="get" action="/analysis" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              開始日
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              終了日
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            絞り込み
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            MAPごとの勝率
          </h2>
          {sortedMaps.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              該当期間に試合データがありません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">マップ</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">試合数</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">勝ち</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">勝率</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMaps.map(([mapName, { wins, total }]) => (
                    <tr
                      key={mapName}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{mapName}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{total}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{wins}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {total > 0 ? `${((wins / total) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
