# Google ログインの設定手順

以下の手順で Supabase と Google Cloud を設定すると、アプリで「Google でログイン」が使えるようになります。

---

## 1. Google Cloud Console で OAuth クライアントを作成

1. **Google Cloud Console** を開く  
   https://console.cloud.google.com/

2. **プロジェクトを選択 or 新規作成**  
   上部のプロジェクト選択から、使うプロジェクトを選ぶか「新しいプロジェクト」で作成。

3. **認証情報の画面を開く**  
   左メニュー **「API とサービス」** → **「認証情報」**  
   または https://console.cloud.google.com/apis/credentials

4. **OAuth 同意画面を先に設定（未設定の場合）**  
   - 「OAuth 同意画面」をクリック  
   - ユーザータイプで「外部」を選び、アプリ名などを入力して保存。

5. **認証情報を作成**  
   - 「認証情報」タブに戻る  
   - **「+ 認証情報を作成」** → **「OAuth クライアント ID」**  
   - アプリケーションの種類: **「ウェブアプリケーション」**  
   - 名前: 任意（例: FF14 PVP 反省会）

6. **承認済みの JavaScript 生成元** に以下を追加  
   - `http://localhost:3000`  
   - `http://localhost:3001`  
   （本番用の URL がある場合は `https://あなたのドメイン` も追加）

7. **承認済みのリダイレクト URI** に以下を **1件** 追加  
   - `https://boaqgbrapagsrjfylhdi.supabase.co/auth/v1/callback`  
   （※ あなたの Supabase プロジェクトの URL。Project ID が違う場合は `https://<あなたのProject ID>.supabase.co/auth/v1/callback` に置き換え）  
   - ここに登録するのは **Supabase のコールバック URL だけ**で十分です。`localhost` やアプリの URL は Supabase 側の「Redirect URLs」で設定するため、Google にはこの1件だけで大丈夫です。

8. **作成** をクリックし、表示された **クライアント ID** と **クライアント シークレット** をコピーしてメモ。

---

## 2. Supabase で Google プロバイダを有効化

1. **Supabase ダッシュボード** を開く  
   https://supabase.com/dashboard

2. 対象プロジェクト（ff14-pvp-review）を選択。

3. 左メニュー **「Authentication」** を開いたあと、**「CONFIGURATION」** の **「Sign In / Providers」** をクリックする。

4. **「Google」** の行をクリックして開く。

5. **「Enable Sign in with Google」** を ON にする。

6. **Client ID** に、Google Cloud でコピーした「クライアント ID」を貼り付け。

7. **Client Secret** に、Google Cloud でコピーした「クライアント シークレット」を貼り付け。

8. **Save** で保存。

---

## 3. Supabase のリダイレクト URL を設定

1. 同じ Supabase プロジェクトで、左メニュー **「Authentication」** → **「URL Configuration」** を開く。

2. **「Redirect URLs」** の **「Add URL」** で、以下を追加。  
   - `http://localhost:3000/**`  
   - `http://localhost:3001/**`  
   本番用がある場合は `https://あなたのドメイン/**` も追加。

3. **Save** で保存。

---

## 4. 動作確認

1. 開発サーバーを起動（`npm run dev`）。
2. ブラウザで **http://localhost:3000/login** または **http://localhost:3001/login** を開く。
3. **「Google でログイン」** をクリックし、Google の認証画面 → ログイン後にトップへ戻る流れを確認。

---

## トラブルシューティング

- **「redirect_uri_mismatch」**  
  → Google の「承認済みのリダイレクト URI」に  
    `https://<Project ID>.supabase.co/auth/v1/callback` が**完全一致**で入っているか確認。

- **ログイン後にエラーページになる**  
  → Supabase の「Redirect URLs」に  
    `http://localhost:3000/**` と `http://localhost:3001/**` が入っているか確認。

- **Project ID の確認**  
  → Supabase の **Settings** → **General** の **Project ID** を確認。  
    URL は `https://<このProject ID>.supabase.co/auth/v1/callback` です。
