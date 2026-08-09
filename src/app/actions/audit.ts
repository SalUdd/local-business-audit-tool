"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { fetchGooglePlaces } from "@/lib/audit/google-places";
import { calculateAuditScore } from "@/lib/audit/scorer";
import {
  auditSingleWebsite,
  type WebsiteAuditResult,
} from "@/lib/audit/website-checker";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/database";

const CACHE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RunLocalAuditResult =
  | {
      success: true;
      cached: true;
      auditId: string;
      leads: Lead[];
    }
  | {
      success: true;
      cached?: false;
      auditId: string;
    };

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role credentials are not configured.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function unreachableWebsiteResult(hasWebsite: boolean): WebsiteAuditResult {
  return {
    hasWebsite,
    isUnreachable: hasWebsite,
    auditGaps: hasWebsite ? ["SLOW_OR_UNREACHABLE"] : ["NO_WEBSITE"],
  };
}

export async function runLocalAudit(
  industry: string,
  location: string
): Promise<RunLocalAuditResult> {
  const industryNormalized = industry.trim();
  const locationNormalized = location.trim();

  if (!industryNormalized || !locationNormalized) {
    throw new Error("Industry and location are required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Unable to load profile.");
  }

  if (profile.credits <= 0) {
    throw new Error("Insufficient credits");
  }

  const service = createServiceClient();
  const cacheCutoff = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();

  const { data: cachedAudit, error: cacheError } = await service
    .from("audits")
    .select("id")
    .eq("industry", industryNormalized)
    .eq("location", locationNormalized)
    .eq("status", "completed")
    .gte("created_at", cacheCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) {
    throw new Error(`Cache lookup failed: ${cacheError.message}`);
  }

  if (cachedAudit?.id) {
    const { data: cachedLeads, error: leadsError } = await service
      .from("leads")
      .select("*")
      .eq("audit_id", cachedAudit.id)
      .order("audit_score", { ascending: true });

    if (leadsError) {
      throw new Error(`Failed to load cached leads: ${leadsError.message}`);
    }

    return {
      success: true,
      cached: true,
      auditId: cachedAudit.id,
      leads: (cachedLeads ?? []) as Lead[],
    };
  }

  const { data: audit, error: auditInsertError } = await supabase
    .from("audits")
    .insert({
      user_id: user.id,
      industry: industryNormalized,
      location: locationNormalized,
      status: "processing",
    })
    .select("id")
    .single();

  if (auditInsertError || !audit) {
    throw new Error(
      `Failed to create audit: ${auditInsertError?.message ?? "Unknown error"}`
    );
  }

  const auditId = audit.id as string;

  try {
    const places = await fetchGooglePlaces(
      industryNormalized,
      locationNormalized
    );

    const websiteResults = await Promise.allSettled(
      places.map((place) => auditSingleWebsite(place.website))
    );

    const leadRows = places.map((place, index) => {
      const settled = websiteResults[index];
      const websiteMetrics =
        settled.status === "fulfilled"
          ? settled.value
          : unreachableWebsiteResult(Boolean(place.website));

      const { score, auditGaps } = calculateAuditScore({
        hasWebsite: websiteMetrics.hasWebsite,
        hasSsl: websiteMetrics.hasSsl ?? null,
        isMobileFriendly: websiteMetrics.isMobileFriendly ?? null,
        loadTimeMs: websiteMetrics.loadTimeMs ?? null,
        missingMeta: websiteMetrics.missingMeta ?? null,
        isUnreachable: websiteMetrics.isUnreachable ?? false,
        userRatingsTotal: place.userRatingsTotal,
        auditGaps: websiteMetrics.auditGaps,
      });

      return {
        audit_id: auditId,
        place_id: place.placeId,
        name: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        rating: place.rating,
        user_ratings_total: place.userRatingsTotal,
        audit_score: score,
        has_website: websiteMetrics.hasWebsite,
        has_ssl: websiteMetrics.hasSsl ?? null,
        is_mobile_friendly: websiteMetrics.isMobileFriendly ?? null,
        load_time_ms: websiteMetrics.loadTimeMs ?? null,
        missing_meta: websiteMetrics.missingMeta ?? null,
        has_schema: websiteMetrics.hasSchema ?? null,
        audit_gaps: auditGaps,
      };
    });

    if (leadRows.length > 0) {
      const { error: leadsInsertError } = await supabase
        .from("leads")
        .insert(leadRows);

      if (leadsInsertError) {
        throw new Error(`Failed to save leads: ${leadsInsertError.message}`);
      }
    }

    const { error: auditUpdateError } = await supabase
      .from("audits")
      .update({
        status: "completed",
        total_leads: leadRows.length,
      })
      .eq("id", auditId);

    if (auditUpdateError) {
      throw new Error(`Failed to complete audit: ${auditUpdateError.message}`);
    }

    const { error: creditError } = await supabase
      .from("profiles")
      .update({
        credits: profile.credits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (creditError) {
      throw new Error(`Failed to deduct credit: ${creditError.message}`);
    }

    return {
      success: true,
      auditId,
    };
  } catch (error) {
    await supabase
      .from("audits")
      .update({ status: "failed" })
      .eq("id", auditId);

    throw error instanceof Error
      ? error
      : new Error("Audit failed unexpectedly.");
  }
}
