export interface AuditMetrics {
  hasWebsite: boolean;
  hasSsl?: boolean | null;
  isMobileFriendly?: boolean | null;
  loadTimeMs?: number | null;
  userRatingsTotal?: number | null;
  missingMeta?: boolean | null;
  isUnreachable?: boolean;
  /** Gaps already detected upstream (e.g. website checker). */
  auditGaps?: string[];
}

export interface AuditScoreResult {
  score: number;
  auditGaps: string[];
}

/**
 * Starts at 100 and applies fixed penalties for known local-business gaps.
 */
export function calculateAuditScore(metrics: AuditMetrics): AuditScoreResult {
  let score = 100;
  const auditGaps = new Set<string>(metrics.auditGaps ?? []);

  if (!metrics.hasWebsite) {
    score -= 40;
    auditGaps.add("NO_WEBSITE");
  } else {
    if (metrics.hasSsl === false) {
      score -= 20;
      auditGaps.add("NO_SSL");
    }

    if (metrics.isMobileFriendly === false) {
      score -= 15;
      auditGaps.add("NOT_MOBILE_FRIENDLY");
    }

    const isSlow =
      metrics.isUnreachable === true ||
      (typeof metrics.loadTimeMs === "number" && metrics.loadTimeMs > 3000);

    if (isSlow) {
      score -= 10;
      auditGaps.add("SLOW_LOAD_TIME");
    }

    if (metrics.missingMeta === true) {
      score -= 5;
      auditGaps.add("MISSING_SEO_META");
    }
  }

  const reviews = metrics.userRatingsTotal ?? 0;
  if (reviews < 10) {
    score -= 10;
    auditGaps.add("LOW_REVIEWS");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    auditGaps: Array.from(auditGaps),
  };
}
