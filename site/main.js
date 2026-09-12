const languageButton = document.querySelector(".language-switch");
const translatable = document.querySelectorAll("[data-ja][data-en]");

function setLanguage(language) {
  const isEnglish = language === "en";
  document.documentElement.lang = language;
  document.title = isEnglish ? "Storia — Turn sparks into stories." : "Storia — 思いつきを、物語へ。";
  document.querySelector('meta[name="description"]').content = isEnglish
    ? "Storia is a desktop writing app for growing stories by connecting ideas, drafts, foreshadowing, and revision history."
    : "Storiaは、アイデア、原稿、伏線、改稿履歴をつなぎながら物語を育てるデスクトップ執筆アプリです。";
  translatable.forEach((element) => { element.innerHTML = element.dataset[language]; });
  languageButton.textContent = isEnglish ? "日本語" : "EN";
  languageButton.setAttribute("aria-pressed", String(isEnglish));
  try { localStorage.setItem("storia.site.locale", language); } catch {}
}

let preferredLanguage = "ja";
try { preferredLanguage = localStorage.getItem("storia.site.locale") || (navigator.language.startsWith("ja") ? "ja" : "en"); } catch {}
setLanguage(preferredLanguage);
languageButton.addEventListener("click", () => setLanguage(document.documentElement.lang === "ja" ? "en" : "ja"));
