const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const DAILY_FREE_LIMIT = 5;
const MAX_INPUT_LENGTH = 200;

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

// 今日の利用回数を取得・チェック
async function checkAndIncrementUsage(uid) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ref = db.collection("usage").doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.data() || {};

    // 日付が変わっていたらリセット
    if (data.date !== today) {
      tx.set(ref, { date: today, count: 1 });
      return { allowed: true, remaining: DAILY_FREE_LIMIT - 1 };
    }

    // TODO: Phase 4で有料プラン判定を追加
    if (data.count >= DAILY_FREE_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    tx.update(ref, { count: data.count + 1 });
    return { allowed: true, remaining: DAILY_FREE_LIMIT - data.count - 1 };
  });

  return result;
}

// Gemini API 呼び出し
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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

// メインAPI: テキストをAIに問い合わせ
exports.queryAI = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    // POST のみ
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

    const { text, mode } = req.body;

    // 入力バリデーション
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "テキストが指定されていません" });
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      res.status(400).json({ error: `テキストは${MAX_INPUT_LENGTH}文字以内にしてください` });
      return;
    }

    // 回数チェック
    const usage = await checkAndIncrementUsage(user.uid);
    if (!usage.allowed) {
      res.status(429).json({
        error: "本日の無料利用回数の上限に達しました。有料プランへのアップグレードをご検討ください。",
        remaining: 0,
      });
      return;
    }

    // モードに応じたプロンプト生成
    let prompt;
    const outputLang = req.body.outputLang || "ja";

    if (mode === "translate") {
      prompt = `次のテキストを${outputLang === "ja" ? "日本語" : outputLang}に翻訳してください。翻訳結果のみを返してください:\n\n「${text}」`;
    } else {
      // デフォルト: 辞書モード
      prompt = `次の言葉・文章の意味を簡潔に説明してください（${outputLang === "ja" ? "日本語" : outputLang}で、2〜3文以内）:\n\n「${text}」`;
    }

    try {
      const answer = await callGemini(prompt);
      res.json({ answer, remaining: usage.remaining });
    } catch (e) {
      console.error("AI query failed:", e);
      res.status(500).json({ error: "AIへの問い合わせに失敗しました" });
    }
  }
);

// 利用状況の確認API
exports.getUsage = onRequest(
  { cors: true, region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const user = await verifyAuth(req);
    if (!user) {
      res.status(401).json({ error: "認証が必要です" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const doc = await db.collection("usage").doc(user.uid).get();
    const data = doc.data() || {};

    const count = data.date === today ? data.count : 0;
    res.json({
      used: count,
      limit: DAILY_FREE_LIMIT,
      remaining: DAILY_FREE_LIMIT - count,
    });
  }
);
