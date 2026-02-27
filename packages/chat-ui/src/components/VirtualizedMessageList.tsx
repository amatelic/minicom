"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message, ParticipantRole } from "@minicom/chat-core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { MessageBubble } from "./MessageBubble";

export interface VirtualizedMessageListProps {
  ariaLabel: string;
  messages: Message[];
  viewerRole: ParticipantRole;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  onLoadOlder: () => Promise<void> | void;
  onRetry?: (clientId: string) => void;
  emptyStateCopy?: string;
}

interface AnchorState {
  prevScrollHeight: number;
  prevMessageCount: number;
}

const TOP_FETCH_THRESHOLD_PX = 120;
const BOTTOM_STICKY_THRESHOLD_PX = 80;

export const VirtualizedMessageList = ({
  ariaLabel,
  messages,
  viewerRole,
  hasOlder,
  isFetchingOlder,
  onLoadOlder,
  onRetry,
  emptyStateCopy = "No messages yet.",
}: VirtualizedMessageListProps) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [hasUnseenLatest, setHasUnseenLatest] = useState(false);
  const previousMessageCountRef = useRef(messages.length);
  const hasInitialSnapRef = useRef(false);
  const prependAnchorRef = useRef<AnchorState | null>(null);
  const skipNextAutoFollowRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const shouldScrollToBottomRef = useRef(false);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const updateBottomState = useCallback(() => {
    const node = parentRef.current;
    if (!node) {
      return;
    }

    const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
    setNearBottom(distanceFromBottom <= BOTTOM_STICKY_THRESHOLD_PX);
  }, []);

  const loadOlder = useCallback(async () => {
    if (!hasOlder || isFetchingOlder || loadingOlderRef.current) {
      return;
    }

    const node = parentRef.current;
    if (!node) {
      return;
    }

    loadingOlderRef.current = true;
    prependAnchorRef.current = {
      prevScrollHeight: node.scrollHeight,
      prevMessageCount: messages.length,
    };

    try {
      await onLoadOlder();
    } finally {
      loadingOlderRef.current = false;
    }
  }, [hasOlder, isFetchingOlder, messages.length, onLoadOlder]);

  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    if (!anchor) {
      return;
    }

    const node = parentRef.current;
    if (!node) {
      return;
    }

    const delta = node.scrollHeight - anchor.prevScrollHeight;
    node.scrollTop = node.scrollTop + delta;

    if (messages.length > anchor.prevMessageCount) {
      skipNextAutoFollowRef.current = true;
    }

    prependAnchorRef.current = null;
    updateBottomState();
  }, [messages.length, updateBottomState]);

  const prefersReducedMotionRef = useRef(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (!messages.length) {
      hasInitialSnapRef.current = false;
      return;
    }

    if (hasInitialSnapRef.current) {
      return;
    }

    const scrollToLatest = () => {
      rowVirtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: "auto",
      });
    };

    if (typeof window === "undefined") {
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    let rafWait = 0;

    const finalizeInitialSnap = () => {
      // Variable-height rows may settle over multiple frames; perform a short
      // multi-frame snap sequence so initial open reliably lands on latest.
      scrollToLatest();
      previousMessageCountRef.current = messages.length;
      setHasUnseenLatest(false);
      hasInitialSnapRef.current = true;

      raf1 = window.requestAnimationFrame(() => {
        scrollToLatest();
        raf2 = window.requestAnimationFrame(() => {
          scrollToLatest();
          updateBottomState();
        });
      });
    };

    const waitUntilVisibleAndSnap = () => {
      const node = parentRef.current;
      if (!node || node.clientHeight <= 0) {
        rafWait = window.requestAnimationFrame(waitUntilVisibleAndSnap);
        return;
      }

      finalizeInitialSnap();
    };

    waitUntilVisibleAndSnap();

    return () => {
      window.cancelAnimationFrame(rafWait);
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [messages.length, rowVirtualizer, updateBottomState]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    if (messages.length <= previousCount) {
      return;
    }

    const shouldSkipAutoFollow = skipNextAutoFollowRef.current;
    skipNextAutoFollowRef.current = false;
    previousMessageCountRef.current = messages.length;

    if (shouldSkipAutoFollow) {
      return;
    }

    // Determine if the newest message is from the current viewer
    const newestMessage = messages[messages.length - 1];
    const isNewMessageFromViewer = newestMessage?.senderRole === viewerRole;

    // Check scroll position directly from DOM to avoid stale state
    const node = parentRef.current;
    if (node) {
      const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
      const isNearBottomNow = distanceFromBottom <= BOTTOM_STICKY_THRESHOLD_PX;

      // Always scroll if user sent the message, or if already near bottom
      if (isNewMessageFromViewer || isNearBottomNow) {
        // Defer scroll to layout effect - it will check when the last item is rendered
        shouldScrollToBottomRef.current = true;
        setHasUnseenLatest(false);
        return;
      }
    }

    setHasUnseenLatest(true);
  }, [messages.length, rowVirtualizer, viewerRole, messages]);

  useEffect(() => {
    if (nearBottom && hasUnseenLatest) {
      setHasUnseenLatest(false);
    }
  }, [hasUnseenLatest, nearBottom]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottomRef.current || !messages.length) {
      return;
    }

    const lastVirtualItem = virtualItems[virtualItems.length - 1];
    if (!lastVirtualItem || lastVirtualItem.index !== messages.length - 1) {
      return;
    }

    shouldScrollToBottomRef.current = false;
    rowVirtualizer.scrollToIndex(messages.length - 1, {
      align: "end",
      behavior: prefersReducedMotionRef.current ? "auto" : "smooth",
    });
  }, [virtualItems, messages.length, rowVirtualizer]);

  const markUserInteracted = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  const onScroll = useCallback(() => {
    updateBottomState();
    const node = parentRef.current;
    if (!node) {
      return;
    }

    const currentScrollTop = node.scrollTop;
    const previousScrollTop = lastScrollTopRef.current;
    const isScrollingUp = currentScrollTop <= previousScrollTop;

    if (
      hasUserInteractedRef.current &&
      isScrollingUp &&
      currentScrollTop <= TOP_FETCH_THRESHOLD_PX
    ) {
      void loadOlder();
    }

    lastScrollTopRef.current = currentScrollTop;
  }, [loadOlder, updateBottomState]);

  const jumpToLatest = useCallback(() => {
    if (!messages.length) {
      return;
    }

    rowVirtualizer.scrollToIndex(messages.length - 1, {
      align: "end",
      behavior: prefersReducedMotionRef.current ? "auto" : "smooth",
    });
    setHasUnseenLatest(false);
  }, [messages.length, rowVirtualizer]);

  const totalSize = rowVirtualizer.getTotalSize();

  const listBody = useMemo(() => {
    if (!messages.length) {
      return (
        <div className="flex min-h-full items-center justify-center p-4">
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">{emptyStateCopy}</p>
        </div>
      );
    }

    return (
      <div
        style={{
          height: totalSize,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          if (!message) {
            return null;
          }

          return (
            <div
              key={`${message.threadId}:${message.clientId || message.id}`}
              data-index={virtualItem.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
                paddingInline: "12px",
                paddingBlock: "6px",
              }}
            >
              <MessageBubble message={message} viewerRole={viewerRole} onRetry={onRetry} />
            </div>
          );
        })}
      </div>
    );
  }, [emptyStateCopy, messages, onRetry, totalSize, viewerRole, virtualItems, rowVirtualizer]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={parentRef}
        role="log"
        aria-live="polite"
        aria-label={ariaLabel}
        onScroll={onScroll}
        onWheel={markUserInteracted}
        onTouchMove={markUserInteracted}
        onPointerDown={markUserInteracted}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {isFetchingOlder ? (
          <div className="px-3 py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Loading older messages...
          </div>
        ) : null}
        {listBody}
      </div>

      {hasUnseenLatest ? (
        <button
          type="button"
          className="cursor-pointer absolute right-3 bottom-3 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-md hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-zinc-500"
          onClick={jumpToLatest}
        >
          Jump to latest
        </button>
      ) : null}
    </section>
  );
};
