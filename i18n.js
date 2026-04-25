// 共有翻訳テーブル
const I18N = {
  ja: {
    appName: "AI辞書",
    authIntro: "Googleアカウントでログインして利用できます。<br>ログイン不要の匿名利用なら1日10回まで無料です。",
    signInGoogle: "Googleでログイン",
    continueAnon: "匿名で続行（1日10回）",
    checkSettings: "設定確認",
    settings: "設定",
    signOut: "ログアウト",
    signedInAs: "ログイン中:",
    anonymousUser: "匿名ユーザー",
    notSignedIn: "未ログイン",
    signingIn: "ログイン中…",
    tabHistory: "履歴",
    tabVocab: "単語帳",
    tabSettings: "設定",
    noHistory: "まだ履歴がありません",
    vocabLockedTitle: "単語帳は有料プランの機能です",
    vocabLockedNote: "Pro / Pro+ / BYOK プランで単語帳の保存・エクスポートが可能になります",
    vocabUpgradeBtn: "プランをアップグレード",
    vocabEmpty: "まだ単語帳に追加された語がありません。検索結果から「単語帳へ」をタップしてください",
    vocabSearchPlaceholder: "検索…",
    exportCsv: "CSV",
    exportAnki: "Anki",
    addToVocab: "単語帳へ",
    addedToVocab: "追加済み",
    vocabAdded: "単語帳に追加しました",
    vocabAddFailed: "単語帳への追加に失敗しました",
    vocabRemoved: "単語帳から削除しました",
    vocabExportEmpty: "単語帳が空です",
    vocabRequiresPaid: "有料プランが必要です",
    vocabRemoveBtn: "削除",
    outputLangSection: "出力言語",
    outputLangLabel: "AIの回答言語",
    uiLangSection: "サイドパネル言語",
    uiLangLabel: "UI言語",
    historySection: "履歴",
    historyLimitLabel: "保存件数",
    historyItemsSuffix: "件",
    saveSettings: "設定を保存",
    saveSettingsDone: "設定を保存しました",
    debugInfoSection: "デバッグ情報",
    debugPlanLabel: "プラン上書き（開発用）",
    debugPlanNote: "Stripe webhookが未連携の場合のテスト用。サーバー側プランは変更されません",
    planSection: "プラン管理",
    changePlan: "プラン変更",
    byokSetup: "BYOK設定",
    byokModalTitle: "BYOK設定",
    byokModalIntro: "使用するプロバイダーを選び、APIキーを入力してください",
    byokProviderLabel: "プロバイダー",
    byokApiKeyLabel: "APIキー",
    cancel: "キャンセル",
    validateAndSave: "検証して保存",
    validating: "検証中...",
    keyHelpPrefix: "キー取得: ",
    // Content script
    dict: "辞書",
    translate: "翻訳",
    searching: "検索中...",
    translating: "翻訳中...",
    searchDone: "検索完了",
    translateDone: "翻訳完了",
    searchFailed: "検索失敗",
    translateFailed: "翻訳失敗",
    loading: "読み込み中...",
    commError: "エラー: 拡張機能との通信に失敗しました",
    upgradeToPro: "Proにアップグレード",
    charsLabel: (n) => `${n} 文字`,
    countLabel: ({ chars, words }) => `${chars} 文字`,
    overLimitSuffix: (max) => ` (上限${max})`,
    remainingFmt: ({ remaining, plan }) => `残り ${remaining} 回 / ${plan === "free" ? "今日" : "月間"}`,
    creditUsed: (n) => `消費: ${n} クレジット`,
    historyMode: { translate: "翻訳", dictionary: "辞書" },
  },
  en: {
    appName: "AI Dictionary",
    authIntro: "Sign in with your Google account.<br>Or use anonymously, up to 10 times/day for free.",
    signInGoogle: "Sign in with Google",
    continueAnon: "Continue anonymously (10/day)",
    checkSettings: "Check Settings",
    settings: "Settings",
    signOut: "Sign out",
    signedInAs: "Signed in:",
    anonymousUser: "Anonymous",
    notSignedIn: "Not signed in",
    signingIn: "Signing in…",
    tabHistory: "History",
    tabVocab: "Vocab",
    tabSettings: "Settings",
    noHistory: "No history yet",
    vocabLockedTitle: "Vocabulary is a paid feature",
    vocabLockedNote: "Save and export vocabulary on the Pro / Pro+ / BYOK plans",
    vocabUpgradeBtn: "Upgrade plan",
    vocabEmpty: "No saved words yet. Tap \"Save\" on a result to add one",
    vocabSearchPlaceholder: "Search…",
    exportCsv: "CSV",
    exportAnki: "Anki",
    addToVocab: "Save",
    addedToVocab: "Saved",
    vocabAdded: "Saved to vocabulary",
    vocabAddFailed: "Failed to save",
    vocabRemoved: "Removed from vocabulary",
    vocabExportEmpty: "Vocabulary is empty",
    vocabRequiresPaid: "Paid plan required",
    vocabRemoveBtn: "Delete",
    outputLangSection: "Output Language",
    outputLangLabel: "AI response language",
    uiLangSection: "Side Panel Language",
    uiLangLabel: "UI language",
    historySection: "History",
    historyLimitLabel: "Items to keep",
    historyItemsSuffix: " items",
    saveSettings: "Save settings",
    saveSettingsDone: "Settings saved",
    debugInfoSection: "🔧 Debug Info",
    debugPlanLabel: "Plan override (dev only)",
    debugPlanNote: "For testing without Stripe webhook. Server-side plan is not changed.",
    planSection: "Plan",
    changePlan: "Change plan",
    byokSetup: "BYOK setup",
    byokModalTitle: "BYOK Setup",
    byokModalIntro: "Choose a provider and enter your API key",
    byokProviderLabel: "Provider",
    byokApiKeyLabel: "API key",
    cancel: "Cancel",
    validateAndSave: "Validate & save",
    validating: "Validating...",
    keyHelpPrefix: "Get key: ",
    dict: "Dictionary",
    translate: "Translate",
    searching: "Searching...",
    translating: "Translating...",
    searchDone: "Search complete",
    translateDone: "Translation complete",
    searchFailed: "Search failed",
    translateFailed: "Translation failed",
    loading: "Loading...",
    commError: "Error: failed to communicate with extension",
    upgradeToPro: "Upgrade to Pro",
    charsLabel: (n) => `${n} chars`,
    countLabel: ({ chars, words }) => `${words} words / ${chars} chars`,
    overLimitSuffix: (max) => ` (max ${max})`,
    remainingFmt: ({ remaining, plan }) => `${remaining} left / ${plan === "free" ? "today" : "this month"}`,
    creditUsed: (n) => `Used: ${n} credit${n === 1 ? "" : "s"}`,
    historyMode: { translate: "Translate", dictionary: "Dictionary" },
  },
};

function getI18n(lang) {
  return I18N[lang] || I18N.ja;
}

// 英単語数カウント（簡易）：空白とCJK境界で区切る
function countWords(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[　-〿＀-￯一-鿿぀-ヿ]+/g, " ");
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

// ====== SVGアイコン（要素ごとのpath指定でDOM APIから生成） ======
const SVG_DEFS = {
  google: [["M12 11v3.6h5.1c-.21 1.36-1.55 4-5.1 4-3.07 0-5.58-2.55-5.58-5.69 0-3.14 2.51-5.69 5.58-5.69 1.75 0 2.92.74 3.59 1.38l2.45-2.36C16.46 4.78 14.42 4 12 4 7.58 4 4 7.58 4 12s3.58 8 8 8c4.62 0 7.68-3.25 7.68-7.82 0-.53-.06-.94-.13-1.34L12 11Z"]],
  logout: [
    ["M16 17l5-5-5-5v3H9v4h7v3Z"],
    ["M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9v-2H5V5h9V3Z"],
  ],
  user: [["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-10 1.65-10 5v3h20v-3c0-3.35-6.7-5-10-5Z"]],
  check: [["M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"]],
  cross: [["M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"]],
  star: [["m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z"]],
  starOutline: [["m12 15.4-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4ZM22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24Z"]],
  lock: [["M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-9-2a3 3 0 0 1 6 0v2H9V6Zm9 14H6V10h12v10Z"]],
  tool: [["M22.7 19.3 16 12.6c.7-1.7.4-3.7-1-5.1-1.5-1.5-3.7-1.7-5.4-.7l3.1 3.1-2.1 2.1L7.5 8.9C6.5 10.6 6.7 12.8 8.2 14.3c1.4 1.4 3.4 1.7 5.1 1l6.7 6.7 2.7-2.7Z"]],
  card: [["M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 14H4v-6h16v6Zm0-10H4V6h16v2Z"]],
  download: [["M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z"]],
  trash: [["M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"]],
};

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgIcon(name, size) {
  const s = size || 16;
  const def = SVG_DEFS[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(s));
  svg.setAttribute("height", String(s));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  if (def) {
    def.forEach((d) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d[0]);
      path.setAttribute("fill", "currentColor");
      svg.appendChild(path);
    });
  }
  return svg;
}

// CommonJSとブラウザの両対応（content scriptは直接window使用）
if (typeof window !== "undefined") {
  window.I18N = I18N;
  window.getI18n = getI18n;
  window.countWords = countWords;
  window.createSvgIcon = createSvgIcon;
}
