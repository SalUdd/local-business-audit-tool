"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { runLocalAudit } from "@/app/actions/audit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuditSearchFormProps = {
  credits: number;
};

export function AuditSearchForm({ credits }: AuditSearchFormProps) {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validate(): string | null {
    if (!industry.trim()) {
      return "Industry / Niche is required.";
    }
    if (!location.trim()) {
      return "Location is required.";
    }
    if (credits < 1) {
      return "You need at least 1 credit remaining to run an audit.";
    }
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await runLocalAudit(industry.trim(), location.trim());

        if (result.cached) {
          toast.success("Loaded cached audit results from the last 7 days.", {
            description: `${result.leads.length} leads ready — no credits used.`,
          });
        } else {
          toast.success("Audit complete.", {
            description: "Fresh leads are ready on your dashboard.",
          });
        }

        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to run local audit.";
        setError(message);
        toast.error(message);
      }
    });
  }

  const disabled = isPending || credits < 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Run a local audit</CardTitle>
        <CardDescription>
          Find up to 20 businesses in a niche and score their online presence.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="industry" className="text-sm font-medium">
                Industry / Niche
              </label>
              <Input
                id="industry"
                name="industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder="e.g. Plumbers, Dentists"
                disabled={isPending}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="location" className="text-sm font-medium">
                Location
              </label>
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Melbourne, VIC or Austin, TX"
                disabled={isPending}
                required
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {credits < 1
              ? "No credits remaining. Purchase more to continue auditing."
              : "Uses 1 credit unless a matching audit was completed in the last 7 days."}
          </p>

          <Button type="submit" size="lg" disabled={disabled} className="min-w-56">
            {isPending ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Auditing 20 Local Businesses...
              </>
            ) : (
              <>
                <Search data-icon="inline-start" />
                Start audit
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
