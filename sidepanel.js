// ====== DOM要素 ======
const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");
const usageBadge = document.getElementById("usageBadge");
const historyList = document.getElementById("historyList");
const emptyState = document.getElementById("emptyState");
const historyTab = document.getElementById("historyTab");
const settingsTab = document.getElementById("settingsTab");
const outputLang = document.getElementById("outputLang");
const uiLang = document.getElementById("uiLang");
const historyLimit = document.getElementById("historyLimit");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const toast = document.getElementById("toast");

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
}

loginBtn.addEventListener("click", () => {
  loginBtn.textContent = "ログイン中...";
  loginBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "signIn" }, (res) => {
    loginBtn.textContent = "Googleでログイン";
    loginBtn.disabled = false;

    if (res?.error) {
      showToast(res.error, "error");
    } else if (res?.success) {
      userEmail.textContent = res.user.email;
      showMain();
      loadUsage();
      loadHistory();
    }
  });
});

logoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "signOut" }, () => {
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

// ====== 初期化 ======
async function init() {
  loadSettings();

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
