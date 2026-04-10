"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export type WorkflowEntry = {
  id: string;
  name: string;
};

const ACTIVE_KEY = "chatkit-active-workflow";

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch {
    return null;
  }
}

function saveActiveId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}

export function WorkflowSwitcher({
  currentEnvWorkflowId,
  onWorkflowChange,
}: {
  currentEnvWorkflowId: string;
  onWorkflowChange: (workflowId: string, name: string) => void;
}) {
  const [workflows, setWorkflows] = useState<WorkflowEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState<string>(() => {
    const stored = loadActiveId();
    return stored || currentEnvWorkflowId || "";
  });

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch workflows from API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/workflows");
        if (res.ok) {
          const data = (await res.json()) as { workflows: WorkflowEntry[] };
          if (!cancelled && Array.isArray(data.workflows)) {
            let list = data.workflows;
            // Ensure the env workflow is always in the list
            if (
              currentEnvWorkflowId &&
              !list.find((w) => w.id === currentEnvWorkflowId)
            ) {
              list = [
                { id: currentEnvWorkflowId, name: "Default Agent" },
                ...list,
              ];
            }
            setWorkflows(list);
          }
        }
      } catch (err) {
        console.error("[WorkflowSwitcher] Failed to load workflows:", err);
        // Fallback: just show the env workflow
        if (!cancelled) {
          setWorkflows(
            currentEnvWorkflowId
              ? [{ id: currentEnvWorkflowId, name: "Default Agent" }]
              : []
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEnvWorkflowId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeWorkflow = workflows.find((w) => w.id === activeId);

  const handleSelect = useCallback(
    (entry: WorkflowEntry) => {
      setActiveId(entry.id);
      saveActiveId(entry.id);
      onWorkflowChange(entry.id, entry.name);
      setDropdownOpen(false);
    },
    [onWorkflowChange]
  );

  const handleAdd = useCallback(async () => {
    const trimId = newId.trim();
    const trimName = newName.trim() || `Agent ${workflows.length + 1}`;
    if (!trimId) return;

    // If already exists locally, just select it
    const existing = workflows.find((w) => w.id === trimId);
    if (existing) {
      handleSelect(existing);
      setIsAdding(false);
      setNewId("");
      setNewName("");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimId, name: trimName }),
      });
      if (res.ok) {
        const data = (await res.json()) as { workflows: WorkflowEntry[] };
        if (Array.isArray(data.workflows)) {
          setWorkflows(data.workflows);
        }
      }
    } catch (err) {
      console.error("[WorkflowSwitcher] Failed to add workflow:", err);
    } finally {
      setSaving(false);
    }

    const entry: WorkflowEntry = { id: trimId, name: trimName };
    handleSelect(entry);
    setIsAdding(false);
    setNewId("");
    setNewName("");
  }, [newId, newName, workflows, handleSelect]);

  const handleRename = useCallback(
    async (id: string, name: string) => {
      const trimName = name.trim();
      if (!trimName) {
        setIsEditing(null);
        return;
      }

      // Optimistic update
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name: trimName } : w))
      );
      setIsEditing(null);

      try {
        const res = await fetch("/api/workflows", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: trimName }),
        });
        if (res.ok) {
          const data = (await res.json()) as { workflows: WorkflowEntry[] };
          if (Array.isArray(data.workflows)) {
            setWorkflows(data.workflows);
          }
        }
      } catch (err) {
        console.error("[WorkflowSwitcher] Failed to rename workflow:", err);
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic update
      const remaining = workflows.filter((w) => w.id !== id);
      setWorkflows(remaining);
      if (activeId === id && remaining.length > 0) {
        handleSelect(remaining[0]);
      }

      try {
        const res = await fetch("/api/workflows", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          const data = (await res.json()) as { workflows: WorkflowEntry[] };
          if (Array.isArray(data.workflows)) {
            setWorkflows(data.workflows);
          }
        }
      } catch (err) {
        console.error("[WorkflowSwitcher] Failed to delete workflow:", err);
      }
    },
    [activeId, workflows, handleSelect]
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-elevated)",
          color: "var(--foreground)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          maxWidth: 200,
          transition: "all 0.15s ease",
        }}
        title={activeWorkflow ? `${activeWorkflow.name} (${activeWorkflow.id})` : "Select workflow"}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: activeWorkflow ? "var(--success)" : "var(--warning)",
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : activeWorkflow?.name || "No agent selected"}
        </span>
        <span style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>
          {dropdownOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            minWidth: 280,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Agent Workflows
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              + Add
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ padding: "16px 14px", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
              Loading workflows…
            </div>
          )}

          {/* Workflow list */}
          {!loading && (
            <div style={{ maxHeight: 240, overflowY: "auto" }} className="custom-scrollbar">
              {workflows.map((w) => (
                <div
                  key={w.id}
                  style={{
                    padding: "8px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "1px solid var(--border-subtle)",
                    background: w.id === activeId ? "var(--accent-soft)" : "transparent",
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
                  onClick={() => handleSelect(w)}
                  onMouseEnter={(e) => {
                    if (w.id !== activeId) e.currentTarget.style.background = "var(--surface-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = w.id === activeId ? "var(--accent-soft)" : "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: w.id === activeId ? "var(--accent)" : "var(--border)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing === w.id ? (
                      <input
                        autoFocus
                        defaultValue={w.name}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => handleRename(w.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(w.id, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setIsEditing(null);
                        }}
                        style={{
                          width: "100%",
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid var(--accent)",
                          background: "var(--surface)",
                          color: "var(--foreground)",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {w.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {w.id}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(w.id);
                      }}
                      title="Rename"
                      style={{
                        fontSize: 11,
                        padding: "2px 5px",
                        borderRadius: 4,
                        border: "none",
                        background: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      ✏️
                    </button>
                    {workflows.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(w.id);
                        }}
                        title="Delete"
                        style={{
                          fontSize: 11,
                          padding: "2px 5px",
                          borderRadius: 4,
                          border: "none",
                          background: "none",
                          color: "var(--danger)",
                          cursor: "pointer",
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new form */}
          {isAdding && (
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <input
                autoFocus
                placeholder="Workflow ID (wf_...)"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-elevated)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <input
                placeholder="Agent Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-elevated)",
                  color: "var(--foreground)",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewId("");
                    setNewName("");
                  }}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--muted)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newId.trim() || saving}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: newId.trim() && !saving ? "var(--accent)" : "var(--border)",
                    color: newId.trim() && !saving ? "#fff" : "var(--muted)",
                    cursor: newId.trim() && !saving ? "pointer" : "not-allowed",
                  }}
                >
                  {saving ? "Saving…" : "Add & Switch"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
