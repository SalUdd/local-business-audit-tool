import axios from "axios";
import * as cheerio from "cheerio";

const REQUEST_TIMEOUT_MS = 5000;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export interface WebsiteAuditResult {
  hasWebsite: boolean;
  hasSsl?: boolean;
  isMobileFriendly?: boolean;
  hasTitle?: boolean;
  hasDescription?: boolean;
  missingMeta?: boolean;
  hasSchema?: boolean;
  loadTimeMs?: number;
  isUnreachable?: boolean;
  auditGaps: string[];
}

function normalizeWebsiteUrl(websiteUrl: string): string {
  const trimmed = websiteUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function hasLocalSchema($: cheerio.CheerioAPI): boolean {
  const jsonLdScripts = $('script[type="application/ld+json"]');

  for (const el of jsonLdScripts.toArray()) {
    const raw = $(el).html();
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (containsLocalBusinessSchema(parsed)) {
        return true;
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  const microdata = $("[itemtype]").toArray();
  return microdata.some((el) => {
    const itemtype = ($(el).attr("itemtype") ?? "").toLowerCase();
    return (
      itemtype.includes("schema.org/localbusiness") ||
      itemtype.includes("schema.org/restaurant") ||
      itemtype.includes("schema.org/store") ||
      itemtype.includes("schema.org/dentist") ||
      itemtype.includes("schema.org/physician") ||
      itemtype.includes("schema.org/attorney") ||
      itemtype.includes("schema.org/realestateagent")
    );
  });
}

function containsLocalBusinessSchema(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsLocalBusinessSchema);
  }

  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];

  if (typeof typeValue === "string" && isLocalBusinessType(typeValue)) {
    return true;
  }

  if (Array.isArray(typeValue) && typeValue.some((t) => typeof t === "string" && isLocalBusinessType(t))) {
    return true;
  }

  if (record["@graph"]) {
    return containsLocalBusinessSchema(record["@graph"]);
  }

  return Object.values(record).some(containsLocalBusinessSchema);
}

function isLocalBusinessType(typeName: string): boolean {
  const normalized = typeName.toLowerCase();
  return (
    normalized === "localbusiness" ||
    normalized.endsWith("localbusiness") ||
    [
      "restaurant",
      "store",
      "dentist",
      "physician",
      "attorney",
      "realestateagent",
      "hvacbusiness",
      "electrician",
      "plumber",
      "beautysalon",
      "autoshop",
    ].includes(normalized)
  );
}

export async function auditSingleWebsite(
  websiteUrl: string | null
): Promise<WebsiteAuditResult> {
  if (!websiteUrl || !websiteUrl.trim()) {
    return {
      hasWebsite: false,
      auditGaps: ["NO_WEBSITE"],
    };
  }

  const url = normalizeWebsiteUrl(websiteUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await axios.get<string>(url, {
      signal: controller.signal,
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      responseType: "text",
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const loadTimeMs = Date.now() - startedAt;
    const finalUrl = response.request?.res?.responseUrl ?? url;
    const hasSsl = String(finalUrl).toLowerCase().startsWith("https://");

    const $ = cheerio.load(response.data);
    const hasViewport = $('meta[name="viewport"]').length > 0;
    const titleText = $("title").first().text().trim();
    const descriptionText = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const hasTitle = titleText.length > 0;
    const hasDescription = descriptionText.length > 0;
    const missingMeta = !hasTitle || !hasDescription;
    const hasSchema = hasLocalSchema($);

    return {
      hasWebsite: true,
      hasSsl,
      isMobileFriendly: hasViewport,
      hasTitle,
      hasDescription,
      missingMeta,
      hasSchema,
      loadTimeMs,
      auditGaps: [],
    };
  } catch {
    return {
      hasWebsite: true,
      isUnreachable: true,
      auditGaps: ["SLOW_OR_UNREACHABLE"],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
