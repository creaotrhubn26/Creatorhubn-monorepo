export type PhotoRoomViewMode = 'grid' | 'review' | 'delivery';
export type PhotoRoomInspectorTab = 'review' | 'comments' | 'metadata' | 'versions' | 'activity';

export interface PhotoRoomViewState {
  view: PhotoRoomViewMode;
  status: string;
  folder: string;
  source: string;
  collection: string;
  sort: string;
  query: string;
  inspector: PhotoRoomInspectorTab;
}

export const DEFAULT_PHOTO_ROOM_VIEW_STATE: PhotoRoomViewState = {
  view: 'grid',
  status: 'all',
  folder: 'all',
  source: 'all',
  collection: 'all',
  sort: 'newest',
  query: '',
  inspector: 'review',
};

const allowedViews = new Set<PhotoRoomViewMode>(['grid', 'review', 'delivery']);
const allowedInspectors = new Set<PhotoRoomInspectorTab>(['review', 'comments', 'metadata', 'versions', 'activity']);
const allowedSorts = new Set(['newest', 'oldest', 'name_asc', 'name_desc', 'rating']);
const allowedStatuses = new Set(['all', 'pending', 'approved', 'needs_edit', 'rejected', 'flagged', 'favorites']);

export function readPhotoRoomViewState(search: string, stored?: string | null): PhotoRoomViewState {
  let saved: Partial<PhotoRoomViewState> = {};
  try { saved = stored ? JSON.parse(stored) : {}; } catch { saved = {}; }
  const params = new URLSearchParams(search);
  const candidate = { ...DEFAULT_PHOTO_ROOM_VIEW_STATE, ...saved };
  const view = params.get('photoView') || candidate.view;
  const inspector = params.get('photoInspector') || candidate.inspector;
  const sort = params.get('photoSort') || candidate.sort;
  const status = params.get('photoStatus') || candidate.status;
  return {
    view: allowedViews.has(view as PhotoRoomViewMode) ? view as PhotoRoomViewMode : 'grid',
    inspector: allowedInspectors.has(inspector as PhotoRoomInspectorTab) ? inspector as PhotoRoomInspectorTab : 'review',
    sort: allowedSorts.has(sort) ? sort : 'newest',
    status: allowedStatuses.has(status) ? status : 'all',
    folder: params.get('photoFolder') || candidate.folder || 'all',
    source: params.get('photoSource') || candidate.source || 'all',
    collection: params.get('photoCollection') || candidate.collection || 'all',
    query: params.get('photoQuery') || '',
  };
}

export function writePhotoRoomViewState(search: string, state: PhotoRoomViewState): string {
  const params = new URLSearchParams(search);
  const values: Array<[string, string, string]> = [
    ['photoView', state.view, 'grid'],
    ['photoInspector', state.inspector, 'review'],
    ['photoSort', state.sort, 'newest'],
    ['photoStatus', state.status, 'all'],
    ['photoFolder', state.folder, 'all'],
    ['photoSource', state.source, 'all'],
    ['photoCollection', state.collection, 'all'],
    ['photoQuery', state.query, ''],
  ];
  for (const [key, value, defaultValue] of values) {
    if (value && value !== defaultValue) params.set(key, value);
    else params.delete(key);
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}
