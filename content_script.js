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
    if (popup._cleanup) popup._cleanup();
    popup.remove();
    popup = null;
  }
}

// ビューポート内に収まるよう絶対座標で再配置する
function adjustPopupPosition(el, anchorRect) {
  const margin = 8;
  const gap = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // transform解除（純粋な left/top で位置決め）
  el.style.transform = "none";
  el.style.right = "auto";
  el.style.bottom = "auto";

  // 横幅・高さの上限をビューポートで強制
  const maxW = Math.max(120, Math.min(400, viewportW - margin * 2));
  el.style.maxWidth = `${maxW}px`;
  const maxH = Math.max(120, viewportH - margin * 2);
  el.style.maxHeight = `${maxH}px`;
  el.style.overflowY = "auto";

  // 実寸取得
  const r = el.getBoundingClientRect();
  const w = r.width;
  const h = r.height;

  // 横：選択範囲の中央に配置 → 端で詰める
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  let left = anchorCenter - w / 2;
  if (left < margin) left = margin;
  if (left + w > viewportW - margin) left = viewportW - margin - w;
  if (left < margin) left = margin; // ポップアップが画面より広い極端ケース

  // 縦：上に出すスペースが十分なら上、なければ下、両方ダメなら強制クランプ
  const spaceAbove = anchorRect.top - margin;
  const spaceBelow = viewportH - anchorRect.bottom - margin;
  let top;
  if (h + gap <= spaceAbove) {
    top = anchorRect.top - gap - h;
  } else if (h + gap <= spaceBelow) {
    top = anchorRect.bottom + gap;
  } else {
    // 上下とも足りない → より広い側に寄せ、足りない分は内部スクロールで吸収
    if (spaceAbove >= spaceBelow) {
      top = margin;
      el.style.maxHeight = `${Math.max(120, anchorRect.top - margin - gap)}px`;
    } else {
      top = anchorRect.bottom + gap;
      el.style.maxHeight = `${Math.max(120, viewportH - top - margin)}px`;
    }
  }
  // 縦の最終クランプ
  if (top < margin) top = margin;
  if (top + h > viewportH - margin) top = Math.max(margin, viewportH - margin - h);

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function createPopup(rect) {
  const el = document.createElement("div");
  el._anchorRect = rect;
  Object.assign(el.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    background: "#1a1a2e",
    color: "#eee",
    borderRadius: "10px",
    fontSize: "13px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    zIndex: "2147483647",
    boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    maxWidth: `${Math.min(400, window.innerWidth - 16)}px`,
    minWidth: "120px",
    boxSizing: "border-box",
  });
  document.documentElement.appendChild(el);

  // 初回・コンテンツ変化・スクロール・リサイズの全てで再配置
  const reposition = () => {
    if (el.isConnected && el._anchorRect) {
      adjustPopupPosition(el, el._anchorRect);
    }
  };
  requestAnimationFrame(reposition);

  const observer = new ResizeObserver(reposition);
  observer.observe(el);
  el._resizeObserver = observer;

  el._reposition = reposition;
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  el._cleanup = () => {
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };

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

  // 翻訳モードのみ、選択範囲の周辺テキストを取得して文脈ヒントに使う
  let context = "";
  if (mode === "translate") {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let containerNode = range.commonAncestorContainer;
        if (containerNode.nodeType === Node.TEXT_NODE) {
          containerNode = containerNode.parentElement;
        }
        // 親要素の文章を取得し、選択範囲の前後を抽出
        const fullText = (containerNode?.innerText || "").trim();
        if (fullText && fullText.length > text.length) {
          const idx = fullText.indexOf(text);
          if (idx >= 0) {
            const start = Math.max(0, idx - 300);
            const end = Math.min(fullText.length, idx + text.length + 300);
            context = fullText.slice(start, end);
          }
        }
      }
    } catch (_) {}
  }

  chrome.storage.sync.get({ outputLang: "ja" }, (settings) => {
    chrome.runtime.sendMessage(
      { type: "queryAI", text, mode, outputLang: settings.outputLang, context },
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
              chrome.runtime.sendMessage({ type: "openPlanModal" });
            });
            resultArea.appendChild(actionBtn);
          }
        } else {
          const ans = (res.answer || "").trim();
          if (!ans) {
            resultArea.textContent = (uiT && uiT === getI18n("en"))
              ? "No answer was returned. Try a shorter or different selection."
              : "回答が得られませんでした。入力を短く区切るか、別の語で試してください。";
            resultArea.style.color = "#f88";
            if (toolbar) showCompletionBadge(toolbar, mode, true);
            return;
          }
          resultArea.textContent = ans;
          resultArea.style.color = "#ddd";
          const vocabPayload = {
            sourceInput: text,
            answer: ans,
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
