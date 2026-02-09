/**
 * Custom hook for Asset Library functionality
 * Manages asset upload, organization, and retrieval
 */

import { useState, useCallback, useRef } from 'react';

export interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'font' | 'icon';
  url: string;
  thumbnailUrl?: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  uploadedAt: string;
  tags: string[];
  category: string;
  metadata: {
    [key: string]: any;
};
  isPublic: boolean;
  isFavorite: boolean;
  downloadCount: number;
  lastUsed?: string
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  assetCount: number
}

export interface AssetFilter {
  type?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  isFavorite?: boolean;
  dateRange?: {
    start: string;
    end: string;
};
  sizeRange?: {
    min: number;
    max: number;
};
}

export interface UploadProgress {
  assetId: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string
}

export const useAssetLibrary = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([
    {
      id: 'images',
      name: 'Images',
      description: 'Photos, illustrations, and graphics',
      icon: 'image',
      color: '#4CAF5',
      assetCount: 0
},
    {
      id: 'videos',
      name: 'Videos',
      description: 'Video files and animations',
      icon: 'video',
      color: '#FF980',
      assetCount: 0
},
    {
      id: 'audio',
      name: 'Audio',
      description: 'Music, sound effects, and voice recordings',
      icon: 'audio',
      color: '#9C27B',
      assetCount: 0
},
    {
      id: 'documents',
      name: 'Documents',
      description: 'PDs, text files, and other documents',
      icon: 'description',
      color: '#607D8',
      assetCount: 0
},
    {
      id: 'fonts',
      name: 'Fonts',
      description: 'Custom fonts and typography',
      icon: 'font_download',
      color: '#79554',
      assetCount: 0
},
    {
      id: 'icons',
      name: 'Icons',
      description: 'Icons and symbols',
      icon: 'star',
      color: '#FFC10',
      assetCount: 0
}
  ]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [filter, setFilter] = useState<AssetFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload asset
  const uploadAsset = useCallback(async (file: File, category: string = 'images') => {
    const assetId = `asset_${Date.now()}`;
    
    // Add to upload progress
    setUploadProgress(prev => [...prev, {
      assetId,
      progress:  0,
      status: 'uploading'
}]);

    setIsUploading(true);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => prev.map(p => 
          p.assetId === assetId ? { ...p, progress: i } : p
        ));
    }

      // Create asset object
      const newAsset: Asset = {
        id: assetId,
        name: file.name,
        type: getFileType(file.type),
        url: URL.createObjectURL(file),
        size: file.size,
        format: file.type,
        uploadedAt: new Date().toISOString(),
        tags:  [],
        category,
        metadata: {
          originalName: file.name,
          lastModified: file.lastModified
    },
        isPublic: false,
        isFavorite: false,
        downloadCount: 0
  };

      // Add dimensions for images and videos
      if (newAsset.type === 'image' || newAsset.type === 'video') {
        const dimensions = await getMediaDimensions(file);
        newAsset.width = dimensions.width;
        newAsset.height = dimensions.height;
    }

      // Add duration for audio and video
      if (newAsset.type === 'audio' || newAsset.type === 'video') {
        newAsset.duration = await getMediaDuration(file);
    }

      // Generate thumbnail for images and videos
      if (newAsset.type === 'image' || newAsset.type === 'video') {
        newAsset.thumbnailUrl = await generateThumbnail(file);
    }

      // Add to assets
      setAssets(prev => [...prev, newAsset]);

      // Update category count
      setCategories(prev => prev.map(cat => 
        cat.id === category 
          ? { ...cat, assetCount: cat.assetCount + 1 }
          : cat
      ));

      // Update upload progress
      setUploadProgress(prev => prev.map(p => 
        p.assetId === assetId ? { ...p, status: 'completed',} : p
      ));

      return newAsset;
  } catch (error) {
      console.error('Upload failed: ', error);
      setUploadProgress(prev => prev.map(p => 
        p.assetId === assetId ? { ...p, status: 'error', error: error.message } : p
      ));
      return null;
  } finally {
      setIsUploading(false);
  }
}, []);

  // Upload multiple assets
  const uploadMultipleAssets = useCallback(async (files: FileList, category: string = 'images') => {
    const uploadPromises = Array.from(files).map(file => uploadAsset(file, category));
    return Promise.all(uploadPromises);
}, [uploadAsset]);

  // Delete asset
  const deleteAsset = useCallback((assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setSelectedAssets(prev => prev.filter(id => id !== assetId));
      
      // Update category count
      setCategories(prev => prev.map(cat => 
        cat.id === asset.category 
          ? { ...cat, assetCount: Math.max(cat.assetCount - 1, 0) }
          : cat
      ));
  }
}, [assets]);

  // Delete multiple assets
  const deleteMultipleAssets = useCallback((assetIds: string[]) => {
    assetIds.forEach(assetId => deleteAsset(assetId));
    setSelectedAssets([]);
}, [deleteAsset]);

  // Update asset
  const updateAsset = useCallback((assetId: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(asset => 
      asset.id === assetId ? { ...asset, ...updates } : asset
    ));
}, []);

  // Toggle asset selection
  const toggleAssetSelection = useCallback((assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
}, []);

  // Select all assets
  const selectAllAssets = useCallback(() => {
    const filteredAssets = getFilteredAssets();
    setSelectedAssets(filteredAssets.map(asset => asset.id));
}, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedAssets([]);
}, []);

  // Toggle favorite
  const toggleFavorite = useCallback((assetId: string) => {
    updateAsset(assetId, { isFavorite: !assets.find(a => a.id === assetId)?.isFavorite });
}, [assets, updateAsset]);

  // Toggle public status
  const togglePublic = useCallback((assetId: string) => {
    updateAsset(assetId, { isPublic: !assets.find(a => a.id === assetId)?.isPublic });
}, [assets, updateAsset]);

  // Add tag to asset
  const addTag = useCallback((assetId: string, tag: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset && !asset.tags.includes(tag)) {
      updateAsset(assetId, { tags: [...asset.tags, tag] });
  }
}, [assets, updateAsset]);

  // Remove tag from asset
  const removeTag = useCallback((assetId: string, tag: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      updateAsset(assetId, { tags: asset.tags.filter(t => t !== tag) });
  }
}, [assets, updateAsset]);

  // Move asset to category
  const moveToCategory = useCallback((assetId: string, categoryId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      const oldCategory = asset.category;
      const newCategory = categoryId;
      
      updateAsset(assetId, { category: newCategory });
      
      // Update category counts
      setCategories(prev => prev.map(cat => {
        if (cat.id === oldCategory) {
          return { ...cat, assetCount: Math.max(cat.assetCount - 1, 0) };
      } else if (cat.id === newCategory) {
          return { ...cat, assetCount: cat.assetCount + 1 };
      }
        return cat;
    }));
  }
}, [assets, updateAsset]);

  // Get filtered assets
  const getFilteredAssets = useCallback(() => {
    let filtered = assets;

    // Filter by type
    if (filter.type) {
      filtered = filtered.filter(asset => asset.type === filter.type);
  }

    // Filter by category
    if (filter.category) {
      filtered = filtered.filter(asset => asset.category === filter.category);
  }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(asset => 
        filter.tags!.some(tag => asset.tags.includes(tag))
      );
  }

    // Filter by public status
    if (filter.isPublic !== undefined) {
      filtered = filtered.filter(asset => asset.isPublic === filter.isPublic);
  }

    // Filter by favorite status
    if (filter.isFavorite !== undefined) {
      filtered = filtered.filter(asset => asset.isFavorite === filter.isFavorite);
  }

    // Filter by date range
    if (filter.dateRange) {
      filtered = filtered.filter(asset => {
        const assetDate = new Date(asset.uploadedAt);
        const startDate = new Date(filter.dateRange!.start);
        const endDate = new Date(filter.dateRange!.end);
        return assetDate >= startDate && assetDate <= endDate;
    });
  }

    // Filter by size range
    if (filter.sizeRange) {
      filtered = filtered.filter(asset => 
        asset.size >= filter.sizeRange!.min && asset.size <= filter.sizeRange!.max
      );
  }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(asset => 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }

    // Sort assets
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.uploadedAt);
          bValue = new Date(b.uploadedAt);
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
  }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
    } else {
        return aValue < bValue ? 1 : -1;
    }
  });

    return filtered;
}, [assets, filter, searchQuery, sortBy, sortOrder]);

  // Get asset by ID
  const getAssetById = useCallback((assetId: string) => {
    return assets.find(asset => asset.id === assetId);
}, [assets]);

  // Get assets by type
  const getAssetsByType = useCallback((type: string) => {
    return assets.filter(asset => asset.type === type);
}, [assets]);

  // Get assets by category
  const getAssetsByCategory = useCallback((categoryId: string) => {
    return assets.filter(asset => asset.category === categoryId);
}, [assets]);

  // Get all tags
  const getAllTags = useCallback(() => {
    const allTags = assets.flatMap(asset => asset.tags);
    return [...new Set(allTags)].sort();
}, [assets]);

  // Get asset statistics
  const getAssetStats = useCallback(() => {
    const totalAssets = assets.length;
    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const typeCounts = assets.reduce((counts, asset) => {
      counts[asset.type] = (counts[asset.type] || 0) + 1;
      return counts;
  }, {} as Record<string, number>);
    const categoryCounts = assets.reduce((counts, asset) => {
      counts[asset.category] = (counts[asset.category] || 0) + 1;
      return counts;
  }, {} as Record<string, number>);

    return {
      totalAssets,
      totalSize,
      typeCounts,
      categoryCounts,
      averageSize: totalAssets > 0 ? totalSize / totalAssets : 0
};
}, [assets]);

  // Utility functions
  const getFileType = (mimeType: string): Asset['type'] => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('font/')) return 'font';
    return 'document';
};

  const getMediaDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
        video.src = URL.createObjectURL(file);
    } else {
        resolve({ width: 0, height: 0 });
    }
  });
};

  const getMediaDuration = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
        media.onloadedmetadata = () => resolve(media.duration);
        media.src = URL.createObjectURL(file);
  } else {
        resolve(0);
    }
  });
};

  const generateThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 200;
          canvas.height = 200;
          ctx?.drawImage(img0, 200, 200);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
        img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadeddata = () => {
          video.currentTime = 1;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            ctx?.drawImage(video0, 200, 200);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
        video.src = URL.createObjectURL(file);
    } else {
        resolve('');
    }
  });
};

  return {
    // State
    assets,
    categories,
    selectedAssets,
    filter,
    searchQuery,
    sortBy,
    sortOrder,
    viewMode,
    uploadProgress,
    isUploading,

    // Setters
    setFilter,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setViewMode,

    // Asset operations
    uploadAsset,
    uploadMultipleAssets,
    deleteAsset,
    deleteMultipleAssets,
    updateAsset,

    // Selection operations
    toggleAssetSelection,
    selectAllAssets,
    clearSelection,

    // Asset management
    toggleFavorite,
    togglePublic,
    addTag,
    removeTag,
    moveToCategory,

    // Query operations
    getFilteredAssets,
    getAssetById,
    getAssetsByType,
    getAssetsByCategory,
    getAllTags,
    getAssetStats,

    // Refs
    fileInputRef
};
};


