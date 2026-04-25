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
    dictionary: `あなたは高精度な辞書AIです。与えられたテキストから意味を持つ語・フレーズ・固有名詞を抽出し、それぞれについて以下のブロック形式で日本語のみで回答してください。日本語以外の言語は使わないこと。

【出力フォーマット】各語ごとに以下のブロックを繰り返す。複数語あれば空行で区切る。
■ <見出し語そのもの>
品詞: <名詞／動詞／形容詞 等>
意味: <1〜2文で核となる意味>
用例: <短い例文を1つ。必要なら訳も併記>

- 「単語」とは内容語（名詞・動詞・形容詞・固有名詞・連語など）を指す。助詞・冠詞・前置詞のみの語は対象外
- 入力が1語ならブロックは1つ。複数語あれば抽出順に複数ブロック
- 前置きや解説、見出し以外の余計な記号や装飾は不要
- 同じ語の複数義は意味欄内で「① ②」のように1〜2個まで`,
    translate: `あなたは高精度な翻訳AIです。与えられたテキストを必ず日本語のみに翻訳してください。前置き・注釈・原文の繰り返しは禁止。翻訳結果だけを返してください。`,
  },
  en: {
    dictionary: `You are a precise dictionary AI. From the given text, extract every meaningful word, phrase, or proper noun, and answer about each of them in English ONLY using the block format below. Never use any other language.

[Output format] Repeat the block below for each item. Separate multiple items with a blank line.
■ <the headword itself>
Part of speech: <noun / verb / adjective, etc.>
Meaning: <core meaning in 1–2 sentences>
Example: <one short example sentence; add a translation if helpful>

- "Word" means a content word (noun, verb, adjective, proper noun, fixed phrase). Skip pure function words (articles, particles, prepositions on their own).
- If the input is a single word, output one block. If multiple, output multiple blocks in source order.
- No preamble, no extra decoration.
- For polysemous words, keep at most 1–2 senses inside the Meaning line as "1) ... 2) ...".`,
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
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompts[mode] || systemPrompts.dictionary },
        { role: "user", content: userMsg },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${providerName} API error: ${res.status}`);
  }
  const data = await res.json();
  return { answer: data.choices[0].message.content, remaining: -1 };
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
      generationConfig: { maxOutputTokens: 500 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }
  const data = await res.json();
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

    // BYOK > aiProvider 設定 > Mercury（既定）の優先順
    chrome.storage.sync.get(
      { aiProvider: "mercury", byokProvider: "", byokApiKey: "" },
      (settings) => {
        let queryFn;
        if (settings.byokProvider && settings.byokApiKey) {
          queryFn = queryBYOK(text, mode, outputLang);
        } else if (settings.aiProvider === "cloud") {
          queryFn = queryAI(text, mode, outputLang);
        } else {
          queryFn = queryMercury(text, mode, outputLang);
        }

        queryFn
          .then((data) => {
            saveHistory(text, data.answer, mode);
            sendResponse({ answer: data.answer, remaining: data.remaining });
          })
          .catch((e) => sendResponse({ error: e.message }));
      }
    );
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
    getUsage()
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ error: e.message }));
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
      .then(() => sendResponse({ loggedIn: true, debug }))
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
});

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
