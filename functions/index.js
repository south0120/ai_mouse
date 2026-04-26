const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

// Stripe初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ====== プラン定義 ======
const PLANS = {
  free: {
    name: "無料",
    monthlyCredit: 0,
    dailyFreeCount: 10,
    price: 0,
    stripePriceId: null,
  },
  pro: {
    name: "Pro",
    monthlyCredit: 1000,
    dailyFreeCount: 0,
    priceUsd: 399,
    stripePriceId: process.env.STRIPE_PRICE_PRO_USD || "price_pro_usd",
  },
  pro_plus: {
    name: "Pro+",
    monthlyCredit: 3000,
    dailyFreeCount: 0,
    priceUsd: 599,
    stripePriceId: process.env.STRIPE_PRICE_PRO_PLUS_USD || "price_pro_plus_usd",
  },
  byok: {
    name: "BYOK",
    monthlyCredit: -1, // 無制限
    dailyFreeCount: 0,
    priceUsd: 199,
    stripePriceId: process.env.STRIPE_PRICE_BYOK_USD || "price_byok_usd",
  },
};

// ====== ユーティリティ ======

// 月次識別子（YYYY-MM）
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// テキストハッシュ（キャッシュキー）
function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// クレジット計算
function calculateCreditUsage(text) {
  const len = text.length;
  if (len <= 200) return 1;
  if (len <= 1000) return 3;
  return 5;
}

// 1分単位の キー
function getMinuteKey(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${userId}_${year}-${month}-${day}-${hour}-${minute}`;
}

// Firebase Auth トークン検証
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return null;
  }
}

// ユーザープラン取得
async function getUserPlan(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return "free";
  }
  return userDoc.data().planId || "free";
}

// ユーザー情報取得
async function getUserData(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  return userDoc.exists ? userDoc.data() : null;
}

// ====== 利用制限チェック ======

// 1分あたりのレート制限（有料：10回/分、無料：2回/分）
async function checkRateLimit(userId, isPaid) {
  const limit = isPaid ? 10 : 2;
  const minuteKey = getMinuteKey(userId);
  const ref = db.collection("rate_limits").doc(minuteKey);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() || {};

    if ((data.count || 0) >= limit) {
      return { allowed: false, reason: "rate_limit_exceeded" };
    }

    tx.set(ref, { 
      userId, 
      count: (data.count || 0) + 1, 
      limit,
      resetAt: new Date(Date.now() + 60000), // 1分後
    });

    return { allowed: true };
  });

  return result;
}

// 日次無料枠チェック（Freeユーザー向け）
async function checkDailyFreeLimit(uid) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ref = db.collection("daily_free").doc(`${uid}_${today}`);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() || {};
    const dailyLimit = 10;

    if ((data.count || 0) >= dailyLimit) {
      return { allowed: false, remaining: 0 };
    }

    tx.set(ref, { 
      uid, 
      count: (data.count || 0) + 1,
      resetAt: new Date(Date.now() + 86400000), // 24時間後
    });

    return { allowed: true, remaining: dailyLimit - (data.count || 0) - 1 };
  });

  return result;
}

// 月次クレジット チェック＆消費
async function checkAndConsumeCredit(uid, creditNeeded) {
  const month = getCurrentMonth();
  const creditsRef = db.collection("credits").doc(`${uid}_${month}`);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(creditsRef);
    const data = doc.data() || {};

    // 新月の場合は初期化
    if (!data.month) {
      const plan = await getUserPlan(uid);
      const planDef = PLANS[plan];
      tx.set(creditsRef, {
        userId: uid,
        month,
        planId: plan,
        used: creditNeeded,
        limit: planDef.monthlyCredit,
        resetAt: new Date(Date.now() + 30 * 86400000), // 次月まで
        createdAt: new Date(),
      });
      return {
        allowed: true,
        remaining: planDef.monthlyCredit - creditNeeded,
        used: creditNeeded,
        limit: planDef.monthlyCredit,
      };
    }

    // 既存ドキュメント
    if (data.limit > 0 && (data.used || 0) + creditNeeded > data.limit) {
      return {
        allowed: false,
        remaining: Math.max(0, data.limit - (data.used || 0)),
        used: data.used || 0,
        limit: data.limit,
        reason: "credit_limit_exceeded",
      };
    }

    // クレジット消費
    tx.update(creditsRef, {
      used: (data.used || 0) + creditNeeded,
    });

    return {
      allowed: true,
      remaining: Math.max(0, data.limit - (data.used || 0) - creditNeeded),
      used: (data.used || 0) + creditNeeded,
      limit: data.limit,
    };
  });

  return result;
}

// キャッシュ取得
async function getCache(text, mode, outputLang) {
  const hash = hashText(text);
  const cacheDoc = await db.collection("cache").doc(hash).get();

  if (!cacheDoc.exists) {
    return null;
  }

  const cache = cacheDoc.data();

  // TTL チェック（30日）
  if (cache.expiresAt && cache.expiresAt.toDate() < new Date()) {
    return null;
  }

  // モード と言語が一致するか
  if (cache.mode === mode && cache.outputLang === outputLang) {
    return cache.answer;
  }

  return null;
}

// キャッシュ保存
async function saveCache(text, mode, outputLang, answer, creditUsed) {
  const hash = hashText(text);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30日後

  await db.collection("cache").doc(hash).set({
    text,
    textHash: hash,
    mode,
    outputLang,
    answer,
    model: "gemini",
    creditUsed,
    createdAt: new Date(),
    expiresAt,
  });
}

// ====== APIエンドポイント ======

// Gemini API 呼び出し
async function callGemini(prompt, apiKey = null) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "回答を取得できませんでした";
}

// 暗号化・復号化（簡易版、本番はKMS使用推奨）
function encryptApiKey(key) {
  // 本番では Firebase KMS や Google Cloud KMS を使用
  return Buffer.from(key).toString("base64");
}

function decryptApiKey(encrypted) {
  return Buffer.from(encrypted, "base64").toString("utf-8");
}

// メインAPI: テキストをAIに問い合わせ（プラン統合版）
exports.queryAI = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // 認証チェック
    const user = await verifyAuth(req);
    if (!user) {
      res.status(401).json({ error: "認証が必要です。ログインしてください。" });
      return;
    }

    let { text, mode, outputLang } = req.body;
    mode = mode || "dictionary";
    outputLang = outputLang || "ja";

    // 入力検証
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "テキストが指定されていません" });
      return;
    }

    if (text.length > 5000) {
      res.status(400).json({ error: "テキストは5000文字以内にしてください" });
      return;
    }

    try {
      // ユーザープラン取得
      const plan = await getUserPlan(user.uid);
      const userData = await getUserData(user.uid);

      // 1. レート制限チェック
      const rateCheck = await checkRateLimit(user.uid, plan !== "free");
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: "リクエストが多すぎます。しばらく待ってから再度お試しください。",
        });
        return;
      }

      // 2. キャッシュ取得
      const cachedAnswer = await getCache(text, mode, outputLang);
      if (cachedAnswer) {
        return res.json({
          answer: cachedAnswer,
          isCached: true,
          plan,
          remaining: null, // キャッシュなので残数非更新
        });
      }

      // 3. クレジット計算
      const creditNeeded = calculateCreditUsage(text);

      // 4. Freeユーザーの場合は日次無料枠チェック
      let creditResult = null;
      if (plan === "free") {
        const dailyCheck = await checkDailyFreeLimit(user.uid);
        if (!dailyCheck.allowed) {
          return res.status(429).json({
            error: "本日の無料枠を使い切りました。Proへのアップグレードをご検討ください。",
            remaining: 0,
            plan: "free",
            upsellUrl: "/pricing",
          });
        }
        creditResult = {
          allowed: true,
          remaining: dailyCheck.remaining,
          used: 10 - dailyCheck.remaining,
          limit: 10,
        };
      } else {
        // 有料ユーザー（Pro/Pro+/BYOK）
        creditResult = await checkAndConsumeCredit(user.uid, creditNeeded);
        if (!creditResult.allowed) {
          return res.status(429).json({
            error: "月間クレジットを使い切りました。来月の1日にリセットされます。",
            remaining: creditResult.remaining,
            plan,
          });
        }
      }

      // 5. API呼び出し
      let answer;
      if (plan === "byok" && userData?.apiKey) {
        // BYOKユーザーは自分のAPIキーを使用
        const userApiKey = decryptApiKey(userData.apiKey);
        answer = await callGemini(
          `次の言葉・文章の意味を簡潔に説明してください（${outputLang === "ja" ? "日本語" : outputLang}で、2〜3文以内）:\n\n「${text}」`,
          userApiKey
        );
      } else {
        // 通常はサーバーのAPIキーを使用
        const prompt =
          mode === "translate"
            ? `次のテキストを${outputLang === "ja" ? "日本語" : outputLang}に翻訳してください。翻訳結果のみを返してください:\n\n「${text}」`
            : `次の言葉・文章の意味を簡潔に説明してください（${outputLang === "ja" ? "日本語" : outputLang}で、2〜3文以内）:\n\n「${text}」`;

        answer = await callGemini(prompt);
      }

      // 6. キャッシュ保存
      await saveCache(text, mode, outputLang, answer, creditNeeded);

      // 7. 成功レスポンス
      return res.json({
        answer,
        plan,
        remaining: creditResult.remaining,
        used: creditResult.used,
        limit: creditResult.limit,
        creditUsed: creditNeeded,
      });
    } catch (e) {
      console.error("queryAI error:", e);
      res.status(500).json({
        error: "AIへの問い合わせに失敗しました",
        details: process.env.NODE_ENV === "development" ? e.message : undefined,
      });
    }
  }
);

// 匿名利用向けAI問い合わせAPI（Freeのみ）
exports.queryAIAnon = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const anonId = req.headers["x-anonymous-id"];
    if (!anonId) {
      res.status(400).json({ error: "匿名IDが必要です" });
      return;
    }

    let { text, mode, outputLang } = req.body;
    mode = mode || "dictionary";
    outputLang = outputLang || "ja";

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "テキストが指定されていません" });
      return;
    }

    if (text.length > 200) {
      res.status(400).json({ error: "テキストは200文字以内にしてください（匿名ユーザー向け）" });
      return;
    }

    try {
      // キャッシュ取得
      const cachedAnswer = await getCache(text, mode, outputLang);
      if (cachedAnswer) {
        return res.json({
          answer: cachedAnswer,
          isCached: true,
          remaining: 10,
        });
      }

      // 日次無料枠チェック（匿名ユーザーは1日10回）
      const today = new Date().toISOString().slice(0, 10);
      const anonUsageRef = db.collection("daily_free_anon").doc(`${anonId}_${today}`);

      const usage = await db.runTransaction(async (tx) => {
        const doc = await tx.get(anonUsageRef);
        const data = doc.data() || {};

        if ((data.count || 0) >= 10) {
          return { allowed: false, remaining: 0 };
        }

        tx.set(anonUsageRef, {
          count: (data.count || 0) + 1,
          resetAt: new Date(Date.now() + 86400000),
        });

        return { allowed: true, remaining: 10 - (data.count || 0) - 1 };
      });

      if (!usage.allowed) {
        return res.status(429).json({
          error: "本日の無料利用回数に達しました。明日以降のご利用をお待ちしています。",
          remaining: 0,
        });
      }

      // Gemini 呼び出し
      const prompt =
        mode === "translate"
          ? `次のテキストを${outputLang === "ja" ? "日本語" : outputLang}に翻訳してください。翻訳結果のみを返してください:\n\n「${text}」`
          : `次の言葉・文章の意味を簡潔に説明してください（${outputLang === "ja" ? "日本語" : outputLang}で、2〜3文以内）:\n\n「${text}」`;

      const answer = await callGemini(prompt);

      // キャッシュ保存
      await saveCache(text, mode, outputLang, answer, 1);

      return res.json({
        answer,
        remaining: usage.remaining,
      });
    } catch (e) {
      console.error("queryAIAnon error:", e);
      res.status(500).json({ error: "AIへの問い合わせに失敗しました" });
    }
  }
);

// 利用状況取得API（プラン統合版）
exports.getUsage = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const user = await verifyAuth(req);
      let doc;
      let plan;
      let result;

      if (user) {
        // 認証ユーザー
        plan = await getUserPlan(user.uid);
        const month = getCurrentMonth();
        doc = await db.collection("credits").doc(`${user.uid}_${month}`).get();

        if (plan === "free") {
          // Freeユーザー：日次制限を返す
          const today = new Date().toISOString().slice(0, 10);
          const dailyDoc = await db.collection("daily_free").doc(`${user.uid}_${today}`).get();
          const dailyCount = dailyDoc.exists ? dailyDoc.data().count || 0 : 0;

          result = {
            plan,
            used: dailyCount,
            limit: 10,
            remaining: Math.max(0, 10 - dailyCount),
            resetType: "daily",
          };
        } else {
          // Pro/Pro+/BYOK：月次クレジット
          const creditData = doc.exists ? doc.data() : null;
          const planDef = PLANS[plan];

          result = {
            plan,
            used: creditData?.used || 0,
            limit: planDef.monthlyCredit === -1 ? "無制限" : planDef.monthlyCredit,
            remaining:
              planDef.monthlyCredit === -1
                ? "無制限"
                : Math.max(0, (planDef.monthlyCredit || 0) - (creditData?.used || 0)),
            resetType: "monthly",
          };
        }
      } else {
        // 匿名ユーザー
        const anonId = req.headers["x-anonymous-id"];
        if (!anonId) {
          return res.status(401).json({ error: "認証が必要です" });
        }

        const today = new Date().toISOString().slice(0, 10);
        doc = await db.collection("daily_free_anon").doc(`${anonId}_${today}`).get();
        const count = doc.exists ? doc.data().count || 0 : 0;

        result = {
          plan: "free_anon",
          used: count,
          limit: 10,
          remaining: Math.max(0, 10 - count),
          resetType: "daily",
        };
      }

      res.json(result);
    } catch (e) {
      console.error("getUsage error:", e);
      res.status(500).json({ error: "利用状況取得に失敗しました" });
    }
  }
);

// ====== Stripe 統合 ======

// Checkout Session 作成API
exports.createCheckoutSession = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "認証が必要です" });
    }

    const { planId } = req.body;
    if (!planId || !PLANS[planId]) {
      return res.status(400).json({ error: "無効なプランです" });
    }

    try {
      const planDef = PLANS[planId];
      if (!planDef.stripePriceId) {
        return res.status(400).json({ error: "無料プランではCheckoutは不要です" });
      }

      const priceId = planDef.stripePriceId;
      if (!priceId || /^price_[a-z_]+$/.test(priceId)) {
        return res.status(500).json({
          error: `Stripe Price ID が未設定です (plan=${planId})`,
        });
      }

      const userDoc = await db.collection("users").doc(user.uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      // Stripe顧客IDがない場合は作成
      let stripeCustomerId = userData.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          metadata: { firebaseUid: user.uid },
          email: user.email || undefined,
        });
        stripeCustomerId = customer.id;

        const updateData = { stripeCustomerId };
        if (userDoc.exists) {
          await db.collection("users").doc(user.uid).update(updateData);
        } else {
          await db.collection("users").doc(user.uid).set({
            ...updateData,
            planId: "free",
            createdAt: new Date(),
          });
        }
      }

      // Stripe Checkout Session 作成
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `https://ai-mouse-fc8c4.web.app/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://ai-mouse-fc8c4.web.app/checkout-cancel`,
        subscription_data: {
          metadata: { firebaseUid: user.uid, planId },
        },
        metadata: { firebaseUid: user.uid, planId },
      });

      return res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (e) {
      console.error("createCheckoutSession error:", e);
      res.status(500).json({ error: "Checkout セッション作成に失敗しました" });
    }
  }
);

// Stripe Webhook ハンドラ
exports.handleStripeWebhook = onRequest(
  { cors: false, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // 署名検証
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: "署名検証に失敗しました" });
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdate(event.data.object);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionCanceled(event.data.object);
          break;

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (e) {
      console.error("Webhook error:", e);
      res.status(500).json({ error: "Webhook処理エラー" });
    }
  }
);

// Stripe Customer ID → Firebase UID を検索
async function findUidByStripeCustomerId(stripeCustomerId) {
  const snapshot = await db
    .collection("users")
    .where("stripeCustomerId", "==", stripeCustomerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

// Stripe Price ID → planId を逆引き
function getPlanIdByPriceId(priceId) {
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === priceId) return planId;
  }
  return null;
}

// サブスクリプション更新ハンドラ
async function handleSubscriptionUpdate(subscription) {
  const uid =
    subscription.metadata?.firebaseUid ||
    (await findUidByStripeCustomerId(subscription.customer));

  if (!uid) {
    console.error("No Firebase UID found for subscription:", subscription.id);
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planId = getPlanIdByPriceId(priceId) || subscription.metadata?.planId;

  if (!planId) {
    console.error("Unknown price ID:", priceId);
    return;
  }

  // ユーザープラン更新
  await db.collection("users").doc(uid).set(
    {
      planId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  // アクティブなサブスクリプションの場合、月次クレジットを初期化
  if (subscription.status === "active") {
    const month = getCurrentMonth();
    const planDef = PLANS[planId];
    const creditsRef = db.collection("credits").doc(`${uid}_${month}`);
    const creditDoc = await creditsRef.get();

    if (!creditDoc.exists) {
      await creditsRef.set({
        userId: uid,
        month,
        planId,
        used: 0,
        limit: planDef.monthlyCredit,
        createdAt: new Date(),
      });
    } else {
      // プラン変更の場合、上限を更新
      await creditsRef.update({
        planId,
        limit: planDef.monthlyCredit,
      });
    }
  }

  console.log(`Subscription updated: uid=${uid}, plan=${planId}, status=${subscription.status}`);
}

// サブスクリプション キャンセルハンドラ
async function handleSubscriptionCanceled(subscription) {
  const uid =
    subscription.metadata?.firebaseUid ||
    (await findUidByStripeCustomerId(subscription.customer));

  if (!uid) {
    console.error("No Firebase UID found for canceled subscription:", subscription.id);
    return;
  }

  // ユーザーを free プランに戻す
  await db.collection("users").doc(uid).update({
    planId: "free",
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: "canceled",
    updatedAt: new Date(),
  });

  console.log(`Subscription canceled: uid=${uid}`);
}

// 支払い成功ハンドラ
async function handlePaymentSucceeded(invoice) {
  const uid = await findUidByStripeCustomerId(invoice.customer);
  if (!uid) {
    console.log("No Firebase UID for invoice:", invoice.id);
    return;
  }

  // 支払い履歴を記録
  await db.collection("subscriptions").add({
    userId: uid,
    stripeInvoiceId: invoice.id,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status,
    paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
    createdAt: new Date(),
  });

  console.log(`Payment recorded: uid=${uid}, invoice=${invoice.id}`);
}

// サブスクリプション キャンセルAPI
exports.cancelSubscription = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "認証が必要です" });
    }

    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const userData = userDoc.data();

      if (!userData?.stripeSubscriptionId) {
        return res.status(400).json({ error: "アクティブなサブスクリプションがありません" });
      }

      // Stripe でサブスクリプションをキャンセル（期間終了時に停止）
      await stripe.subscriptions.update(userData.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // ステータスを更新（実際のプラン変更はWebhookで処理）
      await db.collection("users").doc(user.uid).update({
        stripeSubscriptionStatus: "canceling",
        updatedAt: new Date(),
      });

      res.json({ success: true, message: "サブスクリプションは現在の請求期間終了時にキャンセルされます" });
    } catch (e) {
      console.error("cancelSubscription error:", e);
      res.status(500).json({ error: "キャンセル処理に失敗しました" });
    }
  }
);

// プラン・サブスクリプション状態取得API
exports.getSubscriptionStatus = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "認証が必要です" });
    }

    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const userData = userDoc.data() || {};
      const plan = userData.planId || "free";
      const planDef = PLANS[plan];

      // 月次クレジット取得
      const month = getCurrentMonth();
      const creditDoc = await db.collection("credits").doc(`${user.uid}_${month}`).get();
      const creditData = creditDoc.exists ? creditDoc.data() : null;

      res.json({
        plan,
        planName: planDef.name,
        monthlyPrice: planDef.priceUsd,
        monthlyCredit: planDef.monthlyCredit,
        used: creditData?.used || 0,
        remaining: planDef.monthlyCredit === -1 ? "無制限" : Math.max(0, (planDef.monthlyCredit || 0) - (creditData?.used || 0)),
        stripeSubscriptionId: userData.stripeSubscriptionId || null,
        email: userData.email,
      });
    } catch (e) {
      console.error("getSubscriptionStatus error:", e);
      res.status(500).json({ error: "ステータス取得に失敗しました" });
    }
  }
);

// BYOK API キー検証
exports.validateBYOKKey = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "認証が必要です" });
    }

    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "APIキーが必要です" });
    }

    try {
      // テスト呼び出しでキーの有効性確認
      const testPrompt = "Say 'OK' if this API key works.";
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const testRes = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }],
        }),
      });

      if (!testRes.ok) {
        return res.status(400).json({ error: "APIキーが無効です" });
      }

      // 有効な場合、ユーザー情報に保存
      const encrypted = encryptApiKey(apiKey);
      await db.collection("users").doc(user.uid).update({
        apiKey: encrypted,
        planId: "byok",
      });

      // BYOK用のクレジット初期化（無制限）
      const month = getCurrentMonth();
      await db.collection("credits").doc(`${user.uid}_${month}`).set({
        userId: user.uid,
        month,
        planId: "byok",
        used: 0,
        limit: -1, // 無制限
        resetAt: new Date(Date.now() + 30 * 86400000),
        createdAt: new Date(),
      });

      res.json({ success: true, message: "APIキーが保存されました" });
    } catch (e) {
      console.error("validateBYOKKey error:", e);
      res.status(500).json({ error: "キー検証に失敗しました" });
    }
  }
);

// ====== 単語帳クラウド同期（Pro+ / BYOK 限定） ======
const SYNC_ELIGIBLE_PLANS = ["pro_plus", "byok"];
const VOCAB_MAX_ITEMS = 5000;

async function ensureSyncEligible(uid) {
  const plan = await getUserPlan(uid);
  if (!SYNC_ELIGIBLE_PLANS.includes(plan)) {
    const e = new Error("クラウド同期は Pro+ または BYOK プランのみ利用できます");
    e.code = 403;
    throw e;
  }
  return plan;
}

// 単語帳: 取得（pull）
exports.getVocabulary = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "認証が必要です" });

    try {
      await ensureSyncEligible(user.uid);
      const snap = await db
        .collection("vocabulary")
        .where("uid", "==", user.uid)
        .orderBy("savedAt", "desc")
        .limit(VOCAB_MAX_ITEMS)
        .get();

      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.clientId || d.id,
          headword: data.headword,
          pos: data.pos || "",
          definition: data.definition || "",
          example: data.example || "",
          outputLang: data.outputLang || "",
          sourceInput: data.sourceInput || "",
          savedAt: data.savedAt?.toMillis ? data.savedAt.toMillis() : data.savedAt,
        };
      });

      res.json({ items, count: items.length });
    } catch (e) {
      const code = e.code === 403 ? 403 : 500;
      res.status(code).json({ error: e.message || "単語帳取得に失敗しました" });
    }
  }
);

// 単語帳: 一括上書き（push）
exports.syncVocabulary = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "認証が必要です" });

    try {
      await ensureSyncEligible(user.uid);
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length > VOCAB_MAX_ITEMS) {
        return res.status(400).json({ error: `単語帳は最大${VOCAB_MAX_ITEMS}件までです` });
      }

      // 既存をすべて削除して上書き（last-write-wins、シンプル方式）
      const existing = await db
        .collection("vocabulary")
        .where("uid", "==", user.uid)
        .get();

      // バッチを500件ずつ分割
      let batch = db.batch();
      let opCount = 0;
      const flush = async () => {
        if (opCount > 0) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      };

      for (const doc of existing.docs) {
        batch.delete(doc.ref);
        opCount++;
        if (opCount >= 450) await flush();
      }

      for (const it of items) {
        if (!it || !it.headword) continue;
        const docRef = db.collection("vocabulary").doc();
        batch.set(docRef, {
          uid: user.uid,
          clientId: it.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          headword: String(it.headword).slice(0, 200),
          pos: String(it.pos || "").slice(0, 100),
          definition: String(it.definition || "").slice(0, 2000),
          example: String(it.example || "").slice(0, 1000),
          outputLang: String(it.outputLang || "").slice(0, 8),
          sourceInput: String(it.sourceInput || "").slice(0, 1000),
          savedAt: it.savedAt
            ? new Date(typeof it.savedAt === "number" ? it.savedAt : Date.parse(it.savedAt))
            : new Date(),
          updatedAt: new Date(),
        });
        opCount++;
        if (opCount >= 450) await flush();
      }
      await flush();

      res.json({ success: true, count: items.length });
    } catch (e) {
      const code = e.code === 403 ? 403 : 500;
      console.error("syncVocabulary error:", e);
      res.status(code).json({ error: e.message || "同期に失敗しました" });
    }
  }
);
