let popup = null;
const MAX_INPUT_LENGTH = 200;

function removePopup() {
  if (popup) {
    popup.remove();
    popup = null;
  }
}

function createPopup(rect) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 8}px`,
    transform: "translate(-50%, -100%)",
    background: "#1a1a2e",
    color: "#eee",
    borderRadius: "10px",
    fontSize: "13px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    zIndex: "2147483647",
    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    maxWidth: "400px",
    minWidth: "120px",
    overflow: "hidden",
  });
  document.documentElement.appendChild(el);

  // 画面外にはみ出す場合の補正
  requestAnimationFrame(() => {
    const popupRect = el.getBoundingClientRect();
    if (popupRect.top < 4) {
      el.style.top = `${rect.bottom + 8}px`;
      el.style.transform = "translateX(-50%)";
    }
    if (popupRect.left < 4) {
      el.style.left = "8px";
      el.style.transform = el.style.transform.replace("translateX(-50%)", "");
    }
    if (popupRect.right > window.innerWidth - 4) {
      el.style.left = "auto";
      el.style.right = "8px";
      el.style.transform = el.style.transform.replace("translateX(-50%)", "");
    }
  });

  return el;
}

function createModeButton(label, color, disabled) {
  const btn = document.createElement("button");
  btn.textContent = label;
  const isDisabled = disabled;
  Object.assign(btn.style, {
    background: isDisabled ? "#444" : color,
    color: isDisabled ? "#777" : "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    cursor: isDisabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    fontWeight: "bold",
    transition: "background 0.15s",
  });
  btn.disabled = isDisabled;

  if (!isDisabled) {
    const hoverColor = color === "#4a90d9" ? "#3a7bc8" : "#2e8b57";
    btn.addEventListener("mouseenter", () => { btn.style.background = hoverColor; });
    btn.addEventListener("mouseleave", () => { btn.style.background = color; });
  }

  return btn;
}

function handleAIQuery(text, mode, popup) {
  // 結果表示エリア
  let resultArea = popup.querySelector(".ai-result");
  if (!resultArea) {
    resultArea = document.createElement("div");
    resultArea.className = "ai-result";
    Object.assign(resultArea.style, {
      padding: "10px 12px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
      fontSize: "13px",
      lineHeight: "1.6",
      color: "#ddd",
      maxHeight: "240px",
      overflowY: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });
    popup.appendChild(resultArea);
  }
  resultArea.textContent = "読み込み中...";
  resultArea.style.color = "#ddd";

  chrome.storage.sync.get({ outputLang: "ja" }, (settings) => {
    chrome.runtime.sendMessage(
      { type: "queryAI", text, mode, outputLang: settings.outputLang },
      (res) => {
        if (chrome.runtime.lastError) {
          resultArea.textContent = "エラー: 拡張機能との通信に失敗しました";
          resultArea.style.color = "#f88";
        } else if (res.error) {
          resultArea.textContent = res.error;
          resultArea.style.color = "#f88";

          // 無料枠超過時：アップグレードボタン表示
          if (res.error.includes("無料枠") || res.error.includes("月間クレジット")) {
            const actionBtn = document.createElement("button");
            actionBtn.textContent = "Proにアップグレード";
            Object.assign(actionBtn.style, {
              marginTop: "8px",
              width: "100%",
              padding: "8px",
              background: "#ff9800",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: "bold",
            });
            actionBtn.addEventListener("click", () => {
              chrome.runtime.openOptionsPage();
            });
            resultArea.appendChild(actionBtn);
          }
        } else {
          resultArea.textContent = res.answer;
          resultArea.style.color = "#ddd";

          // 残り回数を表示
          if (res.remaining !== undefined) {
            const remainTag = document.createElement("div");
            Object.assign(remainTag.style, {
              fontSize: "10px",
              color: "#888",
              marginTop: "6px",
              textAlign: "right",
            });
            remainTag.textContent = `残り ${res.remaining} 回 / ${res.plan === "free" ? "今日" : "月間"}`;
            resultArea.appendChild(remainTag);
          }

          // 使用クレジット表示（有料ユーザー向け）
          if (res.creditUsed && res.plan !== "free") {
            const creditTag = document.createElement("div");
            Object.assign(creditTag.style, {
              fontSize: "10px",
              color: "#888",
              marginTop: "3px",
              textAlign: "right",
            });
            creditTag.textContent = `消費: ${res.creditUsed} クレジット`;
            resultArea.appendChild(creditTag);
          }
        }
      }
    );
  });
}

document.addEventListener("mouseup", (e) => {
  if (popup && popup.contains(e.target)) return;
  removePopup();

  const selection = window.getSelection();
  const text = selection.toString().trim();
  if (!text) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  popup = createPopup(rect);

  const overLimit = text.length > MAX_INPUT_LENGTH;

  // ツールバー部分
  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    gap: "8px",
  });

  // 文字数カウント
  const counter = document.createElement("span");
  counter.textContent = `${text.length} 文字`;
  Object.assign(counter.style, {
    fontSize: "11px",
    color: overLimit ? "#f88" : "#aaa",
    whiteSpace: "nowrap",
  });
  if (overLimit) {
    counter.textContent += ` (上限${MAX_INPUT_LENGTH})`;
  }

  // ボタンコンテナ
  const btnGroup = document.createElement("div");
  Object.assign(btnGroup.style, {
    display: "flex",
    gap: "6px",
  });

  // 辞書ボタン
  const dictBtn = createModeButton("辞書", "#4a90d9", overLimit);
  dictBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (overLimit) return;
    dictBtn.disabled = true;
    transBtn.disabled = true;
    dictBtn.textContent = "検索中...";
    dictBtn.style.background = "#666";
    handleAIQuery(text, "dictionary", popup);
  });

  // 翻訳ボタン
  const transBtn = createModeButton("翻訳", "#3cb371", overLimit);
  transBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (overLimit) return;
    transBtn.disabled = true;
    dictBtn.disabled = true;
    transBtn.textContent = "翻訳中...";
    transBtn.style.background = "#666";
    handleAIQuery(text, "translate", popup);
  });

  btnGroup.appendChild(dictBtn);
  btnGroup.appendChild(transBtn);

  toolbar.appendChild(counter);
  toolbar.appendChild(btnGroup);
  popup.appendChild(toolbar);
});

document.addEventListener("mousedown", (e) => {
  if (popup && !popup.contains(e.target)) {
    removePopup();
  }
});
