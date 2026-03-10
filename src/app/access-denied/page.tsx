import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccessDeniedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <main className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-xl font-semibold text-amber-600 dark:text-amber-400">
          アクセスできません
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          このアプリを利用するには、管理者にあなたのメールアドレス（
          <span className="font-mono text-zinc-700 dark:text-zinc-300">
            {user.email}
          </span>
          ）の登録を依頼してください。
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="block w-full rounded-lg border border-zinc-300 bg-white py-3 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            別のアカウントでログイン
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-400">
          ログアウトは
          <Link href="/login" className="underline hover:no-underline">
            ログイン画面
          </Link>
          から再度 Google でサインインすると切り替えられます。
        </p>
      </main>
    </div>
  )
}
