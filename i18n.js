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
    tabHistory: "履歴",
    tabSettings: "設定",
    noHistory: "まだ履歴がありません",
    outputLangSection: "出力言語",
    outputLangLabel: "AIの回答言語",
    uiLangSection: "サイドパネル言語",
    uiLangLabel: "UI言語",
    historySection: "履歴",
    historyLimitLabel: "保存件数",
    historyItemsSuffix: "件",
    saveSettings: "設定を保存",
    saveSettingsDone: "設定を保存しました",
    debugInfoSection: "🔧 デバッグ情報",
    planSection: "💳 プラン管理",
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
    searchDone: "✓ 検索完了",
    translateDone: "✓ 翻訳完了",
    searchFailed: "✕ 検索失敗",
    translateFailed: "✕ 翻訳失敗",
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
    tabHistory: "History",
    tabSettings: "Settings",
    noHistory: "No history yet",
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
    planSection: "💳 Plan",
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
    searchDone: "✓ Search complete",
    translateDone: "✓ Translation complete",
    searchFailed: "✕ Search failed",
    translateFailed: "✕ Translation failed",
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

// CommonJSとブラウザの両対応（content scriptは直接window使用）
if (typeof window !== "undefined") {
  window.I18N = I18N;
  window.getI18n = getI18n;
  window.countWords = countWords;
}
