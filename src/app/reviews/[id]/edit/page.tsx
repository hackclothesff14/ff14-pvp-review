import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReviewForm from '../../ReviewForm'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: `編集 - ${id.slice(0, 8)}... - FF14 PVP クリスタルコンフリクト` }
}

export default async function EditReviewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: review, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !review) {
    notFound()
  }

  return (
    <div className="relative min-h-screen px-4 py-8">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/review-form-bg.jpg')" }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-zinc-50/75 dark:bg-zinc-950/80" aria-hidden />
      <div className="relative z-10 mx-auto max-w-5xl">
        <h1 className="mb-6 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          試合内容を入力
        </h1>
        <div className="rounded-xl border border-zinc-200/90 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-zinc-700/90 dark:bg-zinc-900/72">
          <ReviewForm initial={review} />
        </div>
      </div>
    </div>
  )
}
