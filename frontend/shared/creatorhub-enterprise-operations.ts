export const CREATORHUB_ENTERPRISE_FEATURE_IDS = {
  timesheets: "native-timesheets-approvals",
  booking: "public-booking-page",
  vendorProducts: "vendor-product-api",
} as const;

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected" | "locked";

export interface CreatorHubTimesheetSettlement {
  id: string;
  totalMinutes: number;
  hourlyRate: number;
  amount: number;
  currency: string;
  agreementStatus: "pending_signature" | "signed";
  splitSheetId: string;
}

export interface CreatorHubTimesheetPeriod {
  id: string;
  organizationId: string;
  projectId: string;
  participantId: string;
  employeeUserId: string;
  employeeName: string | null;
  employeeEmail: string | null;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  version: number;
  employeeNote: string | null;
  reviewerNote: string | null;
  totalMinutes: number;
  billableMinutes: number;
  entryCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  lockedAt: string | null;
  settlement: CreatorHubTimesheetSettlement | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatorHubTimeEntry {
  id: string;
  periodId: string;
  workDate: string;
  activity: string;
  description: string | null;
  taskId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  billable: boolean;
  source: "manual" | "timer" | "import";
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatorHubBookingProfile {
  organizationId: string;
  slug: string;
  businessName: string;
  headline: string | null;
  description: string | null;
  profession: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  coverUrl: string | null;
  locationLabel: string | null;
  contactEmail: string | null;
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  slotIntervalMinutes: number;
  isPublished: boolean;
}

export interface CreatorHubBookingService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceAmount: number;
  depositAmount: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  locationMode: "provider" | "customer" | "remote" | "flexible";
  isActive: boolean;
  sortOrder: number;
}

export interface CreatorHubVendorProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productType: "physical" | "digital" | "service";
  category: string;
  sku: string | null;
  version: string;
  price: number;
  priceAmount: number;
  currency: string;
  stockQuantity: number | null;
  trackInventory: boolean;
  status: "draft" | "active" | "inactive" | "archived";
  imageUrls: string[];
  imageUrl?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
