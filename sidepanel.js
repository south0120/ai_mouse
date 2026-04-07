// ====== DOM要素 ======
const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");
const loginBtn = document.getElementById("loginBtn");
const anonymousBtn = document.getElementById("anonymousBtn");
const debugBtn = document.getElementById("debugBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const usageBadge = document.getElementById("usageBadge");
const historyList = document.getElementById("historyList");
let loggedIn = false;
const emptyState = document.getElementById("emptyState");
const historyTab = document.getElementById("historyTab");
const settingsTab = document.getElementById("settingsTab");
const outputLang = document.getElementById("outputLang");
const uiLang = document.getElementById("uiLang");
const historyLimit = document.getElementById("historyLimit");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const toast = document.getElementById("toast");
const debugInfo = document.getElementById("debugInfo");

// プラン管理要素
const planModal = document.getElementById("planModal");
const byokModal = document.getElementById("byokModal");
const upsellModal = document.getElementById("upsellModal");
const planInfo = document.getElementById("planInfo");
const changePlanBtn = document.getElementById("changePlanBtn");
const byokSetupBtn = document.getElementById("byokSetupBtn");
const planCancelBtn = document.getElementById("planCancelBtn");
const planConfirmBtn = document.getElementById("planConfirmBtn");
const byokCancelBtn = document.getElementById("byokCancelBtn");
const byokConfirmBtn = document.getElementById("byokConfirmBtn");
const byokApiKeyInput = document.getElementById("byokApiKeyInput");
const upsellUpgradeBtn = document.getElementById("upsellUpgradeBtn");
const upsellDismissBtn = document.getElementById("upsellDismissBtn");

let currentPlan = "free";
let selectedPlan = null;

// ====== トースト ======
function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 2500);
}

// ====== タブ切り替え ======
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    historyTab.classList.toggle("hidden", target !== "history");
    settingsTab.classList.toggle("hidden", target !== "settings");
  });
});

document.getElementById("settingsToggle").addEventListener("click", () => {
  document.querySelector('[data-tab="settings"]').click();
});

// ====== 認証 ======
async function checkAuth() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "checkAuth" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("checkAuth error:", chrome.runtime.lastError);
      }
      console.log("Auth check result:", res);
      resolve(res?.loggedIn || false);
    });
  });
}

function showAuth() {
  authScreen.classList.remove("hidden");
  mainApp.classList.add("hidden");
}

function showMain() {
  authScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");
  logoutBtn.style.display = loggedIn ? "inline-flex" : "none";
}

loginBtn.addEventListener("click", () => {
  loginBtn.textContent = "ログイン中...";
  loginBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "signIn" }, (res) => {
    loginBtn.textContent = "Googleでログイン";
    loginBtn.disabled = false;

    if (chrome.runtime.lastError) {
      const errMsg = `通信エラー: ${chrome.runtime.lastError.message}`;
      console.error("signIn error:", errMsg);
      showToast(errMsg, "error");
    } else if (res?.error) {
      console.error("signIn error:", res.error);
      showToast(res.error, "error");
    } else if (res?.success) {
      loggedIn = true;
      userEmail.textContent = res.user.email;
      showMain();
      loadUsage();
      loadHistory();
    }
  });
});

anonymousBtn.addEventListener("click", () => {
  loggedIn = false;
  userEmail.textContent = "匿名ユーザー";
  showMain();
  loadUsage();
  loadHistory();
});

logoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "signOut" }, () => {
    loggedIn = false;
    showAuth();
  });
});

// ====== 利用状況 ======
function loadUsage() {
  chrome.runtime.sendMessage({ type: "getUsage" }, (res) => {
    if (res && !res.error) {
      usageBadge.textContent = `${res.used} / ${res.limit}`;
    }
  });
}

// ====== 履歴 ======
function loadHistory() {
  chrome.runtime.sendMessage({ type: "getHistory" }, (res) => {
    if (!res || res.error) return;
    renderHistory(res.history);
  });
}

function renderHistory(history) {
  historyList.innerHTML = "";

  if (!history || history.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  history.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const modeLabel = item.mode === "translate" ? "翻訳" : "辞書";
    const modeClass = item.mode === "translate" ? "translate" : "dictionary";

    const time = new Date(item.timestamp);
    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;

    li.innerHTML = `
      <span class="history-mode ${modeClass}">${modeLabel}</span>
      <div class="history-input">${escapeHtml(item.input)}</div>
      <div class="history-output">${escapeHtml(item.output)}</div>
      <div class="history-time">${timeStr}</div>
    `;

    historyList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ====== 設定 ======
function loadSettings() {
  chrome.storage.sync.get(
    { outputLang: "ja", uiLang: "ja", historyLimit: 30 },
    (data) => {
      outputLang.value = data.outputLang;
      uiLang.value = data.uiLang;
      historyLimit.value = String(data.historyLimit);
    }
  );
}

saveSettingsBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      outputLang: outputLang.value,
      uiLang: uiLang.value,
      historyLimit: Number(historyLimit.value),
    },
    () => showToast("設定を保存しました", "success")
  );
});

// ====== デバッグ情報表示 ======
async function showDebugInfo() {
  const debugRes = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "checkAuth" }, (res) => {
      resolve(res || {});
    });
  });

  const html = `
    <div style="background: #fff; padding: 10px; border-radius: 4px;">
      <div><strong>設定状態:</strong></div>
      <div>• API Base: ${debugRes.debug?.apiBase || 'unknown'}</div>
      <div>• Firebase API Key: ${debugRes.debug?.firebaseApiKey || 'unknown'}</div>
      <div style="margin-top: 8px;"><strong>ログイン状態:</strong></div>
      <div>• ログイン済み: ${debugRes.loggedIn ? 'はい ✓' : 'いいえ'}</div>
      ${debugRes.error ? `<div style="color: red;">• エラー: ${debugRes.error}</div>` : ''}
      <div style="margin-top: 8px; font-size: 11px; color: #999;">
        設定が「未設定」の場合、background.jsを確認してください。
      </div>
    </div>
  `;
  debugInfo.innerHTML = html;
}

debugBtn.addEventListener("click", () => {
  debugBtn.textContent = "確認中...";
  debugBtn.disabled = true;
  showDebugInfo().then(() => {
    debugBtn.textContent = "設定確認";
    debugBtn.disabled = false;
    document.querySelector('[data-tab="settings"]').click();
  });
});

// ====== プラン管理 ======
async function loadPlanInfo() {
  const res = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getSubscriptionStatus" }, (response) => {
      resolve(response || {});
    });
  });

  currentPlan = res.plan || "free";

  const planDefs = {
    free: { name: "無料", limit: "1日10回" },
    pro: { name: "Pro", limit: "月1,000クレジット" },
    pro_plus: { name: "Pro+", limit: "月3,000クレジット" },
    byok: { name: "BYOK", limit: "無制限" },
  };

  const planDef = planDefs[currentPlan] || planDefs.free;
  const remaining = res.remaining || 0;

  planInfo.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="font-weight: 600; margin-bottom: 4px;">現在のプラン: <span style="color: #4a90d9;">${planDef.name}</span></div>
      <div style="font-size: 12px; color: #666;">月間制限: ${planDef.limit}</div>
      <div style="font-size: 12px; color: #666;">使用状況: ${res.used || 0}${typeof remaining === "number" ? ` / ${res.limit || 0}` : ""}</div>
    </div>
  `;
}

changePlanBtn.addEventListener("click", () => {
  planModal.classList.remove("hidden");
  document.querySelectorAll(".plan-card").forEach((card) => {
    card.style.borderColor = card.dataset.plan === currentPlan ? "#4a90d9" : "#ddd";
  });
});

document.querySelectorAll(".plan-card").forEach((card) => {
  card.addEventListener("click", () => {
    selectedPlan = card.dataset.plan;
    document.querySelectorAll(".plan-card").forEach((c) => {
      c.style.borderColor = "#ddd";
    });
    card.style.borderColor = "#4a90d9";
  });
});

planConfirmBtn.addEventListener("click", () => {
  if (!selectedPlan) {
    showToast("プランを選択してください", "error");
    return;
  }

  if (selectedPlan === currentPlan) {
    planModal.classList.add("hidden");
    showToast("既に選択されているプランです", "info");
    return;
  }

  // 未ログインの場合はログインを促す
  if (!loggedIn) {
    planModal.classList.add("hidden");
    showAuth();
    showToast("プラン変更にはログインが必要です", "error");
    return;
  }

  planConfirmBtn.textContent = "処理中...";
  planConfirmBtn.disabled = true;

  chrome.runtime.sendMessage(
    { type: "createCheckoutSession", planId: selectedPlan },
    (res) => {
      planConfirmBtn.textContent = "選択";
      planConfirmBtn.disabled = false;
      planModal.classList.add("hidden");

      if (res?.error) {
        showToast("エラー: " + res.error, "error");
      } else if (res?.url) {
        // Stripe Checkout へ
        chrome.tabs.create({ url: res.url });
        showToast("プラン変更ページを開きました", "success");
      }
    }
  );
});

planCancelBtn.addEventListener("click", () => {
  planModal.classList.add("hidden");
});

// BYOK設定
byokSetupBtn.addEventListener("click", () => {
  byokModal.classList.remove("hidden");
  byokApiKeyInput.value = "";
});

byokConfirmBtn.addEventListener("click", () => {
  const apiKey = byokApiKeyInput.value.trim();
  if (!apiKey) {
    showToast("APIキーを入力してください", "error");
    return;
  }

  byokConfirmBtn.textContent = "検証中...";
  byokConfirmBtn.disabled = true;

  chrome.runtime.sendMessage(
    { type: "validateBYOKKey", apiKey },
    (res) => {
      byokConfirmBtn.textContent = "保存";
      byokConfirmBtn.disabled = false;

      if (res?.error) {
        showToast("APIキーが無効です: " + res.error, "error");
      } else if (res?.success) {
        byokModal.classList.add("hidden");
        currentPlan = "byok";
        loadPlanInfo();
        showToast("BYOKが有効化されました", "success");
      }
    }
  );
});

byokCancelBtn.addEventListener("click", () => {
  byokModal.classList.add("hidden");
});

// アップセルダイアログ（無料枠超過時）
function showUpsellModal() {
  upsellModal.classList.remove("hidden");
}

upsellUpgradeBtn.addEventListener("click", () => {
  upsellModal.classList.add("hidden");
  changePlanBtn.click();
});

upsellDismissBtn.addEventListener("click", () => {
  upsellModal.classList.add("hidden");
});

// ====== 初期化 ======
async function init() {
  loadSettings();
  await showDebugInfo();

  const loggedIn = await checkAuth();
  if (loggedIn) {
    showMain();
    loadUsage();
    loadHistory();
  } else {
    showAuth();
  }
}

// 履歴の自動更新（ストレージ変更を監視）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.history) {
    renderHistory(changes.history.newValue || []);
  }
});

init();
