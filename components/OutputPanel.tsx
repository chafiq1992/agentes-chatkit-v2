"use client";

import { useMemo } from "react";
import { parseAgentResponse, type ParsedSection } from "@/lib/parseAgentOutput";
import {
  StructuredOutputCard,
  OutputSkeleton,
  ProcessingIndicator,
} from "./StructuredOutputCard";

type ResponsePayload = { outputs: unknown[]; full: unknown; text?: string };

export function OutputPanel({
  responses,
  isProcessing,
  onClear,
  activeWorkflowName,
}: {
  responses: ResponsePayload[];
  isProcessing: boolean;
  onClear: () => void;
  activeWorkflowName?: string;
}) {
  // Parse all responses into structured sections
  const parsedResponses = useMemo(() => {
    return responses.map((resp) => ({
      raw: resp,
      sections: parseAgentResponse(resp),
    }));
  }, [responses]);

  const totalSections = parsedResponses.reduce((sum, r) => sum + r.sections.length, 0);
  const hasContent = parsedResponses.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "var(--surface)",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Agent Output
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: "2px 0 0",
            }}
          >
            {hasContent
              ? `${parsedResponses.length} response${parsedResponses.length > 1 ? "s" : ""} · ${totalSections} section${totalSections !== 1 ? "s" : ""}${activeWorkflowName ? ` · ${activeWorkflowName}` : ""}`
              : activeWorkflowName ? `${activeWorkflowName} — Responses will appear here` : "Responses will appear here"}
          </p>
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={onClear}
            className="copy-btn"
            style={{ fontSize: 12 }}
          >
            🗑 Clear all
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Processing indicator */}
        {isProcessing && <ProcessingIndicator />}

        {/* Skeleton when processing and no content yet */}
        {isProcessing && !hasContent && (
          <>
            <OutputSkeleton />
            <OutputSkeleton />
          </>
        )}

        {/* Rendered responses */}
        {parsedResponses.map((parsed, respIdx) => (
          <div key={respIdx} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Response separator if multiple */}
            {parsedResponses.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "4px 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border)",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Response {parsedResponses.length - respIdx}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border)",
                  }}
                />
              </div>
            )}

            {/* Sections within each response */}
            {parsed.sections.length > 0 ? (
              parsed.sections.map((section: ParsedSection, secIdx: number) => (
                <StructuredOutputCard
                  key={`${respIdx}-${secIdx}`}
                  section={section}
                  index={secIdx}
                />
              ))
            ) : (
              <div
                className="premium-card animate-slide-up"
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                No structured output could be extracted from this response.
              </div>
            )}
          </div>
        ))}

        {/* Empty State */}
        {!isProcessing && !hasContent && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "60px 20px",
              textAlign: "center",
            }}
            className="animate-fade-in"
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "var(--accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              ✨
            </div>
            <div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--foreground)",
                  marginBottom: 6,
                }}
              >
                No output yet
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  maxWidth: 320,
                  lineHeight: 1.6,
                }}
              >
                Send an image or message in the chat to get started. The agent will analyze it and display structured output here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
