import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-xl font-semibold text-red-600 dark:text-red-400">
          ログインに失敗しました
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          認証の処理中にエラーが発生しました。もう一度お試しください。
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-zinc-900 py-3 text-center text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          ログイン画面へ戻る
        </Link>
      </main>
    </div>
  )
}
