// ツールバーアイコンクリックでサイドパネルを開く
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ====== 設定 ======
// TODO: デプロイ後に実際のCloud Functions URLに差し替え
const API_BASE = "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net";
const FIREBASE_API_KEY = "YOUR_FIREBASE_API_KEY";

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
  const idToken = await getFirebaseIdToken();

  const res = await fetch(`${API_BASE}/queryAI`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ text, mode, outputLang }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
  return data;
}

// 利用状況取得
async function getUsage() {
  const idToken = await getFirebaseIdToken();

  const res = await fetch(`${API_BASE}/getUsage`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
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
    getFirebaseIdToken()
      .then(() => sendResponse({ loggedIn: true }))
      .catch(() => sendResponse({ loggedIn: false }));
    return true;
  }

  return false;
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
