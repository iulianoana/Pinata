export const C = {
  bg: "#F0FAF8", card: "#FFFFFF", accent: "#00B4A0", accentLight: "#E0F5F1",
  accentHover: "#008F7E", text: "#1A2F2B", muted: "#5E8078", success: "#00C48C",
  successLight: "#E0F8F0", error: "#FF6584", errorLight: "#FFF0F3",
  border: "#D4F0EB", inputBg: "#F0FAF8", overlay: "rgba(26, 47, 43, 0.45)",
  quiz: "#8B5CF6", quizLight: "#EDE9FE", quizHover: "#7C3AED",
  unitQuiz: "#3B82F6", unitQuizLight: "#DBEAFE",
  amber: "#F59E0B", amberLight: "#FFFBEB", amberDark: "#92400E",
};

export const injectStyles = () => {
  if (document.getElementById("sq-styles")) return;
  const s = document.createElement("style");
  s.id = "sq-styles";
  s.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #F0FAF8; font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif; color: #1A2F2B; -webkit-font-smoothing: antialiased; padding-bottom: env(safe-area-inset-bottom, 0); overflow-x: hidden; }
    h1, h2, h3, h4 { font-family: 'Nunito', sans-serif; font-weight: 800; }
    input[type="text"], textarea { font-family: 'Nunito', sans-serif; }
    ::placeholder { color: #B0E0D8; }
    .fade-in { animation: fadeIn 0.4s ease-out both; }
    .slide-in-right { animation: slideInRight 0.3s ease-out both; }
    .slide-in-left { animation: slideInLeft 0.3s ease-out both; }
    .slide-up { animation: slideUp 0.3s ease-out both; }
    .score-anim { animation: countUp 0.6s 0.5s ease-out both; }
    .skeleton { background: linear-gradient(90deg, #D4F0EB 25%, #E8F7F4 50%, #D4F0EB 75%); background-size: 600px 100%; animation: shimmer 1.8s infinite ease-in-out; border-radius: 8px; }
    .skeleton-glow { animation: skeletonGlow 2s infinite ease-in-out; }
    @keyframes skeletonGlow { 0%, 100% { box-shadow: 0 0 8px rgba(0, 180, 160, 0.08), 0 1px 4px rgba(0,60,50,0.06); } 50% { box-shadow: 0 0 20px rgba(0, 180, 160, 0.18), 0 4px 12px rgba(0,60,50,0.08); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scoreReveal { from { stroke-dashoffset: 339.292; } }
    @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
    @keyframes confettiDrop { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg); opacity: 0; } }
    @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes overlayFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes progressGrow { from { width: 0%; } }
    @keyframes progressIndeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
    .progress-indeterminate { animation: progressIndeterminate 1.5s ease-in-out infinite; }
    @keyframes syncPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    @keyframes syncSpin { to { transform: rotate(360deg); } }
    .safe-top { padding-top: max(16px, env(safe-area-inset-top, 16px)) !important; }
    .safe-top-fixed { top: env(safe-area-inset-top, 12px) !important; }
    .app-container { max-width: 520px; margin: 0 auto; width: 100%; }
    .app-header-inner { max-width: 520px; margin: 0 auto; }
    .quiz-grid { display: flex; flex-direction: column; gap: 12px; }
    .history-list { display: flex; flex-direction: column; gap: 10px; }
    @media (min-width: 768px) {
      .app-container { max-width: 700px; }
      .app-header-inner { max-width: 700px; }
      .quiz-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    }
    @media (min-width: 1200px) {
      .app-container { max-width: 860px; }
      .app-header-inner { max-width: 860px; }
    }
    /* Desktop sidebar layout (>=1024px) */
    .desktop-sidebar { display: none !important; }
    .desktop-in-progress-pill { display: none !important; }
    .add-quiz-btn-desktop { display: none; }
    /* Lessons feature */
    .new-week-btn-desktop { display: none !important; }
    .fab-new-week { display: flex; }
    .lesson-delete-hover { display: none; }
    mark { background: #B0E0D8; color: #1A2F2B; padding: 1px 2px; border-radius: 3px; }
    /* Lesson Reader PDF panel (default = mobile) */
    .pdf-side-panel-desktop { display: none !important; }
    .pdf-section-inline { display: block; }
    @media (min-width: 1024px) {
      .desktop-sidebar { display: flex !important; }
      .desktop-main { margin-left: 220px; max-width: calc(100% - 220px); }
      .desktop-header-fixed { left: 220px !important; margin-left: 0 !important; padding-left: 40px !important; padding-right: 40px !important; }
      .mobile-tab-bar { display: none !important; }
      .app-container { width: auto; max-width: 100%; padding-left: 40px !important; padding-right: 40px !important; }
      .app-header-inner { max-width: 100%; }
      .quiz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
      .history-list { max-width: 700px; }
      .desktop-in-progress-pill { display: inline-block !important; }
      .add-quiz-btn-mobile { display: none !important; }
      .add-quiz-btn-desktop { display: flex !important; }
      .quiz-home-btn { display: none !important; }
      .quiz-desktop-header { display: flex !important; }
      /* Lessons desktop overrides */
      .fab-new-week { display: none !important; }
      .new-week-btn-desktop { display: flex !important; }
      .lesson-delete-hover { display: inline !important; }
      .lesson-reader-container { padding-top: 8px !important; max-width: 860px; }
      .lesson-reader-wrapper { height: 100vh; overflow: hidden; }
      .lesson-reader-root { height: 100% !important; min-height: 0 !important; display: flex !important; flex-direction: column; }
      .lesson-reader-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }
      .lesson-reader-scroll { flex: 1; overflow-y: auto; min-width: 0; }
      .pdf-side-panel-desktop { display: block !important; flex-shrink: 0; }
      .pdf-section-inline { display: none !important; }
      .quiz-sidebar-desktop { display: flex !important; flex-direction: column; flex-shrink: 0; width: 320px; overflow-y: auto; border-left: 1px solid #D4F0EB; background: #FFFFFF; }
      .quiz-section-mobile { display: none !important; }
      .lesson-reader-panel-open.lesson-reader-container { max-width: 100% !important; }
      .lessons-footer-text { display: none; }
    }
    @media (min-width: 1400px) {
      .app-container { padding-left: 60px !important; padding-right: 60px !important; }
      .desktop-header-fixed { padding-left: 60px !important; padding-right: 60px !important; }
    }
    /* Quizzes aggregated page */
    .quizzes-page { padding: 16px 20px 100px; }
    .quizzes-grid { display: flex; flex-direction: column; gap: 12px; }
    .quizzes-meta-text { display: none; }
    .filter-chips-scroll { overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
    .filter-chips-scroll::-webkit-scrollbar { display: none; }
    .mobile-nav-bar { display: flex; }
    @media (min-width: 768px) {
      .quizzes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    }
    @media (min-width: 1024px) {
      .quizzes-page { padding: 16px 40px 40px; }
      .quizzes-grid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
      .quizzes-meta-text { display: inline !important; }
      .mobile-nav-bar { display: none !important; }
    }
    @media (min-width: 1400px) {
      .quizzes-page { padding: 16px 60px 40px; }
    }
  `;
  document.head.appendChild(s);
};
