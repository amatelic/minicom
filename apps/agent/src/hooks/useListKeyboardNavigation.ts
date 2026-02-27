"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface UseListKeyboardNavigationOptions<T> {
  items: T[];
  activeId: string | null;
  getItemId: (item: T) => string;
  onSelect: (id: string) => void;
  itemRefs: React.MutableRefObject<(HTMLElement | null)[]>;
}

interface UseListKeyboardNavigationReturn {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  handleFocus: () => void;
  handleItemClick: (index: number, id: string) => void;
  handleItemMouseEnter: (index: number) => void;
}

export function useListKeyboardNavigation<T>({
  items,
  activeId,
  getItemId,
  onSelect,
  itemRefs,
}: UseListKeyboardNavigationOptions<T>): UseListKeyboardNavigationReturn {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const activeIndex = useMemo(
    () => items.findIndex((item) => getItemId(item) === activeId),
    [activeId, items, getItemId],
  );

  // Keep focused index in sync with externally active item.
  useEffect(() => {
    if (activeIndex >= 0) {
      queueMicrotask(() => {
        setFocusedIndex(activeIndex);
      });
      return;
    }

    queueMicrotask(() => {
      setFocusedIndex(-1);
    });
  }, [activeIndex]);

  // Clamp focus when the list shrinks.
  useEffect(() => {
    queueMicrotask(() => {
      setFocusedIndex((previousIndex) => {
        if (items.length === 0) {
          return -1;
        }

        if (previousIndex < 0) {
          return previousIndex;
        }

        return Math.min(previousIndex, items.length - 1);
      });
    });
  }, [items.length]);

  // Scroll focused item into view
  useEffect(() => {
    const element = itemRefs.current[focusedIndex];
    if (focusedIndex >= 0 && element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex, itemRefs]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!items.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const baseIndex =
          focusedIndex >= 0
            ? Math.min(focusedIndex, items.length - 1)
            : activeIndex >= 0
              ? activeIndex
              : -1;
        const nextIndex = Math.min(baseIndex + 1, items.length - 1);
        if (nextIndex >= 0) {
          setFocusedIndex(nextIndex);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const baseIndex =
          focusedIndex >= 0
            ? Math.min(focusedIndex, items.length - 1)
            : activeIndex >= 0
              ? activeIndex
              : 0;
        const nextIndex = Math.max(baseIndex - 1, 0);
        setFocusedIndex(nextIndex);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedIndex =
          focusedIndex >= 0
            ? Math.min(focusedIndex, items.length - 1)
            : activeIndex >= 0
              ? activeIndex
              : 0;
        const selected = items[selectedIndex >= 0 ? selectedIndex : 0];
        if (selected) {
          onSelect(getItemId(selected));
        }
      }
    },
    [focusedIndex, activeIndex, items, onSelect, getItemId],
  );

  const handleFocus = useCallback(() => {
    if (focusedIndex < 0 && activeIndex >= 0) {
      setFocusedIndex(activeIndex);
    } else if (focusedIndex < 0 && items.length > 0) {
      setFocusedIndex(0);
    }
  }, [focusedIndex, activeIndex, items.length]);

  const handleItemClick = useCallback(
    (index: number, id: string) => {
      setFocusedIndex(index);
      onSelect(id);
    },
    [onSelect],
  );

  const handleItemMouseEnter = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    handleFocus,
    handleItemClick,
    handleItemMouseEnter,
  };
}
