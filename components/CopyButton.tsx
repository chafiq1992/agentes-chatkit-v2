"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / restricted contexts.
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export function CopyButton({
  text,
  label = "Copy",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const disabled = useMemo(() => !text?.trim(), [text]);

  useEffect(() => {
    if (status !== "idle") {
      const t = window.setTimeout(() => setStatus("idle"), 1500);
      return () => window.clearTimeout(t);
    }
  }, [status]);

  const onCopy = useCallback(async () => {
    try {
      await copyToClipboard(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }, [text]);

  const title =
    status === "copied"
      ? "Copied"
      : status === "error"
        ? "Copy failed"
        : disabled
          ? "Nothing to copy"
          : "Copy to clipboard";

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled}
      title={title}
      className={[
        "rounded-md border px-2 py-1 text-xs transition-colors",
        "border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent",
        "dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
        className,
      ].join(" ")}
    >
      {status === "copied" ? "Copied" : status === "error" ? "Error" : label}
    </button>
  );
}


