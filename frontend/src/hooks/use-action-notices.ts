import { useCallback, useEffect, useState } from "react";

export type ActionNoticeTone = "success" | "error";

export interface ActionNotice {
  id: number;
  title: string;
  message: string;
  tone: ActionNoticeTone;
}

export function useActionNotices() {
  const [actionNotices, setActionNotices] = useState<ActionNotice[]>([]);

  useEffect(() => {
    if (actionNotices.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActionNotices((current) => current.slice(1));
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [actionNotices]);

  const pushActionNotice = useCallback(
    (title: string, message: string, tone: ActionNoticeTone) => {
      setActionNotices((current) => [
        ...current,
        {
          id: Date.now() + current.length,
          title,
          message,
          tone,
        },
      ]);
    },
    [],
  );

  return {
    actionNotices,
    pushActionNotice,
  };
}
