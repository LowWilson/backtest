# Backtest Lab Supabase版

## 使い方

1. Supabaseで新しいProjectを作成
2. SQL Editorで `supabase_schema.sql` を全部実行
3. Project Settings → API から以下をコピー
   - Project URL
   - anon/public key
4. `config.js` に貼る
5. `index.html` を開く
6. Sign up → Login → Sync

## 注意

- Supabase設定前でも localStorage で使える
- Login後にSyncするとローカルデータとSupabaseデータをマージ
- 同じアカウントで別端末ログインすると同期される
