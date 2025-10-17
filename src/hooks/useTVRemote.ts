import { useEffect, useRef } from 'react';

interface TVRemoteHook {
  focusedElement: HTMLElement | null;
  setFocusedElement: (element: HTMLElement | null) => void;
}

export const useTVRemote = (): TVRemoteHook => {
  const focusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentElement = focusedElementRef.current;
      if (!currentElement) return;

      const focusableElements = Array.from(
        document.querySelectorAll('.tv-focusable, button, [tabindex]:not([tabindex="-1"])')
      ) as HTMLElement[];

      const currentIndex = focusableElements.indexOf(currentElement);

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          const upIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
          focusableElements[upIndex]?.focus();
          break;

        case 'ArrowDown':
          event.preventDefault();
          const downIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
          focusableElements[downIndex]?.focus();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          const leftIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
          focusableElements[leftIndex]?.focus();
          break;

        case 'ArrowRight':
          event.preventDefault();
          const rightIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
          focusableElements[rightIndex]?.focus();
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          currentElement.click();
          break;

        case 'Backspace':
        case 'Escape':
          event.preventDefault();
          // Ana menüye dön
          const backButton = document.querySelector('[data-tv-back]') as HTMLElement;
          backButton?.click();
          break;
      }
    };

    const handleFocus = (event: FocusEvent) => {
      focusedElementRef.current = event.target as HTMLElement;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocus);

    // İlk focusable elementi focus et
    const firstFocusable = document.querySelector('.tv-focusable, button, [tabindex]:not([tabindex="-1"])') as HTMLElement;
    firstFocusable?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);

  return {
    focusedElement: focusedElementRef.current,
    setFocusedElement: (element: HTMLElement | null) => {
      focusedElementRef.current = element;
    }
  };
};
