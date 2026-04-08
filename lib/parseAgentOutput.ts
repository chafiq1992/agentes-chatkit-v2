"use client";

/**
 * parseAgentOutput.ts
 *
 * Parses the structured JSON outputs from OpenAI agents into typed sections.
 * Handles the 3-response pattern: Product Analysis → Landing Page → Image Prompts
 */

/* ────────────────────────────────────────────────────── */
/* Types                                                   */
/* ────────────────────────────────────────────────────── */

export type KeySellingPoint = {
  point: string;
  evidence: string;
};

export type PainPointSolved = {
  pain: string;
  how_addressed: string;
  evidence: string;
};

export type UniqueSellingPoint = {
  usp: string;
  evidence: string;
};

export type RiskOrDrawback = {
  risk: string;
  evidence: string;
};

export type ComplianceNote = {
  note: string;
  evidence: string;
};

export type ProofSnippet = {
  type: string;
  source: string;
  evidence: string;
  note: string;
};

export type ProductImage = {
  index: number;
  url: string;
  alt: string;
};

export type ProductAnalysis = {
  classification: string;
  product: {
    title: string;
    category: string;
    subcategories: string[];
    materials: string[];
    care: string[];
    color_variants: string[];
    size_range_label: string;
    price: unknown;
    currency: unknown;
    handle: string;
    variant_count: number;
    sku_examples: string[];
    images: ProductImage[];
  };
  audience: {
    category: string;
    age_range_years: string;
    gender_focus: string;
    notes: string;
  };
  use_cases: string[];
  key_selling_points: KeySellingPoint[];
  pain_points_solved: PainPointSolved[];
  unique_selling_points: UniqueSellingPoint[];
  risks_or_drawbacks: RiskOrDrawback[];
  compliance_and_safety: ComplianceNote[];
  gaps: string[];
  confidence: number;
  proof_snippets: ProofSnippet[];
  comparative_notes: string[];
  policies_and_offer: Record<string, unknown>;
};

export type LandingPageBenefit = {
  title: string;
  bullets: string[];
};

export type FaqItem = {
  q: string;
  a: string;
};

export type LandingPageData = {
  classification: string;
  product_title: string;
  product_title_variants: string[];
  subtitle: string;
  seo: {
    title: string;
    meta_description: string;
    slug: string;
  };
  landing_page: {
    hero: {
      hook3: string;
      headline: string;
      subheadline: string;
      primary_cta: string;
      secondary_cta: string;
    };
    benefits: LandingPageBenefit[];
    size_fit: {
      note: string;
      size_range: string;
      layering_tip: string;
    };
    materials_care: {
      materials: string[];
      care_instructions: string[];
      skin_feel: string;
    };
    social_proof: {
      summary: string;
      review_snippets: string[];
    };
    policies_trust: {
      delivery: string;
      payment: string;
      returns: string;
      badges: string[];
    };
    faq: FaqItem[];
    guarantee: {
      text: string;
    };
    closing_cta: {
      headline: string;
      subheadline: string;
      button: string;
    };
    gallery_prompts: string[];
  };
  cta_labels: {
    primary: string;
    secondary: string;
  };
  keywords: string[];
  checks: Record<string, unknown>;
};

export type ImagePrompt = {
  slot_id: string;
  ratio: string;
  prompt: string;
  negative_prompt: string;
};

export type ImagePromptsData = {
  from_agent: string;
  brand: string;
  size_range: string;
  prompts: ImagePrompt[];
};

/* ────────────────────────────────────────────────────── */
/* Parsed Output Union                                     */
/* ────────────────────────────────────────────────────── */

export type ParsedSection =
  | { type: "product_analysis"; data: ProductAnalysis }
  | { type: "landing_page"; data: LandingPageData }
  | { type: "image_prompts"; data: ImagePromptsData }
  | { type: "unknown_json"; data: Record<string, unknown> }
  | { type: "plain_text"; data: string };

/* ────────────────────────────────────────────────────── */
/* Classifiers                                             */
/* ────────────────────────────────────────────────────── */

function isProductAnalysis(obj: Record<string, unknown>): boolean {
  return (
    ("key_selling_points" in obj || "pain_points_solved" in obj || "proof_snippets" in obj) &&
    ("product" in obj || "classification" in obj || "confidence" in obj)
  );
}

function isLandingPage(obj: Record<string, unknown>): boolean {
  return (
    ("landing_page" in obj || "seo" in obj) &&
    ("product_title" in obj || "product_title_variants" in obj || "keywords" in obj)
  );
}

function isImagePrompts(obj: Record<string, unknown>): boolean {
  return (
    "prompts" in obj &&
    Array.isArray(obj.prompts) &&
    obj.prompts.length > 0 &&
    typeof (obj.prompts[0] as Record<string, unknown>)?.prompt === "string" &&
    ("slot_id" in (obj.prompts[0] as Record<string, unknown>))
  );
}

function classifyObject(obj: Record<string, unknown>): ParsedSection {
  if (isProductAnalysis(obj)) {
    return { type: "product_analysis", data: obj as unknown as ProductAnalysis };
  }
  if (isLandingPage(obj)) {
    return { type: "landing_page", data: obj as unknown as LandingPageData };
  }
  if (isImagePrompts(obj)) {
    return { type: "image_prompts", data: obj as unknown as ImagePromptsData };
  }
  return { type: "unknown_json", data: obj };
}

/* ────────────────────────────────────────────────────── */
/* Main Parser                                             */
/* ────────────────────────────────────────────────────── */

/**
 * Attempts to extract JSON objects from a raw text string.
 * Handles:
 *  - Pure JSON objects
 *  - JSON inside markdown code fences
 *  - Multiple JSON objects concatenated or separated by "Thought for Xs" lines
 */
function extractJsonObjects(rawText: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // Strip "Thought for Xs" lines and similar ChatGPT artifacts
  const cleaned = rawText
    .replace(/^Thought for \d+s?\s*$/gm, "")
    .replace(/^The assistant said:\s*$/gm, "")
    .trim();

  // Try extracting from code fences first
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = fenceRegex.exec(cleaned)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        results.push(parsed);
      }
    } catch {
      // skip malformed
    }
  }
  if (results.length > 0) return results;

  // Try brace-matching for concatenated JSON objects
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = cleaned.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          if (parsed && typeof parsed === "object") {
            results.push(parsed);
          }
        } catch {
          // not valid JSON
        }
        start = -1;
      }
    }
  }

  return results;
}

/**
 * Parse a single response payload into structured sections.
 */
export function parseAgentResponse(payload: {
  outputs: unknown[];
  full: unknown;
  text?: string;
}): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // 1. Try outputs array first (already parsed JSON objects)
  if (Array.isArray(payload.outputs) && payload.outputs.length > 0) {
    for (const obj of payload.outputs) {
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        sections.push(classifyObject(obj as Record<string, unknown>));
      }
    }
  }

  // 2. Try parsing text for embedded JSON
  if (payload.text?.trim()) {
    const extracted = extractJsonObjects(payload.text);
    // Only add JSONs not already in sections (dedup by checking if similar keys exist)
    const existingKeys = new Set(
      sections
        .filter((s) => s.type !== "plain_text")
        .map((s) => {
          try {
            return JSON.stringify(Object.keys(s.data as Record<string, unknown>).sort().slice(0, 5));
          } catch {
            return "";
          }
        })
    );

    for (const obj of extracted) {
      const key = JSON.stringify(Object.keys(obj).sort().slice(0, 5));
      if (!existingKeys.has(key)) {
        sections.push(classifyObject(obj));
        existingKeys.add(key);
      }
    }

    // If no JSON was found anywhere, treat as plain text
    if (sections.length === 0 && payload.text.trim()) {
      sections.push({ type: "plain_text", data: payload.text });
    }
  }

  return sections;
}

/* ────────────────────────────────────────────────────── */
/* Copy-Friendly Formatters                                */
/* ────────────────────────────────────────────────────── */

export function formatProductAnalysisForCopy(data: ProductAnalysis): string {
  const lines: string[] = [];
  lines.push(`PRODUCT ANALYSIS`);
  lines.push(`================`);
  lines.push(`Classification: ${data.classification || "N/A"}`);
  lines.push(`Title: ${data.product?.title || "N/A"}`);
  lines.push(`Category: ${data.product?.category || "N/A"}`);
  if (data.product?.subcategories?.length) {
    lines.push(`Subcategories: ${data.product.subcategories.join(", ")}`);
  }
  if (data.product?.color_variants?.length) {
    lines.push(`Colors: ${data.product.color_variants.join(", ")}`);
  }
  lines.push(`Size Range: ${data.product?.size_range_label || "N/A"}`);
  lines.push(``);

  if (data.audience) {
    lines.push(`AUDIENCE`);
    lines.push(`--------`);
    lines.push(`Category: ${data.audience.category}`);
    lines.push(`Age: ${data.audience.age_range_years}`);
    lines.push(`Gender: ${data.audience.gender_focus}`);
    if (data.audience.notes) lines.push(`Notes: ${data.audience.notes}`);
    lines.push(``);
  }

  if (data.use_cases?.length) {
    lines.push(`USE CASES`);
    lines.push(`---------`);
    data.use_cases.forEach((uc) => lines.push(`• ${uc}`));
    lines.push(``);
  }

  if (data.key_selling_points?.length) {
    lines.push(`KEY SELLING POINTS`);
    lines.push(`------------------`);
    data.key_selling_points.forEach((ksp) => {
      lines.push(`• ${ksp.point}`);
      if (ksp.evidence) lines.push(`  Evidence: ${ksp.evidence}`);
    });
    lines.push(``);
  }

  if (data.pain_points_solved?.length) {
    lines.push(`PAIN POINTS SOLVED`);
    lines.push(`------------------`);
    data.pain_points_solved.forEach((pp) => {
      lines.push(`• Pain: ${pp.pain}`);
      lines.push(`  Solution: ${pp.how_addressed}`);
      if (pp.evidence) lines.push(`  Evidence: ${pp.evidence}`);
    });
    lines.push(``);
  }

  if (data.unique_selling_points?.length) {
    lines.push(`UNIQUE SELLING POINTS`);
    lines.push(`---------------------`);
    data.unique_selling_points.forEach((usp) => {
      lines.push(`• ${usp.usp}`);
      if (usp.evidence) lines.push(`  Evidence: ${usp.evidence}`);
    });
    lines.push(``);
  }

  if (data.risks_or_drawbacks?.length) {
    lines.push(`RISKS & DRAWBACKS`);
    lines.push(`-----------------`);
    data.risks_or_drawbacks.forEach((r) => {
      lines.push(`⚠ ${r.risk}`);
      if (r.evidence) lines.push(`  Evidence: ${r.evidence}`);
    });
    lines.push(``);
  }

  if (data.gaps?.length) {
    lines.push(`GAPS`);
    lines.push(`----`);
    data.gaps.forEach((g) => lines.push(`• ${g}`));
    lines.push(``);
  }

  if (typeof data.confidence === "number") {
    lines.push(`Confidence: ${Math.round(data.confidence * 100)}%`);
  }

  return lines.join("\n");
}

export function formatLandingPageForCopy(data: LandingPageData): string {
  const lines: string[] = [];
  lines.push(`LANDING PAGE COPY`);
  lines.push(`=================`);
  lines.push(`Product: ${data.product_title || "N/A"}`);
  if (data.subtitle) lines.push(`Subtitle: ${data.subtitle}`);
  if (data.product_title_variants?.length) {
    lines.push(`Title Variants:`);
    data.product_title_variants.forEach((v) => lines.push(`  • ${v}`));
  }
  lines.push(``);

  if (data.seo) {
    lines.push(`SEO`);
    lines.push(`---`);
    lines.push(`Title: ${data.seo.title}`);
    lines.push(`Description: ${data.seo.meta_description}`);
    lines.push(`Slug: ${data.seo.slug}`);
    lines.push(``);
  }

  const lp = data.landing_page;
  if (lp?.hero) {
    lines.push(`HERO SECTION`);
    lines.push(`------------`);
    lines.push(`Hook: ${lp.hero.hook3}`);
    lines.push(`Headline: ${lp.hero.headline}`);
    lines.push(`CTA: ${lp.hero.primary_cta}`);
    lines.push(``);
  }

  if (lp?.benefits?.length) {
    lines.push(`BENEFITS`);
    lines.push(`--------`);
    lp.benefits.forEach((b) => {
      lines.push(`${b.title}:`);
      b.bullets?.forEach((bullet) => {
        // Strip image slots
        const clean = bullet.replace(/\[\[IMG[^\]]*\]\]/g, "").trim();
        if (clean) lines.push(`  • ${clean}`);
      });
    });
    lines.push(``);
  }

  if (lp?.faq?.length) {
    lines.push(`FAQ`);
    lines.push(`---`);
    lp.faq.forEach((f) => {
      lines.push(`Q: ${f.q}`);
      lines.push(`A: ${f.a.replace(/\[\[IMG[^\]]*\]\]/g, "").trim()}`);
      lines.push(``);
    });
  }

  if (data.keywords?.length) {
    lines.push(`KEYWORDS`);
    lines.push(`--------`);
    lines.push(data.keywords.join(", "));
    lines.push(``);
  }

  return lines.join("\n");
}

export function formatImagePromptsForCopy(data: ImagePromptsData): string {
  const lines: string[] = [];
  lines.push(`IMAGE PROMPTS`);
  lines.push(`=============`);
  if (data.brand) lines.push(`Brand: ${data.brand}`);
  if (data.size_range) lines.push(`Size Range: ${data.size_range}`);
  lines.push(``);

  data.prompts?.forEach((p, i) => {
    lines.push(`--- Slot: ${p.slot_id} (${p.ratio}) ---`);
    lines.push(`Prompt: ${p.prompt}`);
    if (p.negative_prompt) lines.push(`Negative: ${p.negative_prompt}`);
    if (i < (data.prompts?.length ?? 0) - 1) lines.push(``);
  });

  return lines.join("\n");
}

export function formatSectionForCopy(section: ParsedSection): string {
  switch (section.type) {
    case "product_analysis":
      return formatProductAnalysisForCopy(section.data);
    case "landing_page":
      return formatLandingPageForCopy(section.data);
    case "image_prompts":
      return formatImagePromptsForCopy(section.data);
    case "plain_text":
      return section.data;
    case "unknown_json":
      return JSON.stringify(section.data, null, 2);
  }
}
