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
const aiProviderEl = document.getElementById("aiProvider");
const byokProviderSelect = document.getElementById("byokProviderSelect");
const byokKeyHelp = document.getElementById("byokKeyHelp");
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
const vocabTabEl = document.getElementById("vocabTab");
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    historyTab.classList.toggle("hidden", target !== "history");
    settingsTab.classList.toggle("hidden", target !== "settings");
    vocabTabEl.classList.toggle("hidden", target !== "vocab");

    if (target === "vocab") renderVocab();
  });
});

// ====== ヘッダーUI ======
const headerSignInBtn = document.getElementById("headerSignInBtn");
const headerUser = document.getElementById("headerUser");
const headerUserEmail = document.getElementById("headerUserEmail");

function setHeaderIcons() {
  // Googleアイコン
  const gIconHost = headerSignInBtn?.querySelector(".header-google-icon");
  if (gIconHost) {
    gIconHost.replaceChildren(createSvgIcon("google", 16));
  }
  // ユーザーアイコン
  const uIconHost = headerUser?.querySelector(".header-user-icon");
  if (uIconHost) {
    uIconHost.replaceChildren(createSvgIcon("user", 16));
  }
  // ログアウトボタン
  if (logoutBtn) {
    logoutBtn.replaceChildren(createSvgIcon("logout", 16));
  }
  // 単語帳ロックアイコン
  const lockHost = document.getElementById("vocabLockIcon");
  if (lockHost) {
    lockHost.replaceChildren(createSvgIcon("lock", 36));
  }
}

function updateHeaderForAuth(isLoggedIn, email) {
  if (isLoggedIn && email) {
    // Googleログイン済み
    headerSignInBtn.classList.add("hidden");
    headerUser.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    headerUserEmail.textContent = email;
    headerUserEmail.title = `${t.signedInAs} ${email}`;
  } else if (email) {
    // 匿名モード（emailは "匿名ユーザー" 等）
    headerSignInBtn.classList.remove("hidden");
    headerUser.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    headerUserEmail.textContent = email;
    headerUserEmail.title = email;
  } else {
    // 未ログイン
    headerSignInBtn.classList.remove("hidden");
    headerUser.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
}

headerSignInBtn?.addEventListener("click", () => {
  loginBtn.click();
});

// ====== 認証 ======
async function checkAuth() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "checkAuth" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error("checkAuth error:", chrome.runtime.lastError);
      }
      console.log("Auth check result:", res);
      if (res?.loggedIn) {
        loggedIn = true;
        if (res.email) userEmail.textContent = res.email;
      } else {
        loggedIn = false;
      }
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
  const stored = userEmail.textContent && userEmail.textContent !== "-" ? userEmail.textContent : "";
  if (loggedIn) {
    updateHeaderForAuth(true, stored);
  } else if (stored === t.anonymousUser || stored === "匿名ユーザー" || stored === "Anonymous") {
    updateHeaderForAuth(false, t.anonymousUser);
  } else {
    updateHeaderForAuth(false, "");
  }
}

loginBtn.addEventListener("click", () => {
  loginBtn.textContent = t.signingIn;
  loginBtn.disabled = true;

  chrome.runtime.sendMessage({ type: "signIn" }, (res) => {
    loginBtn.textContent = t.signInGoogle;
    loginBtn.disabled = false;

    if (chrome.runtime.lastError) {
      const errMsg = `${currentLang === "en" ? "Communication error" : "通信エラー"}: ${chrome.runtime.lastError.message}`;
      console.error("signIn error:", errMsg);
      showToast(errMsg, "error");
    } else if (res?.error) {
      console.error("signIn error:", res.error);
      showToast(res.error, "error");
    } else if (res?.success) {
      loggedIn = true;
      userEmail.textContent = res.user.email;
      updateHeaderForAuth(true, res.user.email);
      showMain();
      loadUsage();
      loadHistory();
      if (typeof loadPlanInfo === "function") loadPlanInfo();
    }
  });
});

anonymousBtn.addEventListener("click", () => {
  loggedIn = false;
  userEmail.textContent = t.anonymousUser;
  updateHeaderForAuth(false, t.anonymousUser);
  showMain();
  loadUsage();
  loadHistory();
});

logoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "signOut" }, () => {
    loggedIn = false;
    userEmail.textContent = "-";
    updateHeaderForAuth(false, "");
    showAuth();
  });
});

// ====== 利用状況 ======
function loadUsage() {
  chrome.runtime.sendMessage({ type: "getUsage" }, (res) => {
    if (res && !res.error) {
      usageBadge.textContent = `${res.used} / ${res.limit}`;
      usageBadge.classList.remove("hidden");
    } else {
      usageBadge.classList.add("hidden");
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

    const modeLabel = t.historyMode[item.mode] || t.historyMode.dictionary;
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

// ====== i18n ======
let currentLang = "ja";
let t = getI18n("ja");

function setHtmlWithBr(el, str) {
  el.replaceChildren();
  const parts = str.split(/<br\s*\/?>/i);
  parts.forEach((part, i) => {
    el.append(document.createTextNode(part));
    if (i < parts.length - 1) el.append(document.createElement("br"));
  });
}

function applyI18n(lang) {
  currentLang = lang;
  t = getI18n(lang);
  document.documentElement.lang = lang;
  document.title = t.appName;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] != null && typeof t[key] === "string") {
      el.textContent = t[key];
    }
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (t[key] != null && typeof t[key] === "string") {
      setHtmlWithBr(el, t[key]);
    }
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (t[key] != null) el.title = t[key];
  });

  // 履歴件数セレクトのサフィックス
  const historyOpts = document.querySelectorAll("#historyLimit option");
  historyOpts.forEach((o) => {
    o.textContent = `${o.value}${t.historyItemsSuffix}`;
  });

  // BYOKボタンのtooltip更新
  if (typeof updateByokButtonState === "function") updateByokButtonState();

  // 単語帳検索プレースホルダー
  const vs = document.getElementById("vocabSearch");
  if (vs) vs.placeholder = t.vocabSearchPlaceholder;

  // 匿名表示の即時翻訳
  if (!loggedIn && headerUserEmail && headerUserEmail.textContent &&
      (headerUserEmail.textContent === "匿名ユーザー" || headerUserEmail.textContent === "Anonymous")) {
    headerUserEmail.textContent = t.anonymousUser;
  }
}

// ====== 設定 ======
function loadSettings() {
  chrome.storage.sync.get(
    {
      outputLang: "ja",
      uiLang: "ja",
      historyLimit: 30,
      aiProvider: "mercury",
    },
    (data) => {
      outputLang.value = data.outputLang;
      uiLang.value = data.uiLang;
      historyLimit.value = String(data.historyLimit);
      if (aiProviderEl) aiProviderEl.value = data.aiProvider || "mercury";
      applyI18n(data.uiLang);
      // デバッグプラン上書き
      chrome.storage.local.get({ debugPlanOverride: "" }, (d) => {
        const sel = document.getElementById("debugPlanOverride");
        if (sel) sel.value = d.debugPlanOverride || "";
      });
    }
  );
}

saveSettingsBtn.addEventListener("click", () => {
  const newLang = uiLang.value;
  const debugPlanEl = document.getElementById("debugPlanOverride");
  const debugPlan = debugPlanEl ? debugPlanEl.value : "";
  chrome.storage.sync.set(
    {
      outputLang: outputLang.value,
      uiLang: newLang,
      historyLimit: Number(historyLimit.value),
      aiProvider: "mercury",
    },
    () => {
      chrome.storage.local.set({ debugPlanOverride: debugPlan }, () => {
        applyI18n(newLang);
        loadHistory();
        loadPlanInfo();
        showToast(t.saveSettingsDone, "success");
      });
    }
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
      <div>• ログイン済み: ${debugRes.loggedIn ? 'はい' : 'いいえ'}</div>
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
function updateByokButtonState() {
  if (!byokSetupBtn) return;
  const enabled = currentPlan === "byok";
  byokSetupBtn.disabled = !enabled;
  byokSetupBtn.style.opacity = enabled ? "1" : "0.5";
  byokSetupBtn.style.cursor = enabled ? "pointer" : "not-allowed";
  byokSetupBtn.title = enabled
    ? ""
    : (currentLang === "en"
        ? "Available only on the BYOK plan"
        : "BYOKプラン契約者のみ利用できます");
}

async function loadPlanInfo() {
  const res = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getSubscriptionStatus" }, (response) => {
      resolve(response || {});
    });
  });

  // デバッグ上書き優先
  const localOverride = await new Promise((resolve) => {
    chrome.storage.local.get({ debugPlanOverride: "" }, (d) => resolve(d.debugPlanOverride || ""));
  });
  currentPlan = localOverride || res.plan || "free";

  const planLabels = currentLang === "en"
    ? {
        free: { name: "Free", limit: "10/day" },
        pro: { name: "Pro", limit: "1,000 credits/month" },
        pro_plus: { name: "Pro+", limit: "3,000 credits/month" },
        byok: { name: "BYOK", limit: "Unlimited" },
      }
    : {
        free: { name: "無料", limit: "1日10回" },
        pro: { name: "Pro", limit: "月1,000クレジット" },
        pro_plus: { name: "Pro+", limit: "月3,000クレジット" },
        byok: { name: "BYOK", limit: "無制限" },
      };

  const planDef = planLabels[currentPlan] || planLabels.free;
  const remaining = res.remaining || 0;

  const labels = currentLang === "en"
    ? { current: "Current plan", limit: "Monthly limit", usage: "Usage" }
    : { current: "現在のプラン", limit: "月間制限", usage: "使用状況" };

  planInfo.replaceChildren();
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "12px";
  const planLine = document.createElement("div");
  planLine.style.fontWeight = "600";
  planLine.style.marginBottom = "4px";
  planLine.append(`${labels.current}: `);
  const planSpan = document.createElement("span");
  planSpan.style.color = "#4a90d9";
  planSpan.textContent = planDef.name;
  planLine.append(planSpan);
  const limitLine = document.createElement("div");
  limitLine.style.cssText = "font-size: 12px; color: #666;";
  limitLine.textContent = `${labels.limit}: ${planDef.limit}`;
  const usageLine = document.createElement("div");
  usageLine.style.cssText = "font-size: 12px; color: #666;";
  usageLine.textContent = `${labels.usage}: ${res.used || 0}${typeof remaining === "number" ? ` / ${res.limit || 0}` : ""}`;
  wrap.append(planLine, limitLine, usageLine);
  planInfo.appendChild(wrap);

  updateByokButtonState();
  if (vocabTabEl && !vocabTabEl.classList.contains("hidden")) renderVocab();
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
const BYOK_PROVIDER_INFO = {
  mercury: {
    placeholder: "sk-...",
    help: "キー取得: <a href='https://platform.inceptionlabs.ai/' target='_blank' rel='noopener'>platform.inceptionlabs.ai</a>",
  },
  gemini: {
    placeholder: "AIzaSy...",
    help: "キー取得: <a href='https://aistudio.google.com/apikey' target='_blank' rel='noopener'>Google AI Studio</a>",
  },
  openai: {
    placeholder: "sk-proj-...",
    help: "キー取得: <a href='https://platform.openai.com/api-keys' target='_blank' rel='noopener'>OpenAI Dashboard</a>",
  },
};

function updateByokFormUI() {
  const provider = byokProviderSelect.value;
  const info = BYOK_PROVIDER_INFO[provider];
  if (!info) return;
  byokApiKeyInput.placeholder = info.placeholder;
  byokKeyHelp.replaceChildren();
  const span = document.createElement("span");
  span.append("キー取得: ");
  const a = document.createElement("a");
  const urlMatch = info.help.match(/href='([^']+)'/);
  const textMatch = info.help.match(/>([^<]+)<\/a>/);
  if (urlMatch && textMatch) {
    a.href = urlMatch[1];
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = textMatch[1];
    span.append(a);
  }
  byokKeyHelp.append(span);
}

byokProviderSelect.addEventListener("change", updateByokFormUI);

byokSetupBtn.addEventListener("click", () => {
  if (currentPlan !== "byok") {
    showToast(
      currentLang === "en"
        ? "Available only on the BYOK plan. Please upgrade your plan."
        : "BYOKプラン契約者のみ利用できます。プラン変更が必要です。",
      "error"
    );
    return;
  }
  chrome.storage.sync.get({ byokProvider: "mercury", byokApiKey: "" }, (data) => {
    byokProviderSelect.value = data.byokProvider || "mercury";
    byokApiKeyInput.value = data.byokApiKey || "";
    updateByokFormUI();
    byokModal.classList.remove("hidden");
  });
});

byokConfirmBtn.addEventListener("click", () => {
  const provider = byokProviderSelect.value;
  const apiKey = byokApiKeyInput.value.trim();
  if (!apiKey) {
    showToast("APIキーを入力してください", "error");
    return;
  }

  byokConfirmBtn.textContent = t.validating;
  byokConfirmBtn.disabled = true;

  chrome.runtime.sendMessage(
    { type: "saveBYOK", provider, apiKey },
    (res) => {
      byokConfirmBtn.textContent = t.validateAndSave;
      byokConfirmBtn.disabled = false;

      if (res?.error) {
        showToast(
          (currentLang === "en" ? "Invalid API key: " : "APIキーが無効です: ") + res.error,
          "error"
        );
      } else if (res?.success) {
        byokModal.classList.add("hidden");
        showToast(
          currentLang === "en"
            ? `BYOK (${provider}) enabled`
            : `BYOK（${provider}）が有効化されました`,
          "success"
        );
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

// ====== 単語帳 ======
const vocabList = document.getElementById("vocabList");
const vocabEmptyState = document.getElementById("vocabEmptyState");
const vocabLockedState = document.getElementById("vocabLockedState");
const vocabUnlockedState = document.getElementById("vocabUnlockedState");
const vocabSearch = document.getElementById("vocabSearch");
const vocabExportCsvBtn = document.getElementById("vocabExportCsvBtn");
const vocabExportAnkiBtn = document.getElementById("vocabExportAnkiBtn");
const vocabUpgradeBtn = document.getElementById("vocabUpgradeBtn");

function isPaidPlan() {
  return currentPlan === "pro" || currentPlan === "pro_plus" || currentPlan === "byok";
}

async function getVocab() {
  const data = await chrome.storage.local.get({ vocabulary: [] });
  return data.vocabulary;
}

async function setVocab(items) {
  await chrome.storage.local.set({ vocabulary: items });
}

async function renderVocab() {
  // プランチェック
  if (!isPaidPlan()) {
    vocabLockedState.classList.remove("hidden");
    vocabUnlockedState.classList.add("hidden");
    return;
  }
  vocabLockedState.classList.add("hidden");
  vocabUnlockedState.classList.remove("hidden");

  const items = await getVocab();
  const q = (vocabSearch.value || "").trim().toLowerCase();
  const filtered = q
    ? items.filter((it) =>
        (it.headword || "").toLowerCase().includes(q) ||
        (it.definition || "").toLowerCase().includes(q)
      )
    : items;

  vocabList.replaceChildren();
  if (filtered.length === 0) {
    vocabEmptyState.classList.remove("hidden");
    return;
  }
  vocabEmptyState.classList.add("hidden");

  filtered.forEach((it) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const head = document.createElement("div");
    head.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:8px;";
    const headword = document.createElement("div");
    headword.style.cssText = "font-weight:600; font-size:14px; flex:1;";
    headword.textContent = it.headword;
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.title = t.vocabRemoveBtn;
    removeBtn.style.cssText = "background:transparent; border:none; color:#999; cursor:pointer; font-size:18px; padding:0 6px;";
    removeBtn.addEventListener("click", async () => {
      const list = await getVocab();
      const idx = list.findIndex((x) => x.id === it.id);
      if (idx >= 0) {
        list.splice(idx, 1);
        await setVocab(list);
        showToast(t.vocabRemoved, "success");
        renderVocab();
      }
    });
    head.append(headword, removeBtn);

    const meta = document.createElement("div");
    meta.style.cssText = "font-size:11px; color:#888; margin:2px 0;";
    meta.textContent = [it.pos, it.outputLang].filter(Boolean).join(" · ");

    const def = document.createElement("div");
    def.className = "history-output";
    def.textContent = it.definition || "";

    const time = document.createElement("div");
    time.className = "history-time";
    if (it.savedAt) {
      const d = new Date(it.savedAt);
      time.textContent = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    li.append(head, meta, def, time);
    vocabList.appendChild(li);
  });
}

vocabSearch.addEventListener("input", renderVocab);
vocabUpgradeBtn.addEventListener("click", () => {
  changePlanBtn.click();
});

// CSVエスケープ
function csvEscape(s) {
  const str = String(s ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// CSVエクスポート
vocabExportCsvBtn.addEventListener("click", async () => {
  if (!isPaidPlan()) {
    showToast(t.vocabRequiresPaid, "error");
    return;
  }
  const items = await getVocab();
  if (items.length === 0) {
    showToast(t.vocabExportEmpty, "error");
    return;
  }
  const header = "headword,part_of_speech,definition,example,output_language,source_input,saved_at\n";
  const rows = items.map((it) =>
    [
      csvEscape(it.headword),
      csvEscape(it.pos),
      csvEscape(it.definition),
      csvEscape(it.example),
      csvEscape(it.outputLang),
      csvEscape(it.sourceInput),
      csvEscape(it.savedAt ? new Date(it.savedAt).toISOString() : ""),
    ].join(",")
  );
  const csv = "﻿" + header + rows.join("\n");
  downloadFile("ai-mouse-vocabulary.csv", "text/csv;charset=utf-8", csv);
});

// Anki TSVエクスポート（front=headword, back=definition + example）
vocabExportAnkiBtn.addEventListener("click", async () => {
  if (!isPaidPlan()) {
    showToast(t.vocabRequiresPaid, "error");
    return;
  }
  const items = await getVocab();
  if (items.length === 0) {
    showToast(t.vocabExportEmpty, "error");
    return;
  }
  const lines = items.map((it) => {
    const front = it.headword || "";
    const backParts = [];
    if (it.pos) backParts.push(`<i>${escapeHtml(it.pos)}</i>`);
    if (it.definition) backParts.push(escapeHtml(it.definition));
    if (it.example) backParts.push(`<small>${escapeHtml(it.example)}</small>`);
    const back = backParts.join("<br>");
    // タブと改行をエスケープ
    return `${front.replace(/\t/g, " ")}\t${back.replace(/\t/g, " ").replace(/\n/g, "<br>")}`;
  });
  downloadFile("ai-mouse-anki.tsv", "text/tab-separated-values;charset=utf-8", lines.join("\n"));
});

function downloadFile(name, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ====== 初期化 ======
async function init() {
  setHeaderIcons();
  loadSettings();
  await showDebugInfo();

  const isLoggedIn = await checkAuth();
  if (isLoggedIn) {
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
