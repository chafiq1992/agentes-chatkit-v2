"use client";

import { useMemo, useState, useCallback } from "react";
import {
  type ParsedSection,
  type ProductAnalysis,
  type LandingPageData,
  type ImagePromptsData,
  type MarketingAnglesData,
  formatSectionForCopy,
} from "@/lib/parseAgentOutput";

/* ────────────────────────────────────────────────────── */
/* Inline copy helper                                      */
/* ────────────────────────────────────────────────────── */

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function SectionCopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!text?.trim()}
      className={`copy-btn ${copied ? "copied" : ""}`}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

/* ────────────────────────────────────────────────────── */
/* Section Icons                                           */
/* ────────────────────────────────────────────────────── */

const ICONS: Record<string, { emoji: string; bg: string }> = {
  product: { emoji: "📦", bg: "var(--accent-soft)" },
  audience: { emoji: "👥", bg: "var(--info-soft)" },
  selling_points: { emoji: "⭐", bg: "var(--warning-soft)" },
  pain_points: { emoji: "💡", bg: "var(--success-soft)" },
  usp: { emoji: "🏆", bg: "var(--accent-soft)" },
  use_cases: { emoji: "🎯", bg: "var(--info-soft)" },
  seo: { emoji: "🔍", bg: "var(--success-soft)" },
  hero: { emoji: "🚀", bg: "var(--accent-soft)" },
  benefits: { emoji: "✅", bg: "var(--success-soft)" },
  faq: { emoji: "❓", bg: "var(--info-soft)" },
  materials: { emoji: "🧵", bg: "var(--warning-soft)" },
  social: { emoji: "💬", bg: "var(--info-soft)" },
  policies: { emoji: "🛡️", bg: "var(--success-soft)" },
  cta: { emoji: "🛒", bg: "var(--accent-soft)" },
  images: { emoji: "📸", bg: "var(--accent-soft)" },
  risks: { emoji: "⚠️", bg: "var(--danger-soft)" },
  gaps: { emoji: "📋", bg: "var(--warning-soft)" },
  keywords: { emoji: "🏷️", bg: "var(--info-soft)" },
  confidence: { emoji: "📊", bg: "var(--accent-soft)" },
  text: { emoji: "📝", bg: "var(--info-soft)" },
  json: { emoji: "{ }", bg: "var(--accent-soft)" },
};

function SectionHeader({
  icon,
  title,
  copyText: copyContent,
}: {
  icon: keyof typeof ICONS;
  title: string;
  copyText?: string;
}) {
  const cfg = ICONS[icon] || ICONS.text;
  return (
    <div className="section-header">
      <div className="section-icon" style={{ background: cfg.bg }}>
        {cfg.emoji}
      </div>
      <span className="section-title" style={{ flex: 1 }}>
        {title}
      </span>
      {copyContent && <SectionCopyBtn text={copyContent} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* Expandable section wrapper                              */
/* ────────────────────────────────────────────────────── */

function CollapsibleSection({
  icon,
  title,
  copyContent,
  defaultOpen = true,
  children,
}: {
  icon: keyof typeof ICONS;
  title: string;
  copyContent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="output-section" style={{ animationDelay: `${Math.random() * 0.15}s` }}>
      <div
        className="section-header"
        style={{ cursor: "pointer", userSelect: "none", marginBottom: open ? 12 : 0, paddingBottom: open ? 10 : 0, borderBottom: open ? undefined : "none" }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="section-icon" style={{ background: ICONS[icon]?.bg ?? "var(--accent-soft)" }}>
          {ICONS[icon]?.emoji ?? "📄"}
        </div>
        <span className="section-title" style={{ flex: 1 }}>
          {title}
        </span>
        {copyContent && (
          <span onClick={(e) => e.stopPropagation()}>
            <SectionCopyBtn text={copyContent} />
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            color: "var(--muted)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        >
          ▼
        </span>
      </div>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* Confidence Meter                                        */
/* ────────────────────────────────────────────────────── */

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--warning)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="confidence-bar" style={{ flex: 1 }}>
        <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* PRODUCT ANALYSIS RENDERER                               */
/* ────────────────────────────────────────────────────── */

function ProductAnalysisCard({ data }: { data: ProductAnalysis }) {
  const product = data.product;
  const audience = data.audience;

  return (
    <div className="space-y-3">
      {/* Product Header */}
      <div className="output-section">
        <SectionHeader icon="product" title="Product Overview" />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {data.classification && <span className="badge badge-accent">{data.classification}</span>}
          {product?.category && <span className="badge badge-info">{product.category}</span>}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {product?.title || "Untitled Product"}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {product?.subcategories?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Subcategories
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {product.subcategories.map((s, i) => (
                  <span key={i} className="tag">{s}</span>
                ))}
              </div>
            </div>
          )}
          {product?.color_variants?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Colors
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {product.color_variants.map((c, i) => (
                  <span key={i} className="tag">{c}</span>
                ))}
              </div>
            </div>
          )}
          {product?.size_range_label && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Size Range
              </div>
              <span style={{ fontSize: 13 }}>{product.size_range_label}</span>
            </div>
          )}
          {product?.variant_count != null && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Variants
              </div>
              <span style={{ fontSize: 13 }}>{product.variant_count}</span>
            </div>
          )}
        </div>
      </div>

      {/* Audience */}
      {audience && (
        <CollapsibleSection icon="audience" title="Target Audience">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--info)" }}>Category</div>
              <div className="pair-card-value">{audience.category}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--info)" }}>Age Range</div>
              <div className="pair-card-value">{audience.age_range_years}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--info)" }}>Gender Focus</div>
              <div className="pair-card-value">{audience.gender_focus}</div>
            </div>
            {audience.notes && (
              <div className="pair-card" style={{ gridColumn: "1 / -1" }}>
                <div className="pair-card-label" style={{ color: "var(--info)" }}>Notes</div>
                <div className="pair-card-value">{audience.notes}</div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Use Cases */}
      {data.use_cases?.length > 0 && (
        <CollapsibleSection
          icon="use_cases"
          title={`Use Cases (${data.use_cases.length})`}
          copyContent={data.use_cases.map((uc) => `• ${uc}`).join("\n")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.use_cases.map((uc, i) => (
              <span key={i} className="tag">{uc}</span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Key Selling Points */}
      {data.key_selling_points?.length > 0 && (
        <CollapsibleSection
          icon="selling_points"
          title={`Key Selling Points (${data.key_selling_points.length})`}
          copyContent={data.key_selling_points.map((ksp) => `• ${ksp.point}\n  Evidence: ${ksp.evidence}`).join("\n\n")}
        >
          <ul className="output-list">
            {data.key_selling_points.map((ksp, i) => (
              <li key={i}>
                <div style={{ fontWeight: 500 }}>{ksp.point}</div>
                {ksp.evidence && <div className="evidence-tag">📎 {ksp.evidence}</div>}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Pain Points Solved */}
      {data.pain_points_solved?.length > 0 && (
        <CollapsibleSection
          icon="pain_points"
          title={`Pain Points Solved (${data.pain_points_solved.length})`}
          copyContent={data.pain_points_solved.map((pp) => `Pain: ${pp.pain}\nSolution: ${pp.how_addressed}\nEvidence: ${pp.evidence}`).join("\n\n")}
        >
          <div className="space-y-3">
            {data.pain_points_solved.map((pp, i) => (
              <div key={i} className="pair-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>😓</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>Pain</div>
                    <div style={{ fontSize: 13 }}>{pp.pain}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>Solution</div>
                    <div style={{ fontSize: 13 }}>{pp.how_addressed}</div>
                  </div>
                </div>
                {pp.evidence && <div className="evidence-tag" style={{ marginLeft: 24 }}>📎 {pp.evidence}</div>}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Unique Selling Points */}
      {data.unique_selling_points?.length > 0 && (
        <CollapsibleSection
          icon="usp"
          title={`Unique Selling Points (${data.unique_selling_points.length})`}
          copyContent={data.unique_selling_points.map((u) => `• ${u.usp}\n  Evidence: ${u.evidence}`).join("\n\n")}
        >
          <ul className="output-list">
            {data.unique_selling_points.map((u, i) => (
              <li key={i}>
                <div style={{ fontWeight: 500 }}>{u.usp}</div>
                {u.evidence && <div className="evidence-tag">📎 {u.evidence}</div>}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Risks */}
      {data.risks_or_drawbacks?.length > 0 && (
        <CollapsibleSection icon="risks" title={`Risks & Drawbacks (${data.risks_or_drawbacks.length})`} defaultOpen={false}>
          <ul className="output-list">
            {data.risks_or_drawbacks.map((r, i) => (
              <li key={i}>
                <div style={{ fontWeight: 500, color: "var(--danger)" }}>{r.risk}</div>
                {r.evidence && <div className="evidence-tag">📎 {r.evidence}</div>}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Gaps */}
      {data.gaps?.length > 0 && (
        <CollapsibleSection
          icon="gaps"
          title={`Missing Info / Gaps (${data.gaps.length})`}
          defaultOpen={false}
          copyContent={data.gaps.map((g) => `• ${g}`).join("\n")}
        >
          <ul className="output-list">
            {data.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Confidence */}
      {typeof data.confidence === "number" && (
        <div className="output-section">
          <SectionHeader icon="confidence" title="Confidence Score" />
          <ConfidenceMeter value={data.confidence} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* LANDING PAGE RENDERER                                   */
/* ────────────────────────────────────────────────────── */

function cleanImageSlots(text: string): string {
  return text?.replace(/\[\[IMG[^\]]*\]\]/g, "").trim() || "";
}

function LandingPageCard({ data }: { data: LandingPageData }) {
  const lp = data.landing_page;

  return (
    <div className="space-y-3">
      {/* Title & Subtitle */}
      <div className="output-section">
        <SectionHeader icon="product" title="Product Copy" />
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>
          {data.product_title || "Untitled"}
        </h3>
        {data.subtitle && <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{data.subtitle}</p>}
        {data.product_title_variants?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Title Variants
            </div>
            {data.product_title_variants.map((v, i) => (
              <div key={i} style={{ fontSize: 13, padding: "4px 0", borderBottom: i < data.product_title_variants.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                {v}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEO */}
      {data.seo && (
        <CollapsibleSection
          icon="seo"
          title="SEO"
          copyContent={`Title: ${data.seo.title}\nDescription: ${data.seo.meta_description}\nSlug: ${data.seo.slug}`}
        >
          <div className="space-y-2">
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--success)" }}>Page Title</div>
              <div className="pair-card-value">{data.seo.title}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--success)" }}>Meta Description</div>
              <div className="pair-card-value">{data.seo.meta_description}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--success)" }}>Slug</div>
              <div className="pair-card-value" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>/{data.seo.slug}</div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Hero */}
      {lp?.hero && (
        <CollapsibleSection
          icon="hero"
          title="Hero Section"
          copyContent={`Hook: ${lp.hero.hook3}\nHeadline: ${lp.hero.headline}\nSubheadline: ${cleanImageSlots(lp.hero.subheadline)}\nCTA: ${lp.hero.primary_cta}`}
        >
          <div className="space-y-2">
            <div className="pair-card" style={{ borderLeft: "3px solid var(--accent)" }}>
              <div className="pair-card-label" style={{ color: "var(--accent)" }}>Hook</div>
              <div className="pair-card-value" style={{ fontSize: 16, fontWeight: 700 }}>{lp.hero.hook3}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--accent)" }}>Headline</div>
              <div className="pair-card-value" style={{ fontSize: 15, fontWeight: 600 }}>{lp.hero.headline}</div>
            </div>
            <div className="pair-card">
              <div className="pair-card-label" style={{ color: "var(--accent)" }}>Subheadline</div>
              <div className="pair-card-value">{cleanImageSlots(lp.hero.subheadline)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="badge badge-accent">{lp.hero.primary_cta}</span>
              {lp.hero.secondary_cta && <span className="badge badge-info">{lp.hero.secondary_cta}</span>}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Benefits */}
      {lp?.benefits?.length > 0 && (
        <CollapsibleSection
          icon="benefits"
          title={`Benefits (${lp.benefits.length})`}
          copyContent={lp.benefits.map((b) => `${b.title}:\n${b.bullets?.map((bl) => `  • ${cleanImageSlots(bl)}`).filter(Boolean).join("\n")}`).join("\n\n")}
        >
          <div className="space-y-3">
            {lp.benefits.map((b, i) => (
              <div key={i} className="pair-card">
                <div className="pair-card-label" style={{ color: "var(--success)", fontSize: 13, fontWeight: 600 }}>{b.title}</div>
                <ul className="output-list" style={{ marginTop: 4 }}>
                  {b.bullets?.map((bullet, j) => {
                    const clean = cleanImageSlots(bullet);
                    if (!clean) return null;
                    return <li key={j}>{clean}</li>;
                  })}
                </ul>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Size & Fit */}
      {lp?.size_fit && (
        <CollapsibleSection icon="product" title="Size & Fit" defaultOpen={false}>
          <div className="space-y-2">
            {lp.size_fit.size_range && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Range:</span>
                <span className="badge badge-accent">{lp.size_fit.size_range}</span>
              </div>
            )}
            {lp.size_fit.note && <p style={{ fontSize: 13, color: "var(--foreground)" }}>{cleanImageSlots(lp.size_fit.note)}</p>}
            {lp.size_fit.layering_tip && (
              <div className="pair-card" style={{ borderLeft: "3px solid var(--warning)" }}>
                <div className="pair-card-label" style={{ color: "var(--warning)" }}>💡 Layering Tip</div>
                <div className="pair-card-value">{lp.size_fit.layering_tip}</div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Materials & Care */}
      {lp?.materials_care && (
        <CollapsibleSection icon="materials" title="Materials & Care" defaultOpen={false}>
          <div className="space-y-2">
            {lp.materials_care.materials?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Materials</div>
                <ul className="output-list">
                  {lp.materials_care.materials.map((m, i) => {
                    const clean = cleanImageSlots(m);
                    return clean ? <li key={i}>{clean}</li> : null;
                  })}
                </ul>
              </div>
            )}
            {lp.materials_care.care_instructions?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Care</div>
                <ul className="output-list">
                  {lp.materials_care.care_instructions.map((ci, i) => (
                    <li key={i}>{ci}</li>
                  ))}
                </ul>
              </div>
            )}
            {lp.materials_care.skin_feel && (
              <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--muted)" }}>
                ✨ {lp.materials_care.skin_feel}
              </p>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Social Proof */}
      {lp?.social_proof && (
        <CollapsibleSection icon="social" title="Social Proof" defaultOpen={false}>
          {lp.social_proof.summary && (
            <p style={{ fontSize: 13, marginBottom: 8 }}>{cleanImageSlots(lp.social_proof.summary)}</p>
          )}
          {lp.social_proof.review_snippets?.length > 0 && (
            <div className="space-y-2">
              {lp.social_proof.review_snippets.map((r, i) => (
                <div key={i} className="pair-card" style={{ borderLeft: "3px solid var(--info)" }}>
                  <div className="pair-card-value" style={{ fontStyle: "italic" }}>&ldquo;{r}&rdquo;</div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* FAQ */}
      {lp?.faq?.length > 0 && (
        <CollapsibleSection
          icon="faq"
          title={`FAQ (${lp.faq.length})`}
          copyContent={lp.faq.map((f) => `Q: ${f.q}\nA: ${cleanImageSlots(f.a)}`).join("\n\n")}
        >
          <div className="space-y-2">
            {lp.faq.map((f, i) => (
              <div key={i} className="pair-card">
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Q: {f.q}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>A: {cleanImageSlots(f.a)}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Policies */}
      {lp?.policies_trust && (
        <CollapsibleSection icon="policies" title="Policies & Trust" defaultOpen={false}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {lp.policies_trust.delivery && (
              <div className="pair-card">
                <div className="pair-card-label" style={{ color: "var(--success)" }}>🚚 Delivery</div>
                <div className="pair-card-value">{lp.policies_trust.delivery}</div>
              </div>
            )}
            {lp.policies_trust.payment && (
              <div className="pair-card">
                <div className="pair-card-label" style={{ color: "var(--success)" }}>💳 Payment</div>
                <div className="pair-card-value">{lp.policies_trust.payment}</div>
              </div>
            )}
            {lp.policies_trust.returns && (
              <div className="pair-card" style={{ gridColumn: "1 / -1" }}>
                <div className="pair-card-label" style={{ color: "var(--success)" }}>↩️ Returns</div>
                <div className="pair-card-value">{lp.policies_trust.returns}</div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Closing CTA */}
      {lp?.closing_cta && (
        <div className="output-section" style={{ borderLeft: "3px solid var(--accent)" }}>
          <SectionHeader icon="cta" title="Closing CTA" copyText={`${lp.closing_cta.headline}\n${cleanImageSlots(lp.closing_cta.subheadline)}\nButton: ${lp.closing_cta.button}`} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{lp.closing_cta.headline}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{cleanImageSlots(lp.closing_cta.subheadline)}</div>
          <span className="badge badge-accent" style={{ fontSize: 12 }}>{lp.closing_cta.button}</span>
        </div>
      )}

      {/* Keywords */}
      {data.keywords?.length > 0 && (
        <CollapsibleSection
          icon="keywords"
          title={`Keywords (${data.keywords.length})`}
          defaultOpen={false}
          copyContent={data.keywords.join(", ")}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.keywords.map((kw, i) => (
              <span key={i} className="tag">{kw}</span>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* IMAGE PROMPTS RENDERER                                  */
/* ────────────────────────────────────────────────────── */

function ImagePromptsCard({ data }: { data: ImagePromptsData }) {
  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="output-section">
        <SectionHeader icon="images" title={`Image Prompts (${data.prompts?.length || 0})`} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {data.from_agent && <span className="badge badge-accent">{data.from_agent}</span>}
          {data.brand && data.brand !== "—" && <span className="badge badge-info">{data.brand}</span>}
          {data.size_range && <span className="badge badge-success">{data.size_range}</span>}
        </div>
      </div>

      {/* Prompt Cards */}
      {data.prompts?.map((p, i) => (
        <div key={i} className="prompt-card">
          <div className="prompt-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{p.slot_id}</span>
              <span className="badge badge-info">{p.ratio}</span>
            </div>
            <SectionCopyBtn text={`Prompt: ${p.prompt}\n\nNegative: ${p.negative_prompt || "none"}`} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Prompt
            </div>
            <div className="prompt-text">{p.prompt}</div>
          </div>
          {p.negative_prompt && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Negative Prompt
              </div>
              <div className="prompt-text">{p.negative_prompt}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* UNKNOWN JSON / PLAIN TEXT FALLBACK                      */
/* ────────────────────────────────────────────────────── */

function UnknownJsonCard({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const text = JSON.stringify(data, null, 2);
  const isLong = text.length > 1200;

  return (
    <div className="output-section">
      <SectionHeader icon="json" title="Structured Output" copyText={text} />
      <div style={{ position: "relative" }}>
        <pre
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: !expanded && isLong ? 280 : undefined,
            overflow: "hidden",
            color: "var(--foreground)",
          }}
        >
          {text}
        </pre>
        {isLong && !expanded && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              background: "linear-gradient(transparent, var(--surface))",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 4,
            }}
          >
            <button type="button" className="copy-btn" onClick={() => setExpanded(true)}>
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlainTextCard({ data }: { data: string }) {
  return (
    <div className="output-section">
      <SectionHeader icon="text" title="Response" copyText={data} />
      <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--foreground)" }}>
        {data}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* MARKETING ANGLES RENDERER                               */
/* ────────────────────────────────────────────────────── */

function MarketingAnglesCard({ data }: { data: MarketingAnglesData }) {
  return (
    <div className="space-y-3">
      <div className="output-section">
        <SectionHeader icon="cta" title={`Marketing Angles (${data.angles?.length || 0})`} />
      </div>

      {data.angles?.map((angle, i) => (
        <CollapsibleSection
          key={i}
          icon="selling_points"
          title={angle.angle_title}
          copyContent={[
            `Angle: ${angle.angle_title}`,
            "",
            "Headlines:",
            ...(angle.headlines?.map((h) => `• ${h}`) ?? []),
            "",
            "Ad Copy:",
            ...(angle.ad_copies?.map((a, idx) => `[${idx + 1}] ${a}`) ?? []),
          ].join("\n")}
        >
          {/* Headlines */}
          {angle.headlines?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                Headlines ({angle.headlines.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {angle.headlines.map((h, j) => (
                  <span
                    key={j}
                    className="tag"
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      lineHeight: 1.4,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ad Copies */}
          {angle.ad_copies?.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                Ad Copy ({angle.ad_copies.length})
              </div>
              <div className="space-y-2">
                {angle.ad_copies.map((copy, j) => (
                  <div
                    key={j}
                    className="pair-card"
                    style={{ borderLeft: "3px solid var(--accent)" }}
                  >
                    <div
                      className="pair-card-value"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {copy}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* MAIN CARD — renders a single ParsedSection              */
/* ────────────────────────────────────────────────────── */

function SectionRenderer({ section }: { section: ParsedSection }) {
  switch (section.type) {
    case "product_analysis":
      return <ProductAnalysisCard data={section.data} />;
    case "landing_page":
      return <LandingPageCard data={section.data} />;
    case "image_prompts":
      return <ImagePromptsCard data={section.data} />;
    case "marketing_angles":
      return <MarketingAnglesCard data={section.data} />;
    case "unknown_json":
      return <UnknownJsonCard data={section.data} />;
    case "plain_text":
      return <PlainTextCard data={section.data} />;
    default:
      return null;
  }
}

/* ────────────────────────────────────────────────────── */
/* CARD TITLES                                             */
/* ────────────────────────────────────────────────────── */

const TYPE_TITLES: Record<ParsedSection["type"], string> = {
  product_analysis: "Product Analysis",
  landing_page: "Landing Page Copy",
  image_prompts: "Image Prompts",
  marketing_angles: "Marketing Angles",
  unknown_json: "Structured Output",
  plain_text: "Response",
};

const TYPE_GRADIENTS: Record<ParsedSection["type"], string> = {
  product_analysis: "linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)",
  landing_page: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
  image_prompts: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  marketing_angles: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
  unknown_json: "linear-gradient(135deg, var(--muted) 0%, var(--accent) 100%)",
  plain_text: "linear-gradient(135deg, var(--info) 0%, var(--accent) 100%)",
};

/* ────────────────────────────────────────────────────── */
/* EXPORTED: StructuredOutputCard                          */
/* ────────────────────────────────────────────────────── */

export function StructuredOutputCard({
  section,
  index,
}: {
  section: ParsedSection;
  index: number;
}) {
  const copyContent = useMemo(() => formatSectionForCopy(section), [section]);

  return (
    <div
      className="premium-card animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Card Header */}
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: TYPE_GRADIENTS[section.type],
            borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {TYPE_TITLES[section.type]}
          </span>
        </div>
        <SectionCopyBtn text={copyContent} label="Copy All" />
      </div>

      {/* Card Body */}
      <div style={{ padding: 16 }}>
        <SectionRenderer section={section} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* SKELETON LOADING                                        */
/* ────────────────────────────────────────────────────── */

export function OutputSkeleton() {
  return (
    <div className="premium-card animate-fade-in" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 180, height: 16 }} />
      </div>
      <div className="skeleton" style={{ width: "100%", height: 12, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: "85%", height: 12, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: "92%", height: 12, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
      </div>
      <div className="skeleton" style={{ width: "70%", height: 12, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: "60%", height: 12 }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* PROCESSING INDICATOR                                    */
/* ────────────────────────────────────────────────────── */

export function ProcessingIndicator() {
  return (
    <div
      className="premium-card animate-fade-in"
      style={{
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <div className="processing-dot" />
        <div className="processing-dot" />
        <div className="processing-dot" />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}>
        Agent is processing your request…
      </span>
    </div>
  );
}
