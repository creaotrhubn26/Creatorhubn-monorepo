/**
 * EquipmentPanelContext — shared state for the EquipmentManagementPanel component tree.
 * 
 * This allows the main panel to be split into smaller sub-components
 * (dialogs, views) without prop-drilling 50+ state variables.
 * 
 * Usage:
 *   <EquipmentPanelProvider value={{ ...all state and handlers }}>
 *     <EquipmentGridView />
 *     <EquipmentDialogs />
 *   </EquipmentPanelProvider>
 */

import { createContext, useContext } from 'react';
import type {
  Equipment,
  EquipmentBooking,
  EquipmentAvailability,
  EquipmentConflict,
  EquipmentCheckout,
  CastingCrew,
  CastingLocation,
  EquipmentTemplate,
  EquipmentTemplateItem,
  VendorLink,
} from '../services/castingApiService';
import type { FirmwareCheckStatus } from '../services/firmwareKnowledgeBase';

// ── Shared type aliases ──
export type SortField = 'name' | 'category' | 'status' | 'condition' | 'quantity';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'grid' | 'table' | 'gallery';
export type FirmwareUpdateMatch = FirmwareCheckStatus;

export type OfflineCheckoutEntry = {
  id: string; type: 'checkout'; ts: string;
  payload: { equipmentId: string; crewId: string; quantity: number; purpose: string };
};
export type OfflineCheckinEntry = {
  id: string; type: 'checkin'; ts: string;
  payload: { equipmentId: string; condition: Equipment['condition']; notes: string };
};
export type OfflineEntry = OfflineCheckoutEntry | OfflineCheckinEntry;

export interface EquipmentFormData {
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  quantity: number;
  condition: Equipment['condition'];
  primaryLocationId: string;
  notes: string;
  imageUrl: string;
  status: Equipment['status'];
  isGlobal: boolean;
  firmwareCurrent: string;
  firmwareAutoCheckEnabled: boolean;
}

export interface MaintenanceFormData {
  scheduledDate: string;
  type: 'routine' | 'repair' | 'inspection' | 'calibration' | 'cleaning';
  notes: string;
  reminderDays: number;
}

export interface BookingFormData {
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string;
}

export interface ImageSearchResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  description?: string;
  photographer?: string;
  source: 'unsplash' | 'pexels' | 'shotcafe' | 'pixabay' | 'openverse' | 'wikimedia';
}

export interface HistoryEntry {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

/**
 * All state + handlers from EquipmentManagementPanel,
 * exposed so child components can access them without prop drilling.
 */
export interface EquipmentPanelContextValue {
  // ── Project ──
  projectId: string;

  // ── Responsive ──
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // ── Toast ──
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;

  // ── Dialog IDs ──
  dialogTitleId: string;

  // ── Core list ──
  equipment: Equipment[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  filterOpen: boolean;
  setFilterOpen: (o: boolean) => void;
  filteredEquipment: Equipment[];
  allCategories: string[];

  // ── Add/Edit dialog ──
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  editingEquipment: Equipment | null;
  formData: EquipmentFormData;
  setFormData: React.Dispatch<React.SetStateAction<EquipmentFormData>>;
  formErrors: Record<string, string>;
  handleOpenDialog: (eq?: Equipment) => void;
  handleSave: () => void;
  validateForm: () => boolean;

  // ── Image picker ──
  imagePickerOpen: boolean;
  setImagePickerOpen: (o: boolean) => void;
  imagePickerTab: number;
  setImagePickerTab: (t: number) => void;
  imageSearchQuery: string;
  setImageSearchQuery: (q: string) => void;
  imageSearchResults: ImageSearchResult[];
  imageSearchLoading: boolean;
  searchImages: (query: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectSearchImage: (imageUrl: string) => void;
  tempImageUrl: string;
  setTempImageUrl: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // ── Crew / Assign ──
  crewMembers: CastingCrew[];
  locations: CastingLocation[];
  assignDialogOpen: boolean;
  setAssignDialogOpen: (o: boolean) => void;
  selectedEquipmentForAssign: Equipment | null;
  selectedCrewId: string;
  setSelectedCrewId: (id: string) => void;
  handleOpenAssign: (eq: Equipment) => void;
  handleAssign: () => void;
  handleUnassign: (equipmentId: string, crewId: string) => void;

  // ── Bookings ──
  bookingsDialogOpen: boolean;
  setBookingsDialogOpen: (o: boolean) => void;
  selectedEquipmentBookings: Equipment | null;
  bookings: EquipmentBooking[];
  availability: EquipmentAvailability[];
  handleOpenBookings: (eq: Equipment) => void;
  createBookingDialogOpen: boolean;
  setCreateBookingDialogOpen: (o: boolean) => void;
  bookingForm: BookingFormData;
  setBookingForm: React.Dispatch<React.SetStateAction<BookingFormData>>;
  handleOpenCreateBooking: () => void;
  handleCreateBooking: () => void;
  bookingConflicts: EquipmentConflict[];
  conflictChecking: boolean;
  checkBookingConflicts: (startDate: string, endDate: string) => void;

  // ── Firmware ──
  firmwareChecking: boolean;
  firmwareCheckedAt: string | null;
  firmwareUpdatesByEquipmentId: Record<string, FirmwareUpdateMatch>;
  firmwareUnmatchedCount: number;
  checkFirmwareUpdates: () => void;

  // ── Templates ──
  templates: EquipmentTemplate[];
  templatesDialogOpen: boolean;
  setTemplatesDialogOpen: (o: boolean) => void;
  templateFormOpen: boolean;
  setTemplateFormOpen: (o: boolean) => void;
  editingTemplate: EquipmentTemplate | null;
  setEditingTemplate: (t: EquipmentTemplate | null) => void;
  templateFormData: {
    name: string;
    description: string;
    category: string;
    use_case: string;
    is_global: boolean;
    items: Partial<EquipmentTemplateItem>[];
  };
  setTemplateFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    description: string;
    category: string;
    use_case: string;
    is_global: boolean;
    items: Partial<EquipmentTemplateItem>[];
  }>>;
  handleApplyTemplate: (templateId: string) => void;
  handleSaveTemplate: () => void;
  handleDeleteTemplate: (id: string) => void;
  handleCreateTemplateFromEquipment: () => void;

  // ── Shop / Vendors ──
  shopDialogOpen: boolean;
  setShopDialogOpen: (o: boolean) => void;
  vendorLinks: VendorLink[];
  vendorCategories: { category: string; count: number }[];
  selectedVendorCategory: string;
  setSelectedVendorCategory: (c: string) => void;
  handleOpenShopDialog: () => void;

  // ── Custom categories ──
  newCategoryDialogOpen: boolean;
  setNewCategoryDialogOpen: (o: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (n: string) => void;
  handleAddCustomCategory: () => void;
  handleRemoveCustomCategory: (category: string) => void;
  customCategories: string[];

  // ── Delete ──
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (o: boolean) => void;
  equipmentToDelete: Equipment | null;
  handleDeleteClick: (eq: Equipment) => void;
  handleConfirmDelete: () => void;

  // ── Bulk ops ──
  selectedEquipmentIds: Set<string>;
  bulkActionDialogOpen: boolean;
  setBulkActionDialogOpen: (o: boolean) => void;
  bulkActionType: 'delete' | 'status' | 'assign';
  setBulkActionType: (t: 'delete' | 'status' | 'assign') => void;
  bulkNewStatus: Equipment['status'];
  setBulkNewStatus: (s: Equipment['status']) => void;
  bulkAssignCrewId: string;
  setBulkAssignCrewId: (id: string) => void;
  toggleSelectEquipment: (id: string) => void;
  toggleSelectAll: () => void;
  handleBulkAction: (action: 'delete' | 'status' | 'assign') => void;
  handleConfirmBulkAction: () => void;

  // ── History ──
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (o: boolean) => void;
  selectedEquipmentHistory: Equipment | null;
  equipmentHistory: HistoryEntry[];
  handleOpenHistory: (eq: Equipment) => void;

  // ── Maintenance ──
  maintenanceDialogOpen: boolean;
  setMaintenanceDialogOpen: (o: boolean) => void;
  selectedEquipmentMaintenance: Equipment | null;
  maintenanceForm: MaintenanceFormData;
  setMaintenanceForm: React.Dispatch<React.SetStateAction<MaintenanceFormData>>;
  handleOpenMaintenance: (eq: Equipment) => void;
  handleScheduleMaintenance: () => void;
  maintenanceItems: Equipment[];
  missingItems: Equipment[];

  // ── Duplicate ──
  handleDuplicate: (eq: Equipment) => void;

  // ── CSV Export/Import ──
  handleExportCSV: () => void;
  handleImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadGearList: () => void;

  // ── QR Code ──
  generateQRCode: (eq: Equipment) => string;
  handlePrintQR: (eq: Equipment) => void;

  // ── Sorting ──
  handleSort: (field: SortField) => void;

  // ── Check-in / Check-out ──
  checkoutDialogOpen: boolean;
  setCheckoutDialogOpen: (o: boolean) => void;
  checkoutEquipment: Equipment | null;
  checkoutForm: { crewId: string; quantity: number; purpose: string };
  setCheckoutForm: React.Dispatch<React.SetStateAction<{ crewId: string; quantity: number; purpose: string }>>;
  handleOpenCheckout: (eq: Equipment) => void;
  handleConfirmCheckout: () => void;
  checkinDialogOpen: boolean;
  setCheckinDialogOpen: (o: boolean) => void;
  checkinEquipment: Equipment | null;
  checkinForm: { condition: Equipment['condition']; notes: string };
  setCheckinForm: React.Dispatch<React.SetStateAction<{ condition: Equipment['condition']; notes: string }>>;
  handleOpenCheckin: (eq: Equipment) => void;
  handleConfirmCheckin: () => void;

  // ── Reports ──
  reportsDialogOpen: boolean;
  setReportsDialogOpen: (o: boolean) => void;
  reportsTab: number;
  setReportsTab: (t: number) => void;

  // ── Offline ──
  isOnline: boolean;
  offlineQueueCount: number;
  offlineOutboxOpen: boolean;
  setOfflineOutboxOpen: (o: boolean) => void;
  offlineQueue: OfflineEntry[];
  handleSyncOfflineQueue: () => void;
  persistOfflineQueue: (queue: OfflineEntry[]) => void;

  // ── Active checkouts ──
  activeCheckouts: EquipmentCheckout[];

  // ── Quick preview ──
  previewOpen: boolean;
  setPreviewOpen: (o: boolean) => void;
  previewEquipment: Equipment | null;
  handlePreviewEquipment: (eq: Equipment) => void;

  // ── Drag & drop ──
  isDragging: boolean;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  // ── Helpers ──
  getCategoryColor: (category?: string) => string;
  getCrewName: (id: string) => string;
  getLocationName: (id: string) => string;
  categories: string[];

  // ── Reload ──
  loadEquipment: () => void;
}

const EquipmentPanelContext = createContext<EquipmentPanelContextValue | null>(null);

export const EquipmentPanelProvider = EquipmentPanelContext.Provider;

export function useEquipmentPanel(): EquipmentPanelContextValue {
  const ctx = useContext(EquipmentPanelContext);
  if (!ctx) throw new Error('useEquipmentPanel must be used within EquipmentPanelProvider');
  return ctx;
}
