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
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          試合内容を入力
        </h1>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <ReviewForm initial={review} />
        </div>
      </div>
    </div>
  )
}
