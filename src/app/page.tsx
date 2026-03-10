import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseMatchResults } from '@/lib/constants'

export const metadata = {
  title: 'FF14 PVP クリスタルコンフリクト',
  description: 'クリスタルコンフリクトの記録一覧',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .order('review_date', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
        <p className="text-red-600 dark:text-red-400">読み込みに失敗しました: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            FF14 PVP クリスタルコンフリクト
          </h1>
          <Link
            href="/reviews/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            新規追加
          </Link>
        </div>

        {!reviews?.length ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            まだ記録がありません。「新規追加」から1件登録してください。
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">日付</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">対戦相手</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">試合結果</th>
                    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
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
          </div>
        )}
      </div>
    </div>
  )
}
