import { Coins, LogOut } from "lucide-react";

import { logout } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  email: string;
  companyName?: string | null;
  credits: number;
};

export function DashboardHeader({
  email,
  companyName,
  credits,
}: DashboardHeaderProps) {
  const displayName = companyName?.trim() || email;
  const creditLabel =
    credits === 1 ? "1 Credit Remaining" : `${credits} Credits Remaining`;

  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Dashboard
        </p>
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
          {displayName}
        </h1>
        {companyName?.trim() ? (
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="secondary"
          className="h-8 gap-1.5 rounded-full px-3 text-sm font-semibold"
        >
          <Coins data-icon="inline-start" aria-hidden="true" />
          {creditLabel}
        </Badge>

        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut data-icon="inline-start" aria-hidden="true" />
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
