// ツールバーアイコンクリックでサイドパネルを開く
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ====== 設定 ======
// TODO: デプロイ後に実際のCloud Functions URLに差し替え
const API_BASE = "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net";
const FIREBASE_API_KEY = "AIzaSyDeq_q2XRmEOqz6Z4WqbNsiLvKIVbe7QY8";

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
        postBody: `id_token=${googleToken}&providerId=google.com`,
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
        postBody: `id_token=${googleToken}&providerId=google.com`,
        requestUri: chrome.identity.getRedirectURL(),
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );

  if (!res.ok) throw new Error("Firebase認証に失敗しました");
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
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    console.error("queryAI response not JSON", text);
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
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    console.error("getUsage response not JSON", text);
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
    queryAI(msg.text, msg.mode || "dictionary", msg.outputLang || "ja")
      .then((data) => {
        // 履歴に保存
        saveHistory(msg.text, data.answer, msg.mode || "dictionary");
        sendResponse({ answer: data.answer, remaining: data.remaining });
      })
      .catch((e) => sendResponse({ error: e.message }));
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
