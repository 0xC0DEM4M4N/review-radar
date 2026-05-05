export function showDashboard() {
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('dashboardPage').style.display = 'block';
  window.scrollTo(0, 0);
  localStorage.setItem('myapp-view', 'dashboard');
}

export function showLanding() {
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('landingPage').style.display = 'block';
  window.scrollTo(0, 0);
  localStorage.setItem('myapp-view', 'landing');
}

export function scrollToFeatures() {
  showLanding();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

export function scrollToHowItWorks() {
  showLanding();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

export function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.classList.contains('light-mode');

  if (!isLight) {
    html.classList.add('light-mode');
    html.classList.remove('dark-mode');
    localStorage.setItem('myapp-theme', 'light');
  } else {
    html.classList.remove('light-mode');
    html.classList.add('dark-mode');
    localStorage.setItem('myapp-theme', 'dark');
  }
  updateThemeIcon();
  updateHeroImage();
}

export function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isLight = document.documentElement.classList.contains('light-mode');
  btn.textContent = isLight ? '☀️' : '🌙';
  btn.title = isLight ? 'Light mode — click for dark' : 'Dark mode — click for light';
}

export function updateHeroImage() {
  const img = document.getElementById('heroImg');
  if (!img) return;
  const isLight = document.documentElement.classList.contains('light-mode');
  img.src = isLight ? 'assets/hero-light.svg' : 'assets/hero.svg';
}

export function initializeApp() {
  const savedTheme = localStorage.getItem('myapp-theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
    document.documentElement.classList.remove('dark-mode');
  } else {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
    if (!savedTheme) {
      localStorage.setItem('myapp-theme', 'dark');
    }
  }
  updateThemeIcon();
  updateHeroImage();

  const savedView = localStorage.getItem('myapp-view');
  if (savedView === 'dashboard') {
    showDashboard();
  }
}
