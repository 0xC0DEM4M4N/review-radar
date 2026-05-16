const STORAGE_KEY = 'reviewradar-column-widths';

function getSavedWidths() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveWidths(widths) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
}

function createHandle(th, key) {
  const handle = document.createElement('div');
  handle.className = 'rr-resize-handle';
  handle.dataset.colKey = key;

  let startX;
  let startWidth;
  let moved = false;

  const beginDrag = (clientX) => {
    startX = clientX;
    startWidth = th.offsetWidth;
    moved = false;
    th.dataset.rrDragging = 'true';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    th.classList.add('rr-resizing');
  };

  const doDrag = (clientX) => {
    const delta = clientX - startX;
    if (Math.abs(delta) > 1) moved = true;
    const newWidth = Math.max(30, startWidth + delta);
    th.style.width = newWidth + 'px';
  };

  const endDrag = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    th.classList.remove('rr-resizing');

    if (moved) {
      // Keep suppression flag active long enough to catch the synthetic click
      setTimeout(() => {
        th.dataset.rrDragging = 'false';
      }, 100);

      const widths = {};
      document.querySelectorAll('#prTable thead th').forEach((header) => {
        const colKey = header.dataset.col;
        if (colKey && header.style.width) {
          widths[colKey] = parseInt(header.style.width, 10);
        }
      });
      saveWidths(widths);
    } else {
      th.dataset.rrDragging = 'false';
    }
  };

  const onMouseMove = (e) => doDrag(e.pageX);
  const onMouseUp = () => endDrag();
  const onTouchMove = (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      doDrag(e.touches[0].pageX);
    }
  };
  const onTouchEnd = () => endDrag();

  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    beginDrag(e.pageX);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  handle.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      e.preventDefault();
      beginDrag(e.touches[0].pageX);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }
  });

  th.appendChild(handle);
}

export function initColumnResizer() {
  const table = document.getElementById('prTable');
  if (!table) return;

  const headers = table.querySelectorAll('thead th');
  const savedWidths = getSavedWidths();

  headers.forEach((th) => {
    const colKey = th.dataset.col;
    if (!colKey) return;

    // Apply saved width if present
    if (savedWidths[colKey]) {
      th.style.width = savedWidths[colKey] + 'px';
    }

    // Capture-phase click listener suppresses sorting during / just after a drag
    th.addEventListener(
      'click',
      (e) => {
        if (th.dataset.rrDragging === 'true') {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true,
    );

    // Add resize handle to every column except the very last one
    const isLast = th === headers[headers.length - 1];
    if (!isLast) {
      createHandle(th, colKey);
    }
  });
}
