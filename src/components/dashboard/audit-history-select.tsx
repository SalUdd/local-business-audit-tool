"use client";

import { useRouter, usePathname } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Audit } from "@/types/database";

type AuditHistorySelectProps = {
  audits: Audit[];
  selectedAuditId: string;
};

function formatAuditLabel(audit: Audit): string {
  const leadCount = audit.total_leads;
  const leadLabel =
    leadCount === 1 ? "1 lead found" : `${leadCount} leads found`;
  const statusSuffix =
    audit.status === "completed"
      ? ""
      : audit.status === "processing"
        ? " (processing)"
        : audit.status === "failed"
          ? " (failed)"
          : ` (${audit.status})`;

  return `${audit.industry} in ${audit.location} - ${leadLabel}${statusSuffix}`;
}

export function AuditHistorySelect({
  audits,
  selectedAuditId,
}: AuditHistorySelectProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (audits.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="audit-history" className="text-sm font-medium">
        Audit History
      </label>
      <Select
        value={selectedAuditId}
        onValueChange={(value) => {
          if (!value) return;
          const params = new URLSearchParams();
          params.set("auditId", value);
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        <SelectTrigger id="audit-history" className="w-full max-w-xl min-w-72">
          <SelectValue placeholder="Select a past audit" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {audits.map((audit) => (
            <SelectItem key={audit.id} value={audit.id}>
              {formatAuditLabel(audit)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
