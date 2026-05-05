# Webapp Builder Skill

Build a modern, single-page webapp with a landing page and a tool page. Uses Tailwind CSS + 11ty (Eleventy) for static site generation. Supports light/dark mode, view persistence on refresh, and links to a GitHub repo.

## Tech Stack

- **11ty (Eleventy)** — static site generator, handles layouts and page composition
- **Tailwind CSS** — utility-first CSS, compiled via PostCSS
- **esbuild** — bundles JS modules
- **CSS variables** — powers the theme system (dark default, toggleable light mode)
- **localStorage** — persists theme choice and current view across refreshes

## Project Structure

```
├── src/
│   ├── _includes/
│   │   ├── base.njk          # Shared layout: head, nav, theme script, footer
│   │   ├── landing.njk       # Landing page sections
│   │   └── tool.njk          # Tool/dashboard page
│   ├── css/
│   │   └── styles.css        # Tailwind entry + theme variables + custom components
│   ├── js/
│   │   ├── main.js           # Entry point: exports functions to window
│   │   ├── ui.js             # View switching, theme toggle, localStorage persistence
│   │   └── tool.js           # Tool-specific logic (replace per project)
│   └── index.njk             # Composes landing + tool pages
├── assets/                   # SVGs, favicons, images
├── .eleventy.js              # 11ty config
├── tailwind.config.js
├── postcss.config.js
├── build.js                  # Production build: CSS + JS + copy assets
└── package.json
```

## Key Patterns

### Theme System (CSS Variables)

Define colors as CSS custom properties in `:root`. Dark mode is default. `html.light-mode` overrides them.

```css
@layer base {
  :root {
    --ink: #060e16;
    --ink-light: #001a2e;
    --cyan: #22d3ee;
    --cyan-dim: rgba(34, 211, 238, 0.08);
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    /* ... */
  }

  html.light-mode {
    --ink: #f8fafc;
    --ink-light: #ffffff;
    --cyan: #0891b2;
    --cyan-dim: rgba(8, 145, 178, 0.08);
    --text-primary: #0f172a;
    --text-secondary: #475569;
    /* ... */
  }
}
```

Tailwind config maps these to a custom color palette so utilities like `bg-ink`, `text-cyan`, `border-border-subtle` work.

### View Persistence

Store the current view in `localStorage` when switching pages. Restore on page load.

```js
// ui.js
export function showTool() {
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('toolPage').style.display = 'block';
  localStorage.setItem('myapp-view', 'tool');
}

export function showLanding() {
  document.getElementById('toolPage').style.display = 'none';
  document.getElementById('landingPage').style.display = 'block';
  localStorage.setItem('myapp-view', 'landing');
}

export function initializeApp() {
  // ... theme setup ...
  const savedView = localStorage.getItem('myapp-view');
  if (savedView === 'tool') showTool();
}
```

### Light/Dark Mode Toggle

```js
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
  updateLightModeAssets(); // swap SVGs, etc.
}
```

### SVG Assets for Both Themes

Create two versions of theme-sensitive SVGs:
- `assets/hero.svg` — dark mode (bright cyan on dark bg)
- `assets/hero-light.svg` — light mode (darker cyan on white bg, higher opacities)

Swap via JS when theme changes:

```js
function updateLightModeAssets() {
  const img = document.getElementById('heroImg');
  if (!img) return;
  const isLight = document.documentElement.classList.contains('light-mode');
  img.src = isLight ? 'assets/hero-light.svg' : 'assets/hero.svg';
}
```

### Shared Nav

Fixed top nav with:
- Logo + app name (links to landing)
- Nav links (scroll to sections on landing, or switch view if on tool page)
- "Open Tool" CTA button
- Theme toggle button

Nav links that need to work from either page:
```js
export function scrollToFeatures() {
  showLanding();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });
  });
}
```

### Build Process

The `build.js` script:
1. Compiles Tailwind CSS: `npx tailwindcss -i src/css/styles.css -o dist/styles.css --minify`
2. Bundles JS with esbuild: `esbuild src/js/main.js --bundle --minify --outfile=dist/main.js`
3. Runs 11ty to generate HTML: `npx @11ty/eleventy --output=dist`
4. Copies `assets/` to `dist/assets/`

### package.json scripts

```json
{
  "scripts": {
    "build": "node build.js",
    "dev": "npx @11ty/eleventy --serve --watch",
    "dev:css": "npx tailwindcss -i src/css/styles.css -o dist/styles.css --watch"
  }
}
```

## Creating a New Project

1. Copy this skill's template folder
2. Update `package.json` name and metadata
3. Customize `tailwind.config.js` colors and fonts
4. Write landing page content in `src/_includes/landing.njk`
5. Write tool logic in `src/js/tool.js`
6. Add tool UI in `src/_includes/tool.njk`
7. Generate favicons from logo SVG
8. Create dark + light versions of any hero/illustration SVGs
9. Update GitHub link in nav
10. Run `npm install && npm run build`

## Conciseness Rules

- Keep the CSS file minimal: only theme variables, keyframes, and dynamic JS-generated classes go in `@layer components`. Everything else is Tailwind utilities in the HTML.
- Use 11ty includes to compose pages — no duplicated markup.
- One shared `base.njk` layout for `<head>`, nav, and footer.
- Tool-specific JS lives in its own module; only expose needed functions to `window` in `main.js`.
