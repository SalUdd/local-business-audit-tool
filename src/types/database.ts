export type AuditStatus = "pending" | "processing" | "completed" | "failed";

export type AuditGapSeverity = "low" | "medium" | "high" | "critical";

export type AuditGapCategory =
  | "website"
  | "ssl"
  | "mobile"
  | "performance"
  | "meta"
  | "schema"
  | "other";

/** Shape of objects stored in `leads.audit_gaps` JSONB. */
export interface AuditGap {
  category: AuditGapCategory;
  title: string;
  description: string;
  severity: AuditGapSeverity;
}

export interface Profile {
  id: string;
  email: string;
  company_name: string | null;
  logo_url: string | null;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  user_id: string;
  industry: string;
  location: string;
  status: AuditStatus;
  total_leads: number;
  created_at: string;
}

export interface Lead {
  id: string;
  audit_id: string;
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  audit_score: number;
  has_website: boolean;
  has_ssl: boolean | null;
  is_mobile_friendly: boolean | null;
  load_time_ms: number | null;
  missing_meta: boolean | null;
  has_schema: boolean | null;
  audit_gaps: AuditGap[];
  created_at: string;
}

export type ProfileInsert = Omit<Profile, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type AuditInsert = Omit<Audit, "id" | "status" | "total_leads" | "created_at"> & {
  id?: string;
  status?: AuditStatus;
  total_leads?: number;
  created_at?: string;
};

export type LeadInsert = Omit<
  Lead,
  "id" | "audit_score" | "has_website" | "audit_gaps" | "created_at"
> & {
  id?: string;
  audit_score?: number;
  has_website?: boolean;
  audit_gaps?: AuditGap[];
  created_at?: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
      };
      audits: {
        Row: Audit;
        Insert: AuditInsert;
        Update: Partial<AuditInsert>;
      };
      leads: {
        Row: Lead;
        Insert: LeadInsert;
        Update: Partial<LeadInsert>;
      };
    };
  };
}
