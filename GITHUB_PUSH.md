# GitHub にコードを push する手順

Git アカウントはお持ちとのことなので、このアプリを GitHub のリポジトリに push する手順だけまとめます。

---

## 手順 1: GitHub で新しいリポジトリを作る

1. [GitHub](https://github.com) にログインする
2. 右上の **+** → **New repository** をクリック
3. 次のように設定する：
   - **Repository name**: 好きな名前（例: `ff14-pvp-review` や `クリコン反省アプリ`）
   - **Public** を選択
   - **「Add a README file」にはチェックを入れない**（既存のコードを push するため）
   - **Create repository** をクリック
4. 作成後、**「…or push an existing repository from the command line」** と書いてあるところに、次の2行が表示されます（`ユーザー名/リポジトリ名` はあなたのものに置き換わります）：
   ```bash
   git remote add origin https://github.com/ユーザー名/リポジトリ名.git
   git push -u origin main
   ```
   この2行は後で使います。

---

## 手順 2: ターミナルでアプリのフォルダに移動する

- **Cursor のターミナル** または **Mac の「ターミナル」** を開き、次のコマンドを実行します（パスはあなたの環境に合わせてください）：

  ```bash
  cd /Users/hajime.ifuku/Desktop/Cursor/@クリコン反省アプリ/app
  ```

---

## 手順 3: 変更を全部 add して commit する

```bash
git add .
git status
```

- `git status` で、`.env.local` が一覧に**出ていなければ**問題ありません（.gitignore で除外されています）。
- 出ていた場合は push しないでください（秘密情報が含まれます）。

続けて：

```bash
git commit -m "クリコン反省アプリのコードを追加"
```

---

## 手順 4: GitHub のリポジトリを「リモート」として追加する

手順 1 で作ったリポジトリの URL を使います。**`ユーザー名` と `リポジトリ名` をあなたのものに置き換えて**実行します：

```bash
git remote add origin https://github.com/ユーザー名/リポジトリ名.git
```

例：ユーザー名が `tanaka`、リポジトリ名が `ff14-pvp-review` の場合：

```bash
git remote add origin https://github.com/tanaka/ff14-pvp-review.git
```

---

## 手順 5: push する

```bash
git push -u origin main
```

- 初回は GitHub の **ユーザー名** と **パスワード** の入力を求められます。  
  パスワードには、GitHub の「パスワード」ではなく **Personal Access Token (PAT)** を使います。
- PAT をまだ持っていない場合：
  1. GitHub → 右上のアイコン → **Settings**
  2. 左メニュー一番下の **Developer settings** → **Personal access tokens** → **Tokens (classic)**
  3. **Generate new token (classic)** で、名前を付けて **repo** にチェックを入れ、トークンを発行
  4. 表示されたトークンをコピーし、`git push` でパスワードを聞かれたときに貼り付ける

---

## ここまでで完了

- ブラウザで GitHub のリポジトリを開くと、コードが反映されています。
- 次からは、変更を push するときは次の2行で十分です：
  ```bash
  git add .
  git commit -m "変更内容のメモ"
  git push
  ```

---

## よくあるエラー

| 状況 | 対処 |
|------|------|
| `remote origin already exists` | すでに `origin` が設定されています。別のリポジトリに push したい場合は `git remote set-url origin https://github.com/ユーザー名/リポジトリ名.git` で URL を変更できます。 |
| `branch 'main' doesn't exist` | ブランチ名が `master` の場合は `git push -u origin master` にしてみてください。 |
| 認証で弾かれる | パスワードには **Personal Access Token** を使い、通常のログイン用パスワードは使わないでください。 |
