import {
  showDashboard,
  showLanding,
  scrollToFeatures,
  scrollToHowItWorks,
  toggleTheme,
  initializeApp,
} from './ui.js';

window.showDashboard = showDashboard;
window.showLanding = showLanding;
window.scrollToFeatures = scrollToFeatures;
window.scrollToHowItWorks = scrollToHowItWorks;
window.toggleTheme = toggleTheme;

window.addEventListener('load', initializeApp);
