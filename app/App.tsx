"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction, type ChatKitPanelHandle } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useState, useRef } from "react";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [responses, setResponses] = useState<{ outputs: unknown[]; full: unknown }[]>([]);
  const panelRef = useRef<ChatKitPanelHandle | null>(null);

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[ChatKitPanel] widget action", action);
    }
  }, []);

  const handleResponseEnd = useCallback(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ChatKitPanel] response end");
    }
  }, []);

  const handleResponseJSON = useCallback((payload: { outputs: unknown[]; full: unknown }) => {
    setResponses((prev) => [payload, ...prev]);
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl p-4">
        <ChatKitPanel
          ref={panelRef}
          theme={scheme}
          onWidgetAction={handleWidgetAction}
          onResponseEnd={handleResponseEnd}
          onThemeRequest={setScheme}
          onResponseJSON={handleResponseJSON}
        />
      </div>
    </main>
  );
}
