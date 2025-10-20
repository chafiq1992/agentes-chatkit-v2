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
    <main className="relative min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Reserve left column (25vw). Sidebar slides within its own space */}
      <div className="absolute inset-y-0 left-0 z-20 w-[25vw]">
        <div className="group h-full">
          <div className="absolute inset-y-0 left-0 w-[25vw] translate-x-[-80%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out shadow-xl border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const data = panelRef.current?.getLastResults();
                  if (!data) return;
                  setResponses((prev) => [data, ...prev]);
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Fetch Latest Results
              </button>
            </div>
            {responses.map((resp, idx) => (
              <div key={idx} className="space-y-4">
                {/* Outputs-only cards */}
                {resp.outputs && resp.outputs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {resp.outputs.map((obj, j) => (
                      <div key={j} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Output #{j + 1} (Response {responses.length - idx})</div>
                          <button
                            onClick={() => {
                              try {
                                void navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
                              } catch {}
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-100">{JSON.stringify(obj, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    No structured outputs detected for this response. Full logs below.
                  </div>
                )}

                {/* Full response card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Full Response {responses.length - idx}</div>
                    <button
                      onClick={() => {
                        try {
                          void navigator.clipboard.writeText(JSON.stringify(resp.full, null, 2));
                        } catch {}
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-100">{JSON.stringify(resp.full, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
