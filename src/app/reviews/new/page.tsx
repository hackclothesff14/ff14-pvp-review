import ReviewForm from '../ReviewForm'

export const metadata = {
  title: '新規追加 - FF14 PVP クリスタルコンフリクト',
}

export default function NewReviewPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          反省会を新規追加
        </h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <ReviewForm />
        </div>
      </div>
    </div>
  )
}
