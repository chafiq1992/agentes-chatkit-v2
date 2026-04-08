"use client";

import { useCallback, useState, useRef } from "react";
import { ChatKitPanel, type FactAction, type ChatKitPanelHandle } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";
import { OutputPanel } from "@/components/OutputPanel";

export default function App() {
  const { scheme, setScheme } = useColorScheme();
  const [responses, setResponses] = useState<{ outputs: unknown[]; full: unknown; text?: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const panelRef = useRef<ChatKitPanelHandle | null>(null);

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[App] widget action", action);
    }
  }, []);

  const handleResponseStart = useCallback(() => {
    setIsProcessing(true);
  }, []);

  const handleResponseEnd = useCallback(() => {
    setIsProcessing(false);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[App] response end");
    }
  }, []);

  const handleResponseJSON = useCallback((payload: { outputs: unknown[]; full: unknown; text?: string }) => {
    setResponses((prev) => [payload, ...prev]);
    setIsProcessing(false);
  }, []);

  const handleClear = useCallback(() => {
    setResponses([]);
  }, []);

  return (
    <main
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background)",
        position: "relative",
      }}
    >
      {/* ── Chat Panel (Left) ───────────────────────────── */}
      <div
        className="panel-collapsible"
        style={{
          position: "relative",
          width: chatCollapsed ? 48 : "30vw",
          minWidth: chatCollapsed ? 48 : 320,
          maxWidth: chatCollapsed ? 48 : 480,
          height: "100%",
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
          flexShrink: 0,
          overflowY: chatCollapsed ? "hidden" : undefined,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={() => setChatCollapsed((v) => !v)}
          className="panel-toggle-btn"
          title={chatCollapsed ? "Expand chat" : "Collapse chat"}
          style={{
            position: "absolute",
            top: 14,
            right: -14,
            zIndex: 40,
          }}
        >
          {chatCollapsed ? "▶" : "◀"}
        </button>

        {/* Collapsed mini-sidebar */}
        {chatCollapsed && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 52,
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                cursor: "pointer",
              }}
              onClick={() => setChatCollapsed(false)}
              title="Open chat"
            >
              💬
            </div>
          </div>
        )}

        {/* Chat content */}
        <div
          className="panel-content"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            opacity: chatCollapsed ? 0 : 1,
            pointerEvents: chatCollapsed ? "none" : "auto",
            transition: "opacity 0.25s ease",
            overflow: "hidden",
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--success)",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                Agent Chat
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="copy-btn"
                onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
                {scheme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </div>

          {/* ChatKit widget */}
          <div
            style={{
              flex: 1,
              padding: "0 8px 8px",
              overflow: "hidden",
            }}
          >
            <ChatKitPanel
              ref={panelRef}
              theme={scheme}
              onWidgetAction={handleWidgetAction}
              onResponseEnd={handleResponseEnd}
              onThemeRequest={setScheme}
              onResponseJSON={handleResponseJSON}
              onResponseStart={handleResponseStart}
            />
          </div>
        </div>
      </div>

      {/* ── Output Panel (Right) ────────────────────────── */}
      <div
        style={{
          flex: 1,
          height: "100%",
          overflow: "hidden",
          background: "var(--background)",
        }}
      >
        <OutputPanel
          responses={responses}
          isProcessing={isProcessing}
          onClear={handleClear}
        />
      </div>
    </main>
  );
}
