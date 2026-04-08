import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JOBS_LIST, parseMatchResults } from '@/lib/constants'

export const metadata = {
  title: '分析 | FF14 PVP クリスタルコンフリクト',
  description: 'MAPごとの勝率分析',
}

type SearchParams = { from?: string; to?: string }
const MAP_DISPLAY_ORDER = [
  'パライストラ',
  'ヴォルカニックハート',
  'クラウドナイン',
  '東方絡繰御殿',
  'レッドサンズ',
  'ベイサイドバトルグラウンド',
] as const
const PATCH_RANGES = [
  { label: '全期間', from: '', to: '' },
  { label: 'Patch 7.45', from: '2026-03-03', to: '' },
] as const

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
  const opponentJobStats: Record<string, number> = {}
  for (const r of reviews ?? []) {
    const matches = parseMatchResults(r.matches)
    for (const m of matches) {
      const mapName = m.map?.trim()
      if (!mapName) continue
      if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, total: 0 }
      mapStats[mapName].total += 1
      if (m.result === '勝ち') mapStats[mapName].wins += 1

      for (const job of m.opponent_jobs) {
        const jobName = job.trim()
        if (!jobName) continue
        opponentJobStats[jobName] = (opponentJobStats[jobName] ?? 0) + 1
      }
    }
  }

  const mapOrderIndex = new Map<string, number>(MAP_DISPLAY_ORDER.map((map, index) => [map, index]))
  const sortedMaps = Object.entries(mapStats).sort((a, b) => {
    const aIndex = mapOrderIndex.get(a[0])
    const bIndex = mapOrderIndex.get(b[0])
    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex
    if (aIndex !== undefined) return -1
    if (bIndex !== undefined) return 1
    return a[0].localeCompare(b[0], 'ja')
  })
  const sortedOpponentJobs = Object.entries(opponentJobStats)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
  const totalOpponentJobs = sortedOpponentJobs.reduce((sum, [, count]) => sum + count, 0)
  const maxOpponentJobCount = sortedOpponentJobs[0]?.[1] ?? 0
  const missingJobs = JOBS_LIST.filter((job) => !(job in opponentJobStats))

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
          <div className="w-full border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">パッチ期間で絞り込み</p>
            <div className="flex flex-wrap gap-2">
              {PATCH_RANGES.map((range) => {
                const isActive = (from ?? '') === range.from && (to ?? '') === range.to
                const href =
                  range.from || range.to
                    ? `/analysis?${new URLSearchParams(
                        Object.fromEntries(
                          [
                            ['from', range.from],
                            ['to', range.to],
                          ].filter(([, value]) => value)
                        )
                      ).toString()}`
                    : '/analysis'
                return (
                  <Link
                    key={range.label}
                    href={href}
                    className={
                      isActive
                        ? 'rounded-lg border border-blue-500 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200'
                        : 'rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }
                  >
                    {range.label}
                  </Link>
                )
              })}
            </div>
            {(from ?? '') === '2026-03-03' && (to ?? '') === '' ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                7.45: 2026/03/03〜現在
              </p>
            ) : null}
          </div>
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

        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
            相手ジョブ使用率（件数）
          </h2>
          {sortedOpponentJobs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              該当期間に相手ジョブデータがありません。
            </p>
          ) : (
            <div className="space-y-3 px-4 py-4">
              {sortedOpponentJobs.map(([job, count]) => {
                const ratio = totalOpponentJobs > 0 ? (count / totalOpponentJobs) * 100 : 0
                const barWidth = maxOpponentJobCount > 0 ? (count / maxOpponentJobCount) * 100 : 0
                return (
                  <div key={job}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{job}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {count}件 ({ratio.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-3 rounded-full bg-blue-500 dark:bg-blue-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                集計対象の相手ジョブ総数: {totalOpponentJobs}件
              </p>
              {missingJobs.length > 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  期間内で未出現のジョブ: {missingJobs.join(' / ')}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
