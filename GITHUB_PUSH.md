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

## 「Authorize your device」と表示されたときのやり方

`git push` をしたあと、ターミナルに **「Authorize your device」** や **「Enter one-time code:」** と出ることがあります。これは「このパソコンを GitHub に一度だけ認証する」ための手順です。

### 手順（3ステップ）

1. **ターミナルに表示されたコードを確認する**  
   - `Enter one-time code:` のあとに **8文字の英数字**（例: `ABCD-1234`）が表示されているか、または「ブラウザで次の URL を開いてください」と URL が出ているか確認します。
   - コードが表示されていない場合は、その上に書いてある **URL**（`https://github.com/login/device` など）をメモします。

2. **ブラウザで GitHub のデバイス認証ページを開く**  
   - ブラウザで次のアドレスを開きます：  
     **https://github.com/login/device**
   - すでに GitHub にログインしていない場合は、先に GitHub にログインしてから同じページを開き直します。

3. **コードを入力して「Authorize」する**  
   - ページの入力欄に、ターミナルに表示されていた **8文字のコード** をそのまま入力します。
   - **Authorize**（または「認証」）ボタンをクリックします。
   - 成功すると「Device activated」のようなメッセージが出ます。

4. **ターミナルに戻る**  
   - ブラウザでの操作が終わったら、ターミナルに戻ります。  
   - 認証が通っていれば、そのあと `git push` が自動で続行されるか、もう一度 `git push` を実行すると成功します。

### 補足

- この「デバイス認証」は、**このパソコンから GitHub に安全にログインするため**の一度きりの手順です。
- 次回から同じパソコンで push するときは、同じ手順を繰り返す場合と、そのまま push できる場合があります（Git の認証の保存設定によります）。

### 8文字のコードがどこにも出ない場合 → パスワードで Personal Access Token を使う

ターミナルにコードが表示されないときは、**ユーザー名とパスワード**を聞かれる方式になっていることがあります。その場合は次のようにします。

1. **GitHub で Personal Access Token (PAT) を作る**
   - ブラウザで [GitHub](https://github.com) にログイン
   - 右上のアイコン → **Settings** → 左メニュー一番下 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   - **Generate new token (classic)** をクリック
   - **Note**: 例）`git push用`
   - **Expiration**: 好きな期間（例：90 days）
   - **Select scopes**: **repo** にチェックを入れる
   - **Generate token** をクリック
   - 表示された **トークン（ghp_ で始まる文字列）をコピー**して、メモ帳などに貼り付けておく（この画面を離れると二度と表示されません）

2. **ターミナルで `git push` をもう一度実行する**
   ```bash
   git push -u origin main
   ```

3. **聞かれたら入力する**
   - **Username for 'https://github.com':** → GitHub のユーザー名（例: `hackclothesff14`）を入力して Enter
   - **Password for 'https://hackclothesff14@github.com':** → さきほどコピーした **PAT を貼り付けて** Enter（入力しても画面には表示されませんが、そのまま Enter で大丈夫です）

4. 成功すると `Branch 'main' set up to track...` や `Writing objects: 100%` のような表示が出て push が完了します。

---

## どうしてもターミナルで push できないとき（URL に PAT を入れて一度だけ push）

ユーザー名・パスワードの入力がうまくいかない場合は、**リモートの URL に PAT を一時的に含めて** push する方法があります。

**注意**: PAT が URL に含まれるため、**push が成功したら必ず次の「4. 元に戻す」を実行してください。** また、ターミナルの履歴に URL が残るので、後から PAT を無効化（GitHub でトークンを削除）してもよいです。

1. **GitHub で Personal Access Token (PAT) を用意する**  
   （上記「8文字のコードがどこにも出ない場合」の 1. と同じ手順で作成し、`ghp_` で始まるトークンをコピー）

2. **いまの push が止まっている場合は Ctrl+C で一度キャンセルする**

3. **次のコマンドを 1 行で実行する**（`あなたのPAT` のところを、コピーした PAT に置き換える）
   ```bash
   git remote set-url origin https://hackclothesff14:あなたのPAT@github.com/hackclothesff14/ff14-pvp-review.git
   git push -u origin main
   ```
   例：PAT が `ghp_abc123xyz` なら  
   `git remote set-url origin https://hackclothesff14:ghp_abc123xyz@github.com/hackclothesff14/ff14-pvp-review.git`

4. **push が成功したら、URL から PAT を外して元に戻す**
   ```bash
   git remote set-url origin https://github.com/hackclothesff14/ff14-pvp-review.git
   ```
   これで次回以降、リモート URL にパスワードは含まれません。

5. **セキュリティのため**: GitHub の Settings → Developer settings → Personal access tokens で、今使ったトークンを **Delete** してから、次回用に新しいトークンを発行してもかまいません。

---

## よくあるエラー

| 状況 | 対処 |
|------|------|
| `remote origin already exists` | すでに `origin` が設定されています。別のリポジトリに push したい場合は `git remote set-url origin https://github.com/ユーザー名/リポジトリ名.git` で URL を変更できます。 |
| `branch 'main' doesn't exist` | ブランチ名が `master` の場合は `git push -u origin master` にしてみてください。 |
| 認証で弾かれる | パスワードには **Personal Access Token** を使い、通常のログイン用パスワードは使わないでください。 |
