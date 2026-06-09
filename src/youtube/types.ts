export interface TemplateConfig {
  title?: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
}

export interface ScheduleSlot {
  weekday: number;
  time: string;
}

export interface ScheduleConfig {
  timezone: string;
  startDate: string;
  slots: ScheduleSlot[];
}

export interface UploadConfig {
  playlistId?: string;
}

export interface AppConfig {
  template: TemplateConfig;
  schedule: ScheduleConfig;
  upload?: UploadConfig;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
}

export interface UploadSummary {
  uploaded: number;
  skipped: number;
  failed: number;
}

export interface VideoCategory {
  id: string;
  title: string;
  assignable: boolean;
}

export interface ScheduledSlot {
  publishAtUtc: string;
  publishAtLocal: string;
  skippedReason?: string;
}

export interface ClientSecretFile {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

export interface TokenFile {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}
