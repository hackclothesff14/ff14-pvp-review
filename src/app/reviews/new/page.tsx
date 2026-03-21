import ReviewForm from '../ReviewForm'

export const metadata = {
  title: '新規追加 - FF14 PVP クリスタルコンフリクト',
}

type Props = {
  /** Next.js 16 では Promise（await して展開） */
  searchParams?: Promise<{ type?: string | string[] }>
}

export default async function NewReviewPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : undefined
  const typeParam = sp?.type
  const tournamentMode = Array.isArray(typeParam) ? typeParam[0] === 'tournament' : typeParam === 'tournament'

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h1
          className={`text-xl font-bold text-zinc-900 dark:text-zinc-100 ${tournamentMode ? 'mb-2' : 'mb-6'}`}
        >
          {tournamentMode ? '大会の記録を新規追加' : '反省会を新規追加'}
        </h1>
        {tournamentMode && (
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            スクリムの入力画面をベースに、大会名と試合ごとの対戦相手を入力できます。
          </p>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <ReviewForm tournamentMode={tournamentMode} />
        </div>
      </div>
    </div>
  )
}
