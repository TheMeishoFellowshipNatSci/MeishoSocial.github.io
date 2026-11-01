# Meisho Social

Weibo型の小規模コミュニティSNS用GitHub Pagesフロントエンドです。

## 公開
1. このフォルダの中身をリポジトリ直下へアップロードします。
2. Settings > Pagesで、Deploy from a branch、`main`、`/(root)`を選択します。
3. Google OAuthのAuthorized JavaScript originsに `https://themeishofellowshipnatsci.github.io` を登録します。

## 公開データ同期
GASのScript PropertiesにあるEXPORT_KEYを使い、次の完全URLを組み立てます。

`GAS_EXEC_URL?action=export&key=EXPORT_KEY`

GitHubリポジトリの Settings > Secrets and variables > Actions に、以下のRepository secretを作成します。

- Name: `GASSHO_EXPORT_URL`
- Value: 上記の完全URL

Actionsの `Sync public timeline` は10分おきに `data/public.json` を更新します。

## 注意
`EXPORT_KEY`、招待コード、OAuthクライアントシークレットはリポジトリへ入れないでください。`assets/config.js`内のGoogleクライアントIDとGAS `/exec` URLは公開識別子です。

## テーマ
初回はOS設定に従い、右上の月・太陽ボタンで切り替えます。選択はlocalStorageに保存されます。
