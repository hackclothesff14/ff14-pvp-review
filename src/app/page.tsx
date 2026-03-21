import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopPageWithTabs from './TopPageWithTabs'

export const metadata = {
  title: 'Stella Note',
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
      <div className="relative min-h-screen px-4 py-8">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/top-bg.jpg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-zinc-50/75 dark:bg-zinc-950/80" aria-hidden />
        <div className="relative z-10">
          <p className="text-red-600 dark:text-red-400">読み込みに失敗しました: {error.message}</p>
        </div>
      </div>
    )
  }

  const scrimReviews = (reviews ?? []).filter((r) => (r as { record_type?: string }).record_type !== 'tournament')
  const tournamentReviews = (reviews ?? []).filter((r) => (r as { record_type?: string }).record_type === 'tournament')

  return (
    <div className="relative min-h-screen px-4 py-8">
      {/* 背景画像（主張しすぎないよう薄く） */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/top-bg.jpg')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-zinc-50/75 dark:bg-zinc-950/80" aria-hidden />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="font-title text-3xl font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
            Stella Note
          </h1>
        </div>

        {!reviews?.length ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/analysis"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                分析
              </Link>
              <Link
                href="/reviews/new"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                新規追加
              </Link>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              まだ記録がありません。「新規追加」から1件登録してください。
            </div>
          </>
        ) : (
          <TopPageWithTabs scrimReviews={scrimReviews} tournamentReviews={tournamentReviews} />
        )}
      </div>
    </div>
  )
}
