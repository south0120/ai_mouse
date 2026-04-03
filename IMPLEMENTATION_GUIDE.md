# AI Mouse 完全版 - 実装完了ガイド

## 📋 実装概要

### ✅ Phase 1: バックエンド基盤（完了）

#### Firestore スキーマ
- [x] users → プラン・Stripe連携情報
- [x] credits → 月次クレジット管理
- [x] subscriptions → 支払い履歴
- [x] cache → API レスポンスキャッシュ（TTL 30日）
- [x] daily_free → 日次無料枠追跡
- [x] rate_limits → 1分単位レート制限

#### セキュリティルール
- [x] users: 本人のみ読み取り
- [x] credits: Cloud Functions のみ書き込み
- [x] subscriptions: Stripe webhook のみ書き込み
- [x] cache: 全員読み取り可、Functions のみ書き込み

#### Cloud Functions API
- [x] queryAI → クレジット管理・キャッシュ統合
- [x] queryAIAnon → 匿名ユーザー向け（変更なし）
- [x] getUsage → クレジット統計返却
- [x] createCheckoutSession → Stripe Session 生成
- [x] handleStripeWebhook → webhook ハンドラ
- [x] cancelSubscription → サブスク キャンセル
- [x] getSubscriptionStatus → プラン情報取得
- [x] validateBYOKKey → BYOK キー検証

---

### ✅ Phase 2: ビジネスロジック（完了）

#### クレジット計算
```javascript
テキスト長 → クレジット消費
≤200文字 → 1クレジット
≤1000文字 → 3クレジット
>1000文字 → 5クレジット
```

#### プラン定義
| プラン | 月額 | 月次クレジット | 日次無料 | 特徴 |
|--------|------|--------|---------|------|
| Free | ¥0 | 0 | 10回 | 拡散 |
| Pro | ¥480 | 1,000 | 0 | 標準 |
| Pro+ | ¥798 | 3,000 | 0 | 高速 |
| BYOK | ¥165 | ∞ | 0 | 独自キー |

#### レート制限
- **Free/Pro/Pro+**: 1分あたり10回
- **制限超過**: 429 エラー → 1分待機

#### キャッシュメカニズム
- 同一テキスト・モード・言語の結果をキャッシュ
- TTL: 30日
- ハッシュベースのキー管理
- **効果**: API コスト 30-50% 削減想定

#### 月次リセット
- Firestore スケジューラー（Cloud Scheduler推奨）
- 毎月1日 00:00 UTC 実行
- 全 Pro/Pro+ ユーザーの credits リセット

---

### ✅ Phase 3: フロントエンド（完了）

#### UI コンポーネント

**課金導線**
- [ ] ポップアップ → "無料枠終了"メッセージ
- [ ] 「Proにアップグレード」ボタン表示
- [ ] クリック → Stripe Checkout へ

**プラン選択ダイアログ**
- [ ] Free / Pro / Pro+ / BYOK 選択肢
- [ ] 各プランの特徴・価格表示
- [ ] 「選択」→ Stripe Session 生成

**ダッシュボード**
- [ ] 現在のプラン表示
- [ ] 月間使用状況（クレジット/回数）
- [ ] 「プラン変更」ボタン
- [ ] 「BYOK設定」ボタン

**BYOK セットアップ**
- [ ] APIキー入力フィールド
- [ ] 「保存」ボタン → キー検証
- [ ] 検証成功 → プラン自動変更（byok）

**エラーハンドリング**
- [ ] 無料枠超過 → アップセルダイアログ
- [ ] キャッシュヒット → "キャッシュから取得"表示
- [ ] クレジット残数表示（有料ユーザー向け）

---

## 🔧 環境変数設定

### Firebase 側 (.env)

```bash
# .env.production (functions/ 配下)
GEMINI_API_KEY=AIzaSy...              # Gemini API キー
STRIPE_SECRET_KEY=sk_live_...         # Stripe Secret Key
STRIPE_WEBHOOK_SECRET=whsec_...       # Stripe Webhook Secret
STRIPE_PRICE_PRO_JPY=price_...        # Pro プラン Stripe Price ID
STRIPE_PRICE_PRO_PLUS_JPY=price_...   # Pro+ プラン Stripe Price ID
STRIPE_PRICE_BYOK_JPY=price_...       # BYOK プラン Stripe Price ID
```

### Chrome Extension 側 (background.js)

```javascript
const API_BASE = "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net";
const FIREBASE_API_KEY = "AIzaSy..."; // Firebase Web API Key
```

---

## 📝 テストチェックリスト

### ローカルテスト（開発環境）

- [ ] **Freeユーザー**
  - [ ] 1日10回まで使用可
  - [ ] 11回目で 429 エラー
  - [ ] 翌日リセット確認

- [ ] **Proユーザー（テスト用）**
  - [ ] 月1,000クレジット割当
  - [ ] 使用状況が表示される
  - [ ] クレジット消費計算正確性（200文字→1、1000文字→3）

- [ ] **キャッシュ機能**
  - [ ] 同一テキスト2回目 → "キャッシュから取得"
  - [ ] 異なるモード/言語 → キャッシュ非適用

- [ ] **レート制限**
  - [ ] 1分に10回超過 → 429 エラー
  - [ ] 次の分で リセット

- [ ] **エラーハンドリング**
  - [ ] 無料枠超過 → ポップアップに「Proにアップグレード」ボタン
  - [ ] クリック → sidebar アップセルダイアログ

### Stripe テストモード

- [ ] **Checkout Session 作成**
  - [ ] `/createCheckoutSession` API → Session URL 返却
  - [ ] Stripe Checkout ページ開けるか

- [ ] **テストカード決済**
  - [ ] `4242 4242 4242 4242` で決済成功
  - [ ] webhook 受け取り確認

- [ ] **Webhook 処理**
  - [ ] `customer.subscription.created` → ユーザー プラン更新
  - [ ] `customer.subscription.update` → 正常に処理
  - [ ] `customer.subscription.deleted` → プラン free に戻る

### BYOK テスト

- [ ] **APIキー検証**
  - [ ] 有効なキー → 保存成功、planId → "byok"
  - [ ] 無効なキー → エラーメッセージ

- [ ] **BYOK利用時**
  - [ ] ユーザーのGemini キー使用確認
  - [ ] 自社サーバーのクレジット消費ゼロ

---

## 🚀 デプロイ手順

### 事前準備

```bash
# 1. Firebase CLI インストール
npm install -g firebase-tools

# 2. ローカルで動作確認
firebase emulators:start

# 3. Stripe 設定
# → Stripe Dashboard で本番 API キー取得
# → Webhook エンドポイント登録
```

### Cloud Functions デプロイ

```bash
# functions/ ディレクトリで
cd functions
npm install
firebase deploy --only functions

# 環境変数設定（デプロイ後）
firebase functions:config:set \
  stripe.secret_key="sk_live_..." \
  gemini.api_key="AIzaSy..."
```

### Firestore デプロイ

```bash
firebase deploy --only firestore:rules
```

### Chrome Extension デプロイ

```bash
# 1. background.js の API_BASE を本番URLに
# 2. manifest.json で 本番ホストを host_permissions に追加
# 3. Chrome Web Store へ提出
```

---

## 📈 監視・分析

### 設定すべき Cloud Monitoring

```
- queryAI のエラーレート（>1%で アラート）
- プラン変更トリガー率（KPI）
- 月別チャーン率
- API コスト（Gemini）vs 売上
```

---

## ⚠️ 本番化チェック

- [ ] Stripe 本番キー設定完了
- [ ] webhook 署名検証実装
- [ ] APIキー 暗号化（Cloud KMS の利用）
- [ ] エラーログ集約（StackDriver）
- [ ] サポートメール設定
- [ ] 利用規約・プライバシーポリシー作成
- [ ] ユーザー同意画面実装

---

## 🔄 今後の拡張ポイント

### Phase 4: 高度な機能（将来）

| 機能 | 優先度 | 実装時間 |
|------|--------|--------|
| カスタムプロンプト（Pro+向け） | 🔴 高 | 2週間 |
| 長文最適化（テキスト分割） | 🔴 高 | 1週間 |
| 複数言語AI モデル選択 | 🟡 中 | 1週間 |
| APIキーローテーション | 🟡 中 | 3日 |
| ユーザー招待プログラム | 🟡 中 | 1週間 |
| Chrome Sync クラウドバックアップ | 🟢 低 | 2週間 |

---

## 💬 FAQ

**Q: 無料ユーザーに課金ムードを強すぎないようにしたい**
- A: 無料枠終了時のみ課金導線表示。常時ウザい通知は避ける。

**Q: BYOK ユーザーのサポートコストは？**
- A: APIキーのトラブルは基本的に自由度。簡易FAQ で対応。

**Q: チャーン防止策は？**
- A: メール通知（月間使用量レポート）、「あと○日でリセット」表示。

**Q: 決済手数料の圧縮は？**
- A: 年間パス提供でのボリュームディスカウント、Stripe + Pad Tribe併用検討。

