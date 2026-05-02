'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { parseMatchResults } from '@/lib/constants'
import type { Review } from '@/lib/types'
import ReviewListWithFilter from './ReviewListWithFilter'

type Tab = 'scrim' | 'tournament'

type Props = {
  scrimReviews: Review[]
  tournamentReviews: Review[]
}

export default function TopPageWithTabs({ scrimReviews, tournamentReviews }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scrim')
  const [opponentFilter, setOpponentFilter] = useState('')

  const filteredScrimReviews = useMemo(() => {
    const q = opponentFilter.trim().toLowerCase()
    if (!q) return scrimReviews
    return scrimReviews.filter((r) => r.opponent?.toLowerCase().includes(q))
  }, [scrimReviews, opponentFilter])

  const newEntryHref = activeTab === 'tournament' ? '/reviews/new?type=tournament' : '/reviews/new'

  return (
    <>
      {/* 分析・フィルタ・新規追加を1行に（タブの上） */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/analysis"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            分析
          </Link>
          <Link
            href="/tactics"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            戦術
          </Link>
          <Link
            href="/knowledge"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            知識
          </Link>
          {activeTab === 'scrim' && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="opponent-filter"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
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
          )}
        </div>
        <Link
          href={newEntryHref}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          新規追加
        </Link>
      </div>

      {/* タブ: スクリム | 大会 */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('scrim')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === 'scrim'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          スクリム
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tournament')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === 'tournament'
              ? 'bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          大会
        </button>
      </div>

      {activeTab === 'scrim' && <ReviewListWithFilter reviews={filteredScrimReviews} hideToolbar />}
      {activeTab === 'tournament' && <TournamentList reviews={tournamentReviews} />}
    </>
  )
}

function TournamentList({ reviews }: { reviews: Review[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white/85 dark:border-zinc-700 dark:bg-zinc-900/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-800/85">
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">日付</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">大会名</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">試合結果</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">大会結果</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => {
              const matches = parseMatchResults(r.matches)
              const winCount = matches.filter((m) => m.result === '勝ち').length
              const matchResultText = matches.length === 0 ? '—' : `${winCount}/${matches.length}`
              const tournamentResultText = (r.result_summary ?? '').trim() || '—'
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
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{tournamentResultText}</td>
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
      {reviews.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          まだ大会の記録がありません。「新規追加」から1件登録してください。
        </p>
      )}
    </div>
  )
}
