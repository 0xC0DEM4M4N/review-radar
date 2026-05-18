'use client';

import { useEffect, useState } from 'react';

export default function LoadingIllustration({ width = 240, height = 160 }: { width?: number; height?: number }) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light-mode'));
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains('light-mode'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={isLight ? '/assets/typing-dev-light.svg' : '/assets/typing-dev.svg'}
      width={width}
      height={height}
      alt="Loading..."
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
