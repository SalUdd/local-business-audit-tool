import { redirect } from "next/navigation";

import { AuditHistorySelect } from "@/components/dashboard/audit-history-select";
import { AuditSearchForm } from "@/components/dashboard/audit-search-form";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LeadTable } from "@/components/dashboard/lead-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Audit, Lead, Profile } from "@/types/database";

type DashboardPageProps = {
  searchParams: Promise<{
    auditId?: string | string[];
  }>;
};

function getSelectedAuditId(
  audits: Audit[],
  auditIdParam: string | string[] | undefined
): string | null {
  if (audits.length === 0) {
    return null;
  }

  const requestedId = Array.isArray(auditIdParam)
    ? auditIdParam[0]
    : auditIdParam;

  if (requestedId && audits.some((audit) => audit.id === requestedId)) {
    return requestedId;
  }

  return audits[0]?.id ?? null;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const [{ data: profileData, error: profileError }, { data: auditsData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, company_name, logo_url, credits, created_at, updated_at")
        .eq("id", user.id)
        .single(),
      supabase
        .from("audits")
        .select("id, user_id, industry, location, status, total_leads, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (profileError || !profileData) {
    throw new Error("Unable to load your profile.");
  }

  const profile = profileData as Profile;
  const audits = (auditsData ?? []) as Audit[];
  const selectedAuditId = getSelectedAuditId(audits, params.auditId);
  const selectedAudit =
    audits.find((audit) => audit.id === selectedAuditId) ?? null;

  let leads: Lead[] = [];

  if (selectedAuditId) {
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .eq("audit_id", selectedAuditId)
      .order("audit_score", { ascending: true });

    if (leadsError) {
      throw new Error(`Unable to load leads: ${leadsError.message}`);
    }

    leads = (leadsData ?? []) as Lead[];
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <DashboardHeader
        email={profile.email}
        companyName={profile.company_name}
        credits={profile.credits}
      />

      <AuditSearchForm credits={profile.credits} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Lead results</h2>
            <p className="text-sm text-muted-foreground">
              {selectedAudit
                ? `Showing leads from ${selectedAudit.industry} in ${selectedAudit.location}.`
                : "Your audited businesses will appear here."}
            </p>
          </div>

          {audits.length > 0 && selectedAuditId ? (
            <AuditHistorySelect
              audits={audits}
              selectedAuditId={selectedAuditId}
            />
          ) : null}
        </div>

        {audits.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No audits yet</CardTitle>
              <CardDescription>
                Run your first audit above to find local clients!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Enter an industry and location to pull up to 20 local businesses,
                score their websites, and export outreach-ready leads.
              </p>
            </CardContent>
          </Card>
        ) : (
          <LeadTable leads={leads} />
        )}
      </section>
    </main>
  );
}
