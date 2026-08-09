"use client";

import { Download, ExternalLink, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types/database";

type SortOrder = "asc" | "desc";
type GapFilter = "all" | KnownGapCode;

type KnownGapCode =
  | "NO_WEBSITE"
  | "NO_SSL"
  | "NOT_MOBILE_FRIENDLY"
  | "SLOW_LOAD_TIME"
  | "SLOW_OR_UNREACHABLE"
  | "LOW_REVIEWS"
  | "MISSING_SEO_META";

const GAP_FILTER_OPTIONS: Array<{ value: GapFilter; label: string }> = [
  { value: "all", label: "All gaps" },
  { value: "NO_WEBSITE", label: "Show only no website" },
  { value: "NO_SSL", label: "Show only missing SSL" },
  { value: "NOT_MOBILE_FRIENDLY", label: "Show only not mobile friendly" },
  { value: "SLOW_LOAD_TIME", label: "Show only slow load time" },
  { value: "LOW_REVIEWS", label: "Show only low reviews" },
  { value: "MISSING_SEO_META", label: "Show only missing SEO meta" },
];

const GAP_BADGE_STYLES: Record<string, string> = {
  NO_WEBSITE: "border-transparent bg-rose-100 text-rose-800",
  NO_SSL: "border-transparent bg-orange-100 text-orange-800",
  NOT_MOBILE_FRIENDLY: "border-transparent bg-violet-100 text-violet-800",
  SLOW_LOAD_TIME: "border-transparent bg-amber-100 text-amber-900",
  SLOW_OR_UNREACHABLE: "border-transparent bg-red-100 text-red-800",
  LOW_REVIEWS: "border-transparent bg-sky-100 text-sky-800",
  MISSING_SEO_META: "border-transparent bg-fuchsia-100 text-fuchsia-800",
};

const GAP_LABELS: Record<string, string> = {
  NO_WEBSITE: "No Website",
  NO_SSL: "No SSL",
  NOT_MOBILE_FRIENDLY: "Not Mobile Friendly",
  SLOW_LOAD_TIME: "Slow Load Time",
  SLOW_OR_UNREACHABLE: "Slow / Unreachable",
  LOW_REVIEWS: "Low Reviews",
  MISSING_SEO_META: "Missing SEO Meta",
};

type LeadTableProps = {
  leads: Lead[];
};

function scoreBadgeClass(score: number): string {
  if (score >= 80) {
    return "border-transparent bg-emerald-100 text-emerald-800";
  }
  if (score >= 50) {
    return "border-transparent bg-amber-100 text-amber-900";
  }
  return "border-transparent bg-red-100 text-red-800";
}

function normalizeWebsiteUrl(website: string): string {
  if (/^https?:\/\//i.test(website)) {
    return website;
  }
  return `https://${website}`;
}

function getPrimaryGap(gaps: string[]): string {
  const priority: KnownGapCode[] = [
    "NO_WEBSITE",
    "NO_SSL",
    "SLOW_OR_UNREACHABLE",
    "SLOW_LOAD_TIME",
    "NOT_MOBILE_FRIENDLY",
    "MISSING_SEO_META",
    "LOW_REVIEWS",
  ];

  for (const code of priority) {
    if (gaps.includes(code)) {
      return GAP_LABELS[code] ?? code;
    }
  }

  return gaps[0] ? GAP_LABELS[gaps[0]] ?? gaps[0] : "None";
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatReviewMeta(lead: Lead): {
  label: string;
  isLowVolume: boolean;
} {
  const reviewCount = lead.user_ratings_total ?? 0;
  const isLowVolume = reviewCount < 10;

  if (reviewCount === 0) {
    return {
      label: "No reviews",
      isLowVolume: true,
    };
  }

  const ratingLabel =
    typeof lead.rating === "number" ? lead.rating.toFixed(1) : "—";

  return {
    label: `${ratingLabel} (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`,
    isLowVolume,
  };
}

function downloadLeadsCsv(leads: Lead[]) {
  const headers = [
    "Business Name",
    "Address",
    "Phone",
    "Website",
    "Google Rating",
    "Total Reviews",
    "Audit Score",
    "Primary Audit Gaps",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.address ?? "",
    lead.phone ?? "",
    lead.website ?? "",
    lead.rating != null ? String(lead.rating) : "",
    String(lead.user_ratings_total ?? 0),
    String(lead.audit_score),
    getPrimaryGap(lead.audit_gaps ?? []),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `local-audit-leads-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LeadTable({ leads }: LeadTableProps) {
  const [search, setSearch] = useState("");
  const [gapFilter, setGapFilter] = useState<GapFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      const matchesName =
        query.length === 0 || lead.name.toLowerCase().includes(query);
      const matchesGap =
        gapFilter === "all" || (lead.audit_gaps ?? []).includes(gapFilter);
      return matchesName && matchesGap;
    });

    return [...filtered].sort((a, b) =>
      sortOrder === "asc"
        ? a.audit_score - b.audit_score
        : b.audit_score - a.audit_score
    );
  }, [leads, search, gapFilter, sortOrder]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
            <label htmlFor="lead-search" className="text-sm font-medium">
              Search businesses
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="lead-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by business name..."
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Gap filter</span>
            <Select
              value={gapFilter}
              onValueChange={(value) => {
                if (value != null) {
                  setGapFilter(value as GapFilter);
                }
              }}
            >
              <SelectTrigger className="w-full min-w-56">
                <SelectValue placeholder="Filter by gap" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                {GAP_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Sort by score</span>
            <Select
              value={sortOrder}
              onValueChange={(value) => {
                if (value === "asc" || value === "desc") {
                  setSortOrder(value);
                }
              }}
            >
              <SelectTrigger className="w-full min-w-48">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                <SelectItem value="asc">Lowest score first</SelectItem>
                <SelectItem value="desc">Highest score first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => downloadLeadsCsv(filteredLeads)}
          disabled={filteredLeads.length === 0}
        >
          <Download data-icon="inline-start" />
          Export Leads to CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border/80 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Business</TableHead>
              <TableHead className="min-w-44">Contact</TableHead>
              <TableHead>Audit Score</TableHead>
              <TableHead className="min-w-64">Flagged Gaps</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leads match your current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                const reviewMeta = formatReviewMeta(lead);

                return (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-72 whitespace-normal">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.address || "Address unavailable"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs text-foreground">
                          <Star
                            className="size-3.5 fill-amber-400 text-amber-400"
                            aria-hidden="true"
                          />
                          <span className="tabular-nums">{reviewMeta.label}</span>
                        </span>
                        {reviewMeta.isLowVolume ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-800"
                          >
                            Low reviews
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="max-w-56 whitespace-normal">
                    <div className="space-y-1.5">
                      <p className="text-sm text-foreground">
                        {lead.phone || "No phone"}
                      </p>
                      {lead.website ? (
                        <a
                          href={normalizeWebsiteUrl(lead.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          <span className="truncate">{lead.website}</span>
                          <ExternalLink className="size-3.5 shrink-0" />
                        </a>
                      ) : (
                        <Badge
                          className={cn(
                            "font-medium",
                            GAP_BADGE_STYLES.NO_WEBSITE
                          )}
                        >
                          No Website
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={cn(
                        "min-w-12 justify-center font-semibold tabular-nums",
                        scoreBadgeClass(lead.audit_score)
                      )}
                    >
                      {lead.audit_score}
                    </Badge>
                  </TableCell>

                  <TableCell className="max-w-80 whitespace-normal">
                    <div className="flex flex-wrap gap-1.5">
                      {(lead.audit_gaps ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No gaps flagged
                        </span>
                      ) : (
                        (lead.audit_gaps ?? []).map((gap) => (
                          <Badge
                            key={`${lead.id}-${gap}`}
                            className={cn(
                              "font-medium",
                              GAP_BADGE_STYLES[gap] ??
                                "border-transparent bg-muted text-muted-foreground"
                            )}
                          >
                            {GAP_LABELS[gap] ?? gap.replaceAll("_", " ")}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <Link
                      href={`/report/${lead.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      View Report
                      <ExternalLink data-icon="inline-end" />
                    </Link>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredLeads.length} of {leads.length} leads
      </p>
    </div>
  );
}
