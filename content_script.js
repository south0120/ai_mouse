let popup = null;
const MAX_INPUT_LENGTH = 200;

// 現在のUI言語（保存設定から取得、変更を監視）
let uiT = (typeof getI18n === "function" ? getI18n("ja") : null);
chrome.storage.sync.get({ uiLang: "ja" }, (d) => {
  uiT = getI18n(d.uiLang);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.uiLang) {
    uiT = getI18n(changes.uiLang.newValue);
  }
});

function removePopup() {
  if (popup) {
    if (popup._resizeObserver) popup._resizeObserver.disconnect();
    popup.remove();
    popup = null;
  }
}

function adjustPopupPosition(el, anchorRect) {
  // maxWidthをビューポートに合わせて再計算
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const cap = Math.min(400, viewportW - margin * 2);
  el.style.maxWidth = `${cap}px`;

  const popupRect = el.getBoundingClientRect();

  // 縦：上にはみ出すなら下側へ
  if (popupRect.top < margin) {
    el.style.top = `${anchorRect.bottom + margin}px`;
    el.style.transform = "translateX(-50%)";
  }

  // 縦：下にもはみ出すならビューポート内に強制
  const reRect = el.getBoundingClientRect();
  if (reRect.bottom > viewportH - margin) {
    const newTop = Math.max(margin, viewportH - margin - reRect.height);
    el.style.top = `${newTop}px`;
    el.style.transform = el.style.transform.replace("translateY(-100%)", "");
  }

  // 横：左にはみ出す
  const horizRect = el.getBoundingClientRect();
  if (horizRect.left < margin) {
    el.style.left = `${margin}px`;
    el.style.right = "auto";
    el.style.transform = el.style.transform.replace("translateX(-50%)", "");
  }
  // 横：右にはみ出す
  const horizRect2 = el.getBoundingClientRect();
  if (horizRect2.right > viewportW - margin) {
    el.style.left = "auto";
    el.style.right = `${margin}px`;
    el.style.transform = el.style.transform.replace("translateX(-50%)", "");
  }
}

function createPopup(rect) {
  const el = document.createElement("div");
  el._anchorRect = rect;
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
    maxWidth: `${Math.min(400, window.innerWidth - 16)}px`,
    minWidth: "120px",
    overflow: "hidden",
    boxSizing: "border-box",
  });
  document.documentElement.appendChild(el);

  // 初回補正
  requestAnimationFrame(() => adjustPopupPosition(el, rect));

  // コンテンツ変化を監視して再補正
  const observer = new ResizeObserver(() => {
    if (el.isConnected && el._anchorRect) {
      adjustPopupPosition(el, el._anchorRect);
    }
  });
  observer.observe(el);
  el._resizeObserver = observer;

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

function showCompletionBadge(toolbar, mode, isError, payload) {
  toolbar.replaceChildren();
  Object.assign(toolbar.style, {
    justifyContent: "space-between",
    alignItems: "center",
  });

  const badge = document.createElement("span");
  Object.assign(badge.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: isError ? "#f88" : "#7ed957",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  });
  const labels = uiT || getI18n("ja");
  badge.appendChild(createSvgIcon(isError ? "cross" : "check", 14));
  const txt = document.createElement("span");
  if (isError) {
    txt.textContent = mode === "translate" ? labels.translateFailed : labels.searchFailed;
  } else {
    txt.textContent = mode === "translate" ? labels.translateDone : labels.searchDone;
  }
  badge.appendChild(txt);
  toolbar.appendChild(badge);

  // 辞書モード成功時は単語帳追加ボタンを併置
  if (!isError && mode === "dictionary" && payload) {
    const saveBtn = document.createElement("button");
    saveBtn.textContent = labels.addToVocab;
    Object.assign(saveBtn.style, {
      background: "#f5b50a",
      color: "#1a1a2e",
      border: "none",
      borderRadius: "5px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: "700",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    saveBtn.style.display = "inline-flex";
    saveBtn.style.alignItems = "center";
    saveBtn.style.gap = "4px";
    // SVGスター
    saveBtn.replaceChildren();
    saveBtn.appendChild(createSvgIcon("starOutline", 12));
    const labelSpan = document.createElement("span");
    labelSpan.textContent = labels.addToVocab;
    saveBtn.appendChild(labelSpan);

    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      saveBtn.disabled = true;
      chrome.runtime.sendMessage(
        { type: "addVocab", payload },
        (res) => {
          if (res?.error) {
            saveBtn.disabled = false;
            saveBtn.style.background = "#f88";
            saveBtn.replaceChildren();
            const errSpan = document.createElement("span");
            errSpan.textContent = res.error;
            saveBtn.appendChild(errSpan);
          } else {
            saveBtn.style.background = "#7ed957";
            saveBtn.replaceChildren();
            saveBtn.appendChild(createSvgIcon("star", 12));
            const okSpan = document.createElement("span");
            okSpan.textContent = labels.addedToVocab;
            saveBtn.appendChild(okSpan);
          }
        }
      );
    });
    toolbar.appendChild(saveBtn);
  }
}

function handleAIQuery(text, mode, popup, toolbar) {
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
  const labels = uiT || getI18n("ja");
  resultArea.textContent = labels.loading;
  resultArea.style.color = "#ddd";

  chrome.storage.sync.get({ outputLang: "ja" }, (settings) => {
    chrome.runtime.sendMessage(
      { type: "queryAI", text, mode, outputLang: settings.outputLang },
      (res) => {
        if (chrome.runtime.lastError) {
          resultArea.textContent = labels.commError;
          resultArea.style.color = "#f88";
          if (toolbar) showCompletionBadge(toolbar, mode, true);
        } else if (res.error) {
          resultArea.textContent = res.error;
          resultArea.style.color = "#f88";
          if (toolbar) showCompletionBadge(toolbar, mode, true);

          // 無料枠超過時：アップグレードボタン表示
          if (res.error.includes("無料枠") || res.error.includes("月間クレジット") || /quota|monthly credit/i.test(res.error)) {
            const actionBtn = document.createElement("button");
            actionBtn.textContent = labels.upgradeToPro;
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
          const vocabPayload = {
            sourceInput: text,
            answer: res.answer,
            outputLang: settings.outputLang || "ja",
          };
          if (toolbar) showCompletionBadge(toolbar, mode, false, vocabPayload);

          // 残り回数を表示
          if (res.remaining !== undefined) {
            const remainTag = document.createElement("div");
            Object.assign(remainTag.style, {
              fontSize: "10px",
              color: "#888",
              marginTop: "6px",
              textAlign: "right",
            });
            remainTag.textContent = labels.remainingFmt({ remaining: res.remaining, plan: res.plan });
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
            creditTag.textContent = labels.creditUsed(res.creditUsed);
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

  // 文字数（英語UIのときはワード数も併記）
  const counter = document.createElement("span");
  const labels = uiT || getI18n("ja");
  counter.textContent = labels.countLabel({
    chars: text.length,
    words: countWords(text),
  });
  Object.assign(counter.style, {
    fontSize: "11px",
    color: overLimit ? "#f88" : "#aaa",
    whiteSpace: "nowrap",
  });
  if (overLimit) {
    counter.textContent += labels.overLimitSuffix(MAX_INPUT_LENGTH);
  }

  // ボタンコンテナ
  const btnGroup = document.createElement("div");
  Object.assign(btnGroup.style, {
    display: "flex",
    gap: "6px",
  });

  // 辞書ボタン
  const dictBtn = createModeButton(labels.dict, "#4a90d9", overLimit);
  dictBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (overLimit) return;
    dictBtn.disabled = true;
    transBtn.disabled = true;
    dictBtn.textContent = labels.searching;
    dictBtn.style.background = "#666";
    handleAIQuery(text, "dictionary", popup, toolbar);
  });

  // 翻訳ボタン
  const transBtn = createModeButton(labels.translate, "#3cb371", overLimit);
  transBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (overLimit) return;
    transBtn.disabled = true;
    dictBtn.disabled = true;
    transBtn.textContent = labels.translating;
    transBtn.style.background = "#666";
    handleAIQuery(text, "translate", popup, toolbar);
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
