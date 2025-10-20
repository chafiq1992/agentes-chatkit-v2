"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction, type ChatKitPanelHandle } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useState, useRef } from "react";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [responses, setResponses] = useState<{ outputs: unknown[]; full: unknown; text?: string }[]>([]);
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

  const handleResponseJSON = useCallback((payload: { outputs: unknown[]; full: unknown; text?: string }) => {
    setResponses((prev) => [payload, ...prev]);
  }, []);

  return (
    <main className="relative min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Reserve left column (25vw). Sidebar stays open */}
      <div className="absolute inset-y-0 left-0 z-20 w-[25vw]">
        <div className="h-full">
          <div className="absolute inset-y-0 left-0 w-[25vw] transition-transform duration-300 ease-in-out shadow-xl border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">Chat</div>
            <div className="px-3 pb-3">
              <ChatKitPanel
                ref={panelRef}
                theme={scheme}
                onWidgetAction={handleWidgetAction}
                onResponseEnd={handleResponseEnd}
                onThemeRequest={setScheme}
                onResponseJSON={handleResponseJSON}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content occupies remaining 75% width and is never covered */}
      <div className="ml-[25vw] p-4 lg:pl-[2rem]">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="mb-4 text-xl font-semibold text-slate-800 dark:text-slate-100">Results</h1>
          <div className="space-y-6">
            {/* Response cards captured from ChatKit logs */}
            {responses.map((resp, idx) => (
              <div key={idx} className="space-y-4">
                {/* Primary text card */}
                {resp.text ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assistant Response {responses.length - idx}</div>
                      <button
                        onClick={() => {
                          try {
                            void navigator.clipboard.writeText(resp.text ?? "");
                          } catch {}
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{resp.text}</div>
                  </div>
                ) : null}

                {/* Extracted JSON outputs card(s) */}
                {Array.isArray(resp.outputs) && resp.outputs.length > 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Extracted Output</div>
                      <button
                        onClick={() => {
                          try {
                            void navigator.clipboard.writeText(JSON.stringify(resp.outputs, null, 2));
                          } catch {}
                        }}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950"
                      >
                        Copy JSON
                      </button>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800 dark:text-slate-100">
{JSON.stringify(resp.outputs, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
