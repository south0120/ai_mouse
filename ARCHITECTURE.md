# AI Mouse 完全版アーキテクチャ

## 📊 Firestore スキーマ設計

### 1. `users` - ユーザー情報 + プラン管理
```
/users/{uid}
  - email: string
  - displayName: string
  - planId: enum ("free" | "pro" | "pro_plus" | "byok")
  - stripeCustomerId: string (Pro/Pro+ only)
  - stripeSubscriptionId: string (Pro/Pro+ only)
  - apiKey: string (BYOK only, encrypted)
  - createdAt: timestamp
  - updatedAt: timestamp
  - lastUsedAt: timestamp
```

### 2. `credits` - 月次クレジット管理
```
/credits/{userId_month}
  - userId: string
  - month: string (YYYY-MM)
  - planId: string
  - used: number
  - limit: number
  - resetAt: timestamp
  - createdAt: timestamp
```

計算ルール：
- Free → limit=0（日次無料枠のみ）
- Pro → limit=1000
- Pro+ → limit=3000
- BYOK → limit=-1（無制限）

### 3. `subscriptions` - 支払い履歴
```
/subscriptions/{userId_date}
  - userId: string
  - planId: string
  - stripeSubscriptionId: string
  - status: enum ("active" | "past_due" | "canceled" | "expired")
  - currentPeriodStart: timestamp
  - currentPeriodEnd: timestamp
  - pricePerMonth: number (JPY)
  - createdAt: timestamp
  - canceledAt: timestamp (nullable)
```

### 4. `cache` - API レスポンスキャッシュ
```
/cache/{textHash}
  - text: string
  - textHash: string
  - mode: string ("dictionary" | "translate")
  - outputLang: string
  - answer: string
  - model: string ("gemini")
  - creditUsed: number
  - createdAt: timestamp
  - expiresAt: timestamp (TTL: 30日)
```

### 5. `rate_limits` - 1分単位レート制限
```
/rate_limits/{userId_minute}
  - userId: string
  - minute: string (YYYY-MM-DD-HH-MM)
  - count: number
  - limit: number (free: 2, paid: 10)
  - resetAt: timestamp
```

### 6. `daily_free` - 日次無料枠追跡（廃止予定）
```
廃止。Credits に統合。
```

---

## 💳 プラン定義

```javascript
const PLANS = {
  free: {
    name: "無料",
    monthlyCredit: 0, // 日次10回のみ
    dailyFreeCount: 10,
    price: 0,
    stripePriceId: null,
    features: ["dictionary", "translate", "3-day history"],
  },
  pro: {
    name: "Pro",
    monthlyCredit: 1000,
    dailyFreeCount: 0,
    price: 480, // per month, JPY
    stripePriceId: "price_pro_jpy", // Stripe設定後に更新
    features: ["full history", "priority support"],
  },
  pro_plus: {
    name: "Pro+",
    monthlyCredit: 3000,
    dailyFreeCount: 0,
    price: 798, // per month, JPY
    stripePriceId: "price_pro_plus_jpy",
    features: ["priority processing", "custom prompts (future)"],
  },
  byok: {
    name: "BYOK (Bring Your Own Key)",
    monthlyCredit: -1, // 無制限
    dailyFreeCount: 0,
    price: 165, // per month, JPY (annual: 1980/1year)
    stripePriceId: "price_byok_jpy",
    features: ["unlimited with own API key"],
  },
};
```

---

## 🧮 クレジット計算ロジック

入力テキスト長によってクレジット消費が変動：

```javascript
function calculateCreditUsage(text) {
  const len = text.length;
  if (len <= 200) return 1;
  if (len <= 1000) return 3;
  return 5;
}
```

UI表示：
- Freeユーザー → 「あと○回」（日次10回ベース）
- Proユーザー → 「あと○クレジット」（月間1000ベース）

---

## 🔄 月次リセット処理

Firestore スケジューラー（または Cloud Scheduler）で毎月1日00:00 UTC実行：

```
1. 全ユーザーをスキャン（plan: pro | pro_plus）
2. 前月の credits ドキュメント作成
3. 新月の credits ドキュメント初期化（used: 0, limit: xxx）
4. Stripe の billing cycle チェック（念の為）
```

---

## 🛡️ セキュリティ

### Firestore セキュリティルール

```
/users/{uid}
  - read: if request.auth.uid == uid
  - write: if request.auth.uid == uid (特定フィールドのみ)

/credits/{docId}
  - read: if request.auth.uid == docId の userId
  - write: Cloud Functions のみ

/subscriptions/{docId}
  - read: if request.auth.uid == docId の userId
  - write: Stripe webhook のみ

/cache/{docId}
  - read: 全員
  - write: Cloud Functions のみ

/rate_limits/{docId}
  - read: Cloud Functions のみ
  - write: Cloud Functions のみ
```

---

## 🌐 支払い統合フロー（Stripe）

### Customer Creation（ユーザー登録時）
```
1. Google OAuth でログイン
2. Firestore users ドキュメント作成（planId: "free"）
3. Stripe Customer オブジェクト作成
4. users.stripeCustomerId に保保存
```

### Subscription Creation（課金開始時）
```
1. フロント → /createCheckoutSession
2. Stripe Checkout Session 生成
3. ユーザー → Stripe Hosted Checkout へリダイレクト
4. 支払い完了
5. Stripe webhook (payment_intent.succeeded) → サーバー
6. users.planId 更新
7. subscriptions ドキュメント逆作成
8. credits ドキュメント初期化
9. ユーザーへメール（確認）
```

### 定期更新
- Stripe の recurring charge が月初に自動実行
- webhook で検知して credits リセット

### キャンセル
- ユーザー → キャンセルリクエスト
- Stripe subscription キャンセル
- users.planId → "free" に戻す
- 次の billing cycle で終了

---

## 🚀 API エンドポイント（Cloud Functions）

### 既存（拡張予定）
- `POST /queryAI` → クレジット消費チェック追加
- `POST /queryAIAnon` → 変更なし
- `GET /getUsage` → クレジット返却に変更

### 新規
- `POST /createCheckoutSession` → Stripe Session 生成
- `POST /handleStripeWebhook` → webhook 受け取り
- `POST /cancelSubscription` → キャンセル処理
- `GET /getSubscriptionStatus` → プラン情報取得
- `POST /validateApiKey` → BYOK のキー検証

---

## 📱 フロントエンド フロー

### ログイン画面
```
[Googleでログイン] [匿名で続行]
      ↓
  Free プラン自動割り当て
```

### 無料枠終了時トリガー
```
queryAI エラー 429
  → Toast: "本日の無料枠を使い切りました"
  → [Pro を始める] ボタン表示
  → クリック → Stripe Checkout へ
```

### ダッシュボード（設定タブ）
```
現在のプラン: Pro
月間クレジット: 1000
使用済み: 234
残数: 766

[プラン変更] [キャンセル] ボタン
```

---

## 🔀 BYOK フロー

### API キー設定（オプションスクリーン）
```
[Gemini のキーを使う？]
  → APIキー入力
  → 検証（テスト呼び出し）
  → users.apiKey に暗号化保存
  → planId: "byok" に自動変更
```

### API 呼び出し時
```
user.planId === "byok"
  → user.apiKey を復号化
  → ユーザーのGemini キー使用
  → 自社サーバーのクレジット消費なし
```

---

## 📈 監視・分析ポイント

1. **課金率** → Free から Pro への転換率
2. **チャーン率** → Pro キャンセル率
3. **ARPU** → Average Revenue Per User
4. **クレジット効率** → 実際の消費パターン
5. **API コスト** → Gemini 請求額 vs 売上

---

## 🎯 実装スケジュール

### Week 1-2: バックエンド基盤
- [ ] Firestore スキーマ作成・検証
- [ ] functions 拡張（クレジット計算）
- [ ] Stripe API 統合
- [ ] Webhook 処理

### Week 3: フロントエンド
- [ ] 課金導線UI
- [ ] ダッシュボード
- [ ] プラン選択ダイアログ

### Week 4: テスト・調整
- [ ] エンドツーエンドテスト
- [ ] Stripe テストモード検証
- [ ] エラーハンドリング調整

### Week 5-6: 本番化
- [ ] 本番 Stripe 設定
- [ ] Firebase デプロイ
- [ ] モニタリング
- [ ] ベータユーザー提供

