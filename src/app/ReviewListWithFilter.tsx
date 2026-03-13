'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { parseMatchResults } from '@/lib/constants'
import type { Review } from '@/lib/types'

type Props = { reviews: Review[] }

export default function ReviewListWithFilter({ reviews }: Props) {
  const [opponentFilter, setOpponentFilter] = useState('')

  const filteredReviews = useMemo(() => {
    const q = opponentFilter.trim().toLowerCase()
    if (!q) return reviews
    return reviews.filter((r) => r.opponent?.toLowerCase().includes(q))
  }, [reviews, opponentFilter])

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/analysis"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          分析
        </Link>
        <div className="flex items-center gap-2">
          <label htmlFor="opponent-filter" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            対戦相手でフィルタ
          </label>
          <input
            id="opponent-filter"
            type="text"
            value={opponentFilter}
            onChange={(e) => setOpponentFilter(e.target.value)}
            placeholder="対戦相手名の一部を入力"
            className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-800/85">
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">日付</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">対戦相手</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">試合結果</th>
                <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((r) => {
                const matches = parseMatchResults(r.matches)
                const winCount = matches.filter((m) => m.result === '勝ち').length
                const matchResultText = matches.length === 0 ? '—' : `${winCount}/${matches.length}`
                return (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {r.review_date}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.opponent}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{matchResultText}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reviews/${r.id}/edit`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        編集
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredReviews.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {opponentFilter.trim() ? '該当する記録がありません。' : 'まだ記録がありません。'}
          </p>
        )}
      </div>
    </>
  )
}
