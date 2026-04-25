// ツールバーアイコンクリックでサイドパネルを開く
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ====== 設定 ======
const API_BASE = "https://asia-northeast1-ai-mouse-fc8c4.cloudfunctions.net";
const FIREBASE_API_KEY = "AIzaSyDeq_q2XRmEOqz6Z4WqbNsiLvKIVbe7QY8";

// ====== 言語マッピング ======
const LANG_META = {
  ja: { native: "日本語", english: "Japanese" },
  en: { native: "English", english: "English" },
  zh: { native: "中文（简体）", english: "Simplified Chinese" },
  ko: { native: "한국어", english: "Korean" },
  es: { native: "Español", english: "Spanish" },
  fr: { native: "Français", english: "French" },
};

// ====== プロンプト生成（出力言語ネイティブで記述） ======
const PROMPT_TEMPLATES = {
  ja: {
    dictionary: `あなたは高精度な辞書AIです。与えられたテキストから意味のある語・フレーズ・固有名詞・人名・組織名を抽出し、それぞれについて以下のブロック形式で日本語のみで回答してください。

【出力フォーマット】各見出しごとに以下のブロックを繰り返す。複数あれば空行で区切る。空応答は禁止。
■ <見出し語そのもの>
品詞: <名詞／動詞／固有名詞／人名／組織名 等>
意味: <1〜2文で核となる意味・概要>
用例: <短い例文を1つ。固有名詞なら関連する一文や所属でも可>

- 抽出対象: 一般語の内容語（名詞・動詞・形容詞・連語）に加え、固有名詞・人名・地名・組織名・略語・専門用語も含める
- 抽出から外すのは助詞・冠詞・前置詞のみで構成された語
- 入力にどんな語が含まれていても、必ず最低1つはブロックを出力すること
- 全角スペース・改行・記号などで区切られている場合は語ごとに分けて出力
- 前置きや謝辞、装飾は不要`,
    translate: `あなたは高精度な翻訳AIです。与えられたテキストを必ず日本語のみに翻訳してください。前置き・注釈・原文の繰り返しは禁止。翻訳結果だけを返してください。`,
  },
  en: {
    dictionary: `You are a precise dictionary AI. From the given text, extract every meaningful word, phrase, proper noun, person name, place, or organization name, and answer about each of them in English ONLY using the block format below.

[Output format] Repeat the block below for each item. Separate multiple items with a blank line. Never return an empty answer.
■ <the headword itself>
Part of speech: <noun / verb / adjective / proper noun / person / organization, etc.>
Meaning: <core meaning or concise overview in 1–2 sentences>
Example: <one short example sentence; for a proper noun, a relevant fact or affiliation is fine>

- Always include proper nouns, person names, place names, organizations, acronyms, and technical terms.
- Skip only words that are purely function words (articles/prepositions alone).
- Always output at least one block, even when the input is a name list.
- No preamble, no extra decoration.`,
    translate: `You are a precise translation AI. Translate the given text into English ONLY. Do not add any preamble, notes, or the original text. Return only the translation.`,
  },
  zh: {
    dictionary: `你是一个高精度的词典 AI。请从给定的文本中提取所有有意义的词、短语或专有名词，仅用简体中文按下方分块格式作答。除简体中文外，不得使用任何其他语言。

【输出格式】每个条目重复下面的块；多条之间用空行分隔。
■ <词条本身>
词性: <名词／动词／形容词 等>
释义: <用 1–2 句说明核心含义>
例句: <一个简短例句，必要时附中文译文>

- "词"指实义词（名词、动词、形容词、专有名词、固定搭配）。仅由助词／冠词／介词组成的词不作为词条。
- 输入若为单词则输出一个块；多词则按出现顺序输出多个块。
- 不要前言或多余装饰。
- 多义词在"释义"中最多保留 1–2 个义项，写作"① ②"。`,
    translate: `你是一个高精度的翻译 AI。请仅将给定文本翻译为简体中文。不要添加任何前言、注释或原文，只返回翻译结果。`,
  },
  ko: {
    dictionary: `당신은 정밀한 사전 AI입니다. 주어진 텍스트에서 의미가 있는 단어·구·고유명사를 추출하고, 각각에 대해 한국어로만 아래 블록 형식으로 답하세요. 한국어 이외의 언어는 사용하지 마세요.

[출력 형식] 항목마다 아래 블록을 반복하고, 여러 항목 사이에는 빈 줄로 구분합니다.
■ <표제어 그대로>
품사: <명사 / 동사 / 형용사 등>
의미: <핵심 의미를 1–2문장으로>
예문: <짧은 예문 하나, 필요하면 번역 병기>

- "단어"는 내용어(명사·동사·형용사·고유명사·연어 등)를 의미합니다. 조사·관사·전치사만의 단어는 제외.
- 입력이 한 단어면 블록 1개, 여러 단어면 등장 순서대로 여러 블록.
- 서두나 군더더기 금지.
- 다의어는 의미 행 안에서 "① ②"처럼 최대 1–2개.`,
    translate: `당신은 정밀한 번역 AI입니다. 주어진 텍스트를 반드시 한국어로만 번역하세요. 서두, 주석, 원문 반복은 금지하며 번역 결과만 반환하세요.`,
  },
  es: {
    dictionary: `Eres un AI de diccionario preciso. A partir del texto dado, extrae cada palabra, locución o nombre propio con significado, y responde sobre cada uno ÚNICAMENTE en español siguiendo el formato de bloque a continuación. No uses ningún otro idioma.

[Formato de salida] Repite el bloque siguiente por cada elemento, separados por una línea en blanco.
■ <la entrada tal cual>
Categoría: <sustantivo / verbo / adjetivo, etc.>
Significado: <sentido principal en 1–2 oraciones>
Ejemplo: <una oración de ejemplo breve, con traducción si conviene>

- "Palabra" significa palabra de contenido (sustantivo, verbo, adjetivo, nombre propio, locución). Omitir palabras puramente funcionales (artículos, preposiciones aisladas).
- Una sola palabra → un bloque; varias palabras → varios bloques en el orden del texto.
- Sin preámbulos ni adornos extra.
- Para palabras polisémicas, mantener como máximo 1–2 acepciones en la línea Significado, p. ej. "1) ... 2) ...".`,
    translate: `Eres un AI de traducción preciso. Traduce el texto dado ÚNICAMENTE al español. No añadas preámbulos, notas ni el texto original. Devuelve solo la traducción.`,
  },
  fr: {
    dictionary: `Vous êtes une IA de dictionnaire précise. À partir du texte fourni, extrayez chaque mot, locution ou nom propre porteur de sens, et répondez à propos de chacun UNIQUEMENT en français selon le format de bloc ci-dessous. N'utilisez aucune autre langue.

[Format de sortie] Répétez le bloc suivant pour chaque entrée, séparées par une ligne vide.
■ <l'entrée telle quelle>
Nature: <nom / verbe / adjectif, etc.>
Sens: <le sens principal en 1–2 phrases>
Exemple: <une courte phrase d'exemple, avec traduction si utile>

- « Mot » désigne un mot lexical (nom, verbe, adjectif, nom propre, locution). Ignorer les mots purement grammaticaux (articles, prépositions isolées).
- Un seul mot en entrée → un bloc ; plusieurs mots → plusieurs blocs dans l'ordre du texte.
- Pas de préambule ni de décoration superflue.
- Pour les mots polysémiques, garder au plus 1–2 sens dans la ligne Sens, p. ex. « 1) ... 2) ... ».`,
    translate: `Vous êtes une IA de traduction précise. Traduisez le texte donné UNIQUEMENT en français. N'ajoutez ni préambule, ni note, ni le texte original. Renvoyez seulement la traduction.`,
  },
};

function buildSystemPrompts(outputLang) {
  return PROMPT_TEMPLATES[outputLang] || PROMPT_TEMPLATES.ja;
}

function langEnglishName(code) {
  return (LANG_META[code] || LANG_META.ja).english;
}

// ====== Mercury-2 設定 ======
const MERCURY_API_BASE = "https://api.inceptionlabs.ai/v1";

async function getMercuryApiKey() {
  const data = await chrome.storage.sync.get({ mercuryApiKey: "" });
  return data.mercuryApiKey;
}

function buildUserMessage(text, mode, outputLang) {
  const langEn = langEnglishName(outputLang);
  const directive = mode === "translate"
    ? `Translate the following text strictly into ${langEn} ONLY. Output: ${langEn}.`
    : `From the input below, extract each meaningful word/phrase/proper noun and produce one dictionary block per item (headword, part of speech, meaning, example). If there is only one item, output one block. Use ${langEn} ONLY.`;
  return `${directive}\n\n---\n${text}`;
}

async function queryOpenAICompatible({ baseUrl, apiKey, model, text, mode, outputLang, providerName }) {
  if (!apiKey) throw new Error(`${providerName} APIキーが未設定です。設定タブで入力してください。`);

  const systemPrompts = buildSystemPrompts(outputLang);
  const userMsg = buildUserMessage(text, mode, outputLang);
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompts[mode] || systemPrompts.dictionary },
      { role: "user", content: userMsg },
    ],
    max_tokens: 1500,
    temperature: 0.2,
  });

  const doFetch = () => fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  let res = await doFetch();
  // 500系は1回だけリトライ
  if (res.status >= 500 && res.status < 600) {
    await new Promise((r) => setTimeout(r, 800));
    res = await doFetch();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = err.error?.message || `${providerName} API error: ${res.status}`;
    throw new Error(translateProviderError(rawMsg, res.status, providerName));
  }
  const data = await res.json();
  const answer = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!answer) {
    console.error(`${providerName} returned empty answer. Raw:`, data);
    throw new Error(
      `${providerName}から回答が得られませんでした。入力を短く区切り直すか、別の語で試してください。`
    );
  }
  return { answer, remaining: -1 };
}

// プロバイダーの英語エラーメッセージを利用者向けに翻訳
function translateProviderError(rawMsg, status, providerName) {
  const m = String(rawMsg || "");
  if (status >= 500 || /server.*error|internal.*error|temporarily/i.test(m)) {
    return `${providerName}側で一時的なエラーが発生しました（${status || 500}）。少し待ってから再試行してください。`;
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(m)) {
    return `${providerName}のレート制限に達しました。しばらく待ってから再試行してください。`;
  }
  if (status === 401 || /unauthorized|invalid.*key|api key/i.test(m)) {
    return `${providerName}のAPIキーが無効です。設定を見直してください。`;
  }
  if (status === 400 && /context.?length|too long|max.*tokens/i.test(m)) {
    return `入力が長すぎます。短く区切ってから再試行してください。`;
  }
  return `${providerName}でエラー（${status}）: ${m}`;
}

async function queryMercury(text, mode, outputLang, apiKeyOverride) {
  const apiKey = apiKeyOverride || (await getMercuryApiKey());
  return queryOpenAICompatible({
    baseUrl: MERCURY_API_BASE,
    apiKey,
    model: "mercury-2",
    text, mode, outputLang,
    providerName: "Mercury",
  });
}

async function queryOpenAI(text, mode, outputLang, apiKey) {
  return queryOpenAICompatible({
    baseUrl: "https://api.openai.com/v1",
    apiKey,
    model: "gpt-4o-mini",
    text, mode, outputLang,
    providerName: "OpenAI",
  });
}

async function queryGeminiDirect(text, mode, outputLang, apiKey) {
  if (!apiKey) throw new Error("Gemini APIキーが未設定です。設定タブで入力してください。");

  const systemPrompts = buildSystemPrompts(outputLang);
  const sys = systemPrompts[mode] || systemPrompts.dictionary;
  const userMsg = buildUserMessage(text, mode, outputLang);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.2 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = err.error?.message || `Gemini API error: ${res.status}`;
    throw new Error(translateProviderError(rawMsg, res.status, "Gemini"));
  }
  const data = await res.json();
  const answer = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!answer) {
    console.error("Gemini returned empty answer. Raw:", data);
    throw new Error("Geminiから回答が得られませんでした。入力を短く区切り直すか、別の語で試してください。");
  }
  return { answer, remaining: -1 };
}

async function queryBYOK(text, mode, outputLang) {
  const { byokProvider, byokApiKey } = await chrome.storage.sync.get({
    byokProvider: "",
    byokApiKey: "",
  });
  if (!byokProvider || !byokApiKey) {
    throw new Error("BYOK設定が完了していません");
  }
  if (byokProvider === "gemini") return queryGeminiDirect(text, mode, outputLang, byokApiKey);
  if (byokProvider === "openai") return queryOpenAI(text, mode, outputLang, byokApiKey);
  if (byokProvider === "mercury") return queryMercury(text, mode, outputLang, byokApiKey);
  throw new Error(`不明なBYOKプロバイダー: ${byokProvider}`);
}

// ====== 設定チェック ======
function areSettingsConfigured() {
  const isConfigured = API_BASE.includes("cloudfunctions.net") && 
                       !API_BASE.includes("YOUR_PROJECT_ID") &&
                       !FIREBASE_API_KEY.includes("YOUR_");
  return isConfigured;
}

// ====== プラン定義 ======
const PLANS = {
  free: { name: "無料", monthlyCredit: 0, dailyFreeCount: 10 },
  pro: { name: "Pro", monthlyCredit: 1000, price: 480 },
  pro_plus: { name: "Pro+", monthlyCredit: 3000, price: 798 },
  byok: { name: "BYOK", monthlyCredit: -1, price: 165 },
};

// ====== Google認証 → Firebase Auth ======
async function getFirebaseIdToken() {
  // Chrome Identity API でGoogleトークン取得
  const googleToken = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error("未ログイン"));
      } else {
        resolve(token);
      }
    });
  });

  // Google トークン → Firebase ID トークンに交換
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${googleToken}&providerId=google.com`,
        requestUri: chrome.identity.getRedirectURL(),
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );

  if (!res.ok) throw new Error("Firebase認証に失敗しました");
  const data = await res.json();
  return data.idToken;
}

// 匿名ID取得（userがログインしていない時に利用）
async function getAnonymousId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ anonId: null }, async (data) => {
      if (chrome.runtime.lastError) {
        reject(new Error("匿名IDの取得に失敗しました"));
        return;
      }

      if (data.anonId) {
        resolve(data.anonId);
        return;
      }

      const newId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      chrome.storage.local.set({ anonId: newId }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error("匿名IDの保存に失敗しました"));
        } else {
          resolve(newId);
        }
      });
    });
  });
}

// ログイン（interactive）
async function signIn() {
  const googleToken = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error("ログインがキャンセルされました"));
      } else {
        resolve(token);
      }
    });
  });

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${googleToken}&providerId=google.com`,
        requestUri: chrome.identity.getRedirectURL(),
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Firebase signIn error:", errData);
    throw new Error(errData.error?.message || "Firebase認証に失敗しました");
  }
  const data = await res.json();
  return {
    idToken: data.idToken,
    email: data.email,
    displayName: data.displayName || data.email,
  };
}

// ログアウト
async function signOut() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, resolve);
      } else {
        resolve();
      }
    });
  });
}

// ====== プラン判定 ======
async function getEffectivePlan(settings) {
  // 1. ローカルデバッグ上書き
  const local = await chrome.storage.local.get({ debugPlanOverride: "" });
  if (local.debugPlanOverride) return local.debugPlanOverride;

  // 2. BYOKキー設定済み = byok 扱い
  if (settings && settings.byokProvider && settings.byokApiKey) return "byok";

  // 3. サーバー側の購読状態（Stripe webhook 連携時）
  try {
    const idToken = await getFirebaseIdToken();
    const res = await fetch(`${API_BASE}/getSubscriptionStatus`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.plan || "free";
    }
  } catch {}
  return "free";
}

// ====== クライアント側日次制限（匿名・無料ユーザー） ======
async function checkAndConsumeDailyFree() {
  const today = new Date().toISOString().slice(0, 10);
  const data = await chrome.storage.local.get({ localUsage: { date: today, count: 0 } });
  let usage = data.localUsage;
  if (usage.date !== today) usage = { date: today, count: 0 };
  if (usage.count >= 10) {
    return { allowed: false, count: usage.count };
  }
  usage.count += 1;
  await chrome.storage.local.set({ localUsage: usage });
  return { allowed: true, count: usage.count };
}

// ====== AI問い合わせ（プロキシ経由） ======
async function queryAI(text, mode, outputLang) {
  let idToken;
  try {
    idToken = await getFirebaseIdToken();
  } catch {
    idToken = null;
  }

  let res;
  try {
    if (idToken) {
      res = await fetch(`${API_BASE}/queryAI`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ text, mode, outputLang }),
      });
    } else {
      const anonId = await getAnonymousId();
      res = await fetch(`${API_BASE}/queryAIAnon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anonymous-id": anonId,
        },
        body: JSON.stringify({ text, mode, outputLang }),
      });
    }
  } catch (e) {
    console.error("queryAI fetch failed", e);
    throw new Error("ネットワークエラー: APIリクエストに失敗しました");
  }

  let data;
  const rawBody = await res.text();
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.error("queryAI response not JSON", rawBody);
    throw new Error(`API応答エラー（JSON解析失敗）: ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

// 利用状況取得
async function getUsage() {
  let idToken;
  try {
    idToken = await getFirebaseIdToken();
  } catch {
    idToken = null;
  }

  let res;
  try {
    if (idToken) {
      res = await fetch(`${API_BASE}/getUsage`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } else {
      const anonId = await getAnonymousId();
      res = await fetch(`${API_BASE}/getUsage`, {
        headers: { "x-anonymous-id": anonId },
      });
    }
  } catch (e) {
    console.error("getUsage fetch failed", e);
    throw new Error("ネットワークエラー: 利用状況取得に失敗しました");
  }

  let data;
  const rawBody = await res.text();
  try {
    data = JSON.parse(rawBody);
  } catch {
    console.error("getUsage response not JSON", rawBody);
    throw new Error(`API応答エラー（JSON解析失敗）: ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

// ====== メッセージハンドラ ======
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "queryAI") {
    const text = msg.text;
    const mode = msg.mode || "dictionary";
    const outputLang = msg.outputLang || "ja";

    (async () => {
      try {
        const settings = await chrome.storage.sync.get({
          aiProvider: "mercury",
          byokProvider: "",
          byokApiKey: "",
        });

        // 有効プランの判定（BYOK key設定済み or デバッグ上書き or サーバー値）
        const effectivePlan = await getEffectivePlan(settings);
        const isPaid =
          effectivePlan === "pro" ||
          effectivePlan === "pro_plus" ||
          effectivePlan === "byok";

        // 無料・匿名ユーザーには日次10回のクライアント側制限
        if (!isPaid) {
          const usage = await checkAndConsumeDailyFree();
          if (!usage.allowed) {
            sendResponse({
              error: "本日の無料枠（10回）を使い切りました。明日リセット、または有料プランへのアップグレードをご検討ください。",
              remaining: 0,
              plan: "free",
            });
            return;
          }
        }

        // ルーティング
        let data;
        if (settings.byokProvider && settings.byokApiKey) {
          data = await queryBYOK(text, mode, outputLang);
        } else if (settings.aiProvider === "cloud") {
          data = await queryAI(text, mode, outputLang);
        } else {
          data = await queryMercury(text, mode, outputLang);
        }

        saveHistory(text, data.answer, mode);

        // 利用状況をローカルに反映
        let remaining = data.remaining;
        if (!isPaid) {
          const today = new Date().toISOString().slice(0, 10);
          const u = await chrome.storage.local.get({ localUsage: { date: today, count: 0 } });
          remaining = Math.max(0, 10 - u.localUsage.count);
        }
        sendResponse({ answer: data.answer, remaining, plan: effectivePlan });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === "signIn") {
    signIn()
      .then((user) => sendResponse({ success: true, user }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "signOut") {
    signOut()
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "getUsage") {
    (async () => {
      try {
        const settings = await chrome.storage.sync.get({ byokProvider: "", byokApiKey: "" });
        const plan = await getEffectivePlan(settings);
        const isPaid = plan === "pro" || plan === "pro_plus" || plan === "byok";

        if (!isPaid) {
          // 無料・匿名ユーザーはローカルカウンタを優先表示
          const today = new Date().toISOString().slice(0, 10);
          const u = await chrome.storage.local.get({ localUsage: { date: today, count: 0 } });
          const usage = u.localUsage.date === today ? u.localUsage : { date: today, count: 0 };
          sendResponse({
            plan,
            used: usage.count,
            limit: 10,
            remaining: Math.max(0, 10 - usage.count),
            resetType: "daily",
          });
          return;
        }

        // 有料プランはサーバー値を取得（失敗時はクライアント上書き値を返す）
        try {
          const data = await getUsage();
          sendResponse(data);
        } catch (_) {
          const limits = { pro: 1000, pro_plus: 3000, byok: -1 };
          sendResponse({
            plan,
            used: 0,
            limit: limits[plan] === -1 ? "無制限" : limits[plan],
            remaining: limits[plan] === -1 ? "無制限" : limits[plan],
            resetType: "monthly",
          });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === "getHistory") {
    getHistory()
      .then((history) => sendResponse({ history }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "checkAuth") {
    const debug = {
      settingsConfigured: areSettingsConfigured(),
      apiBase: API_BASE.includes("YOUR_") ? "未設定" : "設定済み",
      firebaseApiKey: FIREBASE_API_KEY.includes("YOUR_") ? "未設定" : "設定済み"
    };

    getFirebaseIdToken()
      .then((idToken) => {
        let email = "";
        try {
          const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          email = payload.email || "";
        } catch (_) {}
        sendResponse({ loggedIn: true, email, debug });
      })
      .catch((err) => sendResponse({
        loggedIn: false,
        debug,
        error: err.message
      }));
    return true;
  }

  if (msg.type === "getSubscriptionStatus") {
    getFirebaseIdToken()
      .then((idToken) =>
        fetch(`${API_BASE}/getSubscriptionStatus`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
      )
      .then((res) => res.json())
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "createCheckoutSession") {
    const { planId } = msg;
    getFirebaseIdToken()
      .then((idToken) =>
        fetch(`${API_BASE}/createCheckoutSession`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ planId }),
        })
      )
      .then((res) => res.json())
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "cancelSubscription") {
    getFirebaseIdToken()
      .then((idToken) =>
        fetch(`${API_BASE}/cancelSubscription`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        })
      )
      .then((res) => res.json())
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "validateBYOKKey") {
    const { apiKey } = msg;
    getFirebaseIdToken()
      .then((idToken) =>
        fetch(`${API_BASE}/validateBYOKKey`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ apiKey }),
        })
      )
      .then((res) => res.json())
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === "saveBYOK") {
    const { provider, apiKey } = msg;
    (async () => {
      try {
        // 軽い検証のため "test" を辞書モードで投げる
        const tester =
          provider === "gemini"
            ? queryGeminiDirect("test", "dictionary", "ja", apiKey)
            : provider === "openai"
              ? queryOpenAI("test", "dictionary", "ja", apiKey)
              : provider === "mercury"
                ? queryMercury("test", "dictionary", "ja", apiKey)
                : Promise.reject(new Error("不明なプロバイダー"));
        await tester;
        await chrome.storage.sync.set({
          byokProvider: provider,
          byokApiKey: apiKey,
        });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (msg.type === "clearBYOK") {
    chrome.storage.sync.set({ byokProvider: "", byokApiKey: "" }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.type === "addVocab") {
    (async () => {
      try {
        // プランチェック（ローカル上書き > サーバー）
        const localOverride = await new Promise((resolve) => {
          chrome.storage.local.get({ debugPlanOverride: "" }, (d) =>
            resolve(d.debugPlanOverride || "")
          );
        });
        let plan = localOverride;
        if (!plan) {
          const planRes = await new Promise((resolve) => {
            getFirebaseIdToken()
              .then((idToken) =>
                fetch(`${API_BASE}/getSubscriptionStatus`, {
                  headers: { Authorization: `Bearer ${idToken}` },
                })
                  .then((r) => r.json())
                  .then(resolve)
                  .catch(() => resolve({ plan: "free" }))
              )
              .catch(() => resolve({ plan: "free" }));
          });
          plan = planRes.plan || "free";
        }
        if (plan !== "pro" && plan !== "pro_plus" && plan !== "byok") {
          sendResponse({ error: "有料プランが必要です" });
          return;
        }

        const entries = parseDictionaryAnswer(msg.payload.answer);
        if (entries.length === 0) {
          sendResponse({ error: "保存対象の語が見つかりませんでした" });
          return;
        }

        const data = await chrome.storage.local.get({ vocabulary: [] });
        const list = data.vocabulary;
        const now = Date.now();
        entries.forEach((e, i) => {
          list.unshift({
            id: `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
            headword: e.headword,
            pos: e.pos,
            definition: e.definition,
            example: e.example,
            outputLang: msg.payload.outputLang,
            sourceInput: msg.payload.sourceInput,
            savedAt: now,
          });
        });
        // 上限5000件
        if (list.length > 5000) list.length = 5000;
        await chrome.storage.local.set({ vocabulary: list });
        sendResponse({ success: true, added: entries.length });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
});

// 辞書ブロック形式の回答をパース
function parseDictionaryAnswer(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  // 「品詞 / Part of speech / 词性 / 품사 / Categoría / Nature」
  const posRe = /^\s*(?:品詞|词性|품사|Part of speech|Categoría|Nature)\s*[:：]\s*(.+)$/i;
  // 「意味 / Meaning / 释义 / 의미 / Significado / Sens」
  const meaningRe = /^\s*(?:意味|释义|의미|Meaning|Significado|Sens)\s*[:：]\s*(.+)$/i;
  // 「用例 / Example / 例句 / 예문 / Ejemplo / Exemple」
  const exampleRe = /^\s*(?:用例|例句|예문|Example|Ejemplo|Exemple)\s*[:：]\s*(.+)$/i;
  // 見出し行: 行頭の「■」または箇条書き記号
  const headRe = /^\s*[■◆●・-]\s*(.+?)\s*$/;

  for (const line of lines) {
    const h = line.match(headRe);
    if (h) {
      if (cur && cur.headword) blocks.push(cur);
      cur = { headword: h[1].trim(), pos: "", definition: "", example: "" };
      continue;
    }
    if (!cur) continue;
    const p = line.match(posRe);
    if (p) { cur.pos = p[1].trim(); continue; }
    const m = line.match(meaningRe);
    if (m) { cur.definition = m[1].trim(); continue; }
    const e = line.match(exampleRe);
    if (e) { cur.example = e[1].trim(); continue; }
    // ブロック内の継続行は意味に追記
    if (cur.definition && line.trim() && !line.match(/^[■◆●・]/)) {
      cur.definition += " " + line.trim();
    }
  }
  if (cur && cur.headword) blocks.push(cur);
  return blocks;
}

// ====== 履歴管理 ======
async function saveHistory(input, output, mode) {
  const settings = await chrome.storage.sync.get({ historyLimit: 30 });
  const data = await chrome.storage.local.get({ history: [] });
  const history = data.history;

  history.unshift({
    input,
    output,
    mode,
    timestamp: Date.now(),
  });

  // 上限を超えたら古いものを削除
  if (history.length > settings.historyLimit) {
    history.length = settings.historyLimit;
  }

  await chrome.storage.local.set({ history });
}

async function getHistory() {
  const data = await chrome.storage.local.get({ history: [] });
  return data.history;
}
