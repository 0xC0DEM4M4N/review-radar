import {
  scrollToFeatures,
  scrollToHowItWorks,
  loadPRs,
  toggleTheme,
  toggleAutoRefresh,
  toggleNotifications,
  clearChangesNotif,
  updateRefreshInterval,
  loadSavedRepos,
  initializeApp,
  addRepoManually,
  showMessage,
  showPatInput,
  hidePatInput,
  savePatToken,
  toggleHelpText,
  openSettingsModal,
  closeSettingsModal,
  openStatusReport,
  closeStatusReport,
} from './ui.js';
import { setFilter, clearSort, sortTable } from './render.js';
import {
  toggleRepoDropdown,
  filterRepoList,
  selectAllRepos,
  clearRepoSelection,
  toggleRepoSelection,
  updateRepoSelectorText,
  renderRepoList,
  closeRepoDropdown,
} from './repoSelector.js';

window.scrollToFeatures = scrollToFeatures;
window.scrollToHowItWorks = scrollToHowItWorks;
window.loadPRs = loadPRs;
window.toggleTheme = toggleTheme;
window.toggleAutoRefresh = toggleAutoRefresh;
window.toggleNotifications = toggleNotifications;
window.clearChangesNotif = clearChangesNotif;
window.updateRefreshInterval = updateRefreshInterval;
window.addRepoManually = addRepoManually;
window.showPatInput = showPatInput;
window.hidePatInput = hidePatInput;
window.savePatToken = savePatToken;
window.toggleHelpText = toggleHelpText;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openStatusReport = openStatusReport;
window.closeStatusReport = closeStatusReport;
window.setFilter = setFilter;
window.clearSort = clearSort;
window.sortTable = sortTable;
window.toggleRepoDropdown = toggleRepoDropdown;
window.filterRepoList = filterRepoList;
window.selectAllRepos = selectAllRepos;
window.clearRepoSelection = clearRepoSelection;
window.toggleRepoSelection = toggleRepoSelection;
window.updateRepoSelectorText = updateRepoSelectorText;
window.renderRepoList = renderRepoList;
window.closeRepoDropdown = closeRepoDropdown;

window.addEventListener('load', initializeApp);
