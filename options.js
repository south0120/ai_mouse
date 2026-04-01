const providerEl = document.getElementById("provider");
const apiKeyEl = document.getElementById("apiKey");
const providerInfo = document.getElementById("providerInfo");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const toast = document.getElementById("toast");

const INFO = {
  gemini: {
    model: "gemini-2.0-flash",
    url: "https://aistudio.google.com/apikey",
    note: "Google AI StudioでAPIキーを取得できます",
  },
  openai: {
    model: "gpt-4o-mini",
    url: "https://platform.openai.com/api-keys",
    note: "OpenAIダッシュボードでAPIキーを取得できます",
  },
  anthropic: {
    model: "claude-haiku-4-5",
    url: "https://console.anthropic.com/settings/keys",
    note: "AnthropicコンソールでAPIキーを取得できます",
  },
};

// プロバイダー情報表示
providerEl.addEventListener("change", () => {
  const info = INFO[providerEl.value];
  if (info) {
    providerInfo.innerHTML =
      `使用モデル: <code>${info.model}</code><br>${info.note}`;
  } else {
    providerInfo.innerHTML = "";
  }
});

// 設定を読み込み
chrome.storage.sync.get({ provider: "", apiKey: "" }, (data) => {
  providerEl.value = data.provider;
  apiKeyEl.value = data.apiKey;
  providerEl.dispatchEvent(new Event("change"));
});

// トースト表示
function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 2500);
}

// 保存
saveBtn.addEventListener("click", () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();

  if (!provider) { showToast("プロバイダーを選択してください", "error"); return; }
  if (!apiKey) { showToast("APIキーを入力してください", "error"); return; }

  chrome.storage.sync.set({ provider, apiKey }, () => {
    showToast("設定を保存しました", "success");
  });
});

// 接続テスト
testBtn.addEventListener("click", () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();

  if (!provider || !apiKey) {
    showToast("プロバイダーとAPIキーを入力してください", "error");
    return;
  }

  // 先に設定を保存してからテスト
  chrome.storage.sync.set({ provider, apiKey }, () => {
    testBtn.textContent = "テスト中...";
    testBtn.disabled = true;

    chrome.runtime.sendMessage({ type: "queryAI", text: "テスト" }, (res) => {
      testBtn.textContent = "接続テスト";
      testBtn.disabled = false;

      if (chrome.runtime.lastError) {
        showToast("通信エラー: " + chrome.runtime.lastError.message, "error");
      } else if (res.error) {
        showToast("エラー: " + res.error, "error");
      } else {
        showToast("接続成功！", "success");
      }
    });
  });
});
