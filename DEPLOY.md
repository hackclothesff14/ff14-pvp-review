# ネット公開（デプロイ）手順

チームメンバーに URL を共有して見てもらうための手順です。  
現在の設定では **URL を知っている人だけがアクセス可能**（Google アカウント制限はなし）です。

---

## 1. 前提

- **GitHub** にこのプロジェクトのコードを push しておく
- **Vercel** アカウント（[vercel.com](https://vercel.com) で無料登録、GitHub 連携可）
- **Supabase** はすでに利用中（本番用プロジェクトの URL / anon key を用意）

---

## 2. Vercel でデプロイ

### 2-1. プロジェクトをインポート

1. [vercel.com](https://vercel.com) にログイン
2. **Add New…** → **Project**
3. **Import Git Repository** で、このアプリの GitHub リポジトリを選択
4. **Import** をクリック

### 2-2. 環境変数を設定

**Configure Project** の画面で **Environment Variables** を開き、次を追加します。

| 名前 | 値 | 備考 |
|------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | あなたの Supabase プロジェクトの URL | 例: `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の **anon (public) key** | Supabase ダッシュボード → Settings → API で確認 |

- 値は **本番用** の Supabase プロジェクトのものを使う（ローカルの `.env.local` と同じでよい）
- 両方とも **Production / Preview / Development** にチェックを入れておく

### 2-3. デプロイ実行

- **Deploy** をクリック
- ビルドが終わると、`https://〇〇〇.vercel.app` のような URL が発行されます

---

## 3. Supabase 側の設定（Google ログインを使う場合）

Google ログインの「リダイレクト先」に、Vercel の URL を追加します。

1. Supabase ダッシュボード → **Authentication** → **URL Configuration**
2. **Redirect URLs** に次を追加  
   `https://あなたのプロジェクト.vercel.app/auth/callback`  
   （実際の Vercel の URL に置き換えてください）
3. **Save** で保存

※ 今回「URL を知っている人だけ」で、認証を必須にしていない場合は、この設定は必須ではありません。

---

## 4. チームへの共有

- 発行された **Vercel の URL**（例: `https://your-app.vercel.app`）をチームメンバーに共有するだけです。
- 現状のミドルウェア設定では、**ログインなしでその URL にアクセスすれば閲覧できます**。

---

## 5. よくある注意点

- **環境変数**  
  `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が Vercel に正しく入っていないと、Supabase に繋がらず画面が動きません。  
  デプロイ後にエラーが出る場合は、Vercel の **Settings → Environment Variables** を確認してください。
- **ビルドエラー**  
  ローカルで `npm run build` が成功するか先に確認すると安心です。
- **ドメイン**  
  無料プランでも `〇〇.vercel.app` の URL はそのまま使えます。独自ドメインにしたい場合は Vercel の **Settings → Domains** で設定できます。

---

## 6. 今後の制限をかけたい場合

「指定した Google アカウントだけに限定したい」などにする場合は、  
`src/lib/supabase/middleware.ts` のコメントにある **認証・許可メール制限** のコードを有効にし、  
Supabase の `allowed_emails` テーブルと連携する形で再度設定できます。
