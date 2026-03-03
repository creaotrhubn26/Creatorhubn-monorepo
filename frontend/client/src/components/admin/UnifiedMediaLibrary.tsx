import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Search, 
  Filter, 
  Image, 
  Video, 
  FileText, 
  Music,
  Folder,
  Download,
  Trash2,
  Star,
  StarOff,
  Eye,
  Copy,
  Tag,
  FolderOpen,
  CloudUpload,
  Grid3x3,
  List,
  SortAsc
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';

type MediaType = 'all' | 'image' | 'video' | 'audio' | 'document';
type ViewMode = 'grid' | 'list';

interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  googleDriveId?: string;
  googleDrivePath?: string;
  folderId?: string;
  folderName?: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
  };
}

interface MediaFolder {
  id: string;
  name: string;
  googleDriveId?: string;
  path: string;
  fileCount: number;
  parentId?: string;
  createdAt: string;
}

const MEDIA_TYPES = [
  { value: 'all', label: 'All Media', icon: FolderOpen },
  { value: 'image', label: 'Images', icon: Image },
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'document', label: 'Documents', icon: FileText },
];

export default function UnifiedMediaLibrary({ onSelectFile }: { onSelectFile?: (file: MediaFile) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MediaType>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size' | 'usage'>('recent');
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; fileId: string | null }>({ open: false, fileId: null });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch media files
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: [...QUERY_KEYS.MEDIA, selectedType, selectedFolderId, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedFolderId) params.append('folderId', selectedFolderId);
      params.append('sortBy', sortBy);

      const res = await fetch(`/api/media?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch media files');
      return res.json() as Promise<MediaFile[]>;
    }
  });

  // Fetch folders
  const { data: folders = [] } = useQuery({
    queryKey: QUERY_KEYS.MEDIA_FOLDERS,
    queryFn: async () => {
      const res = await fetch('/api/media/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json() as Promise<MediaFolder[]>;
    }
  });

  // Fetch available tags
  const { data: availableTags = [] } = useQuery({
    queryKey: [...QUERY_KEYS.MEDIA, 'tags'],
    queryFn: async () => {
      const res = await fetch('/api/media/tags');
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json() as Promise<string[]>;
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to upload file');
      return res.json() as Promise<MediaFile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEDIA });
      toast({
        title: 'Upload successful',
        description: 'Your file has been uploaded to Google Drive.'
      });
      setUploadDialogOpen(false);
    }
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ fileId, isFavorite }: { fileId: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/media/${fileId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite })
      });
      if (!res.ok) throw new Error('Failed to update favorite status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEDIA });
    }
  });

  // Update tags mutation
  const updateTagsMutation = useMutation({
    mutationFn: async ({ fileId, tags }: { fileId: string; tags: string[] }) => {
      const res = await fetch(`/api/media/${fileId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      });
      if (!res.ok) throw new Error('Failed to update tags');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEDIA });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.MEDIA, 'tags'] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/media/${fileId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete file');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MEDIA });
      toast({
        title: 'File deleted',
        description: 'The file has been removed from your library.'
      });
    }
  });

  // Filter files
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => file.tags.includes(tag));
    const matchesFavorites = !showFavoritesOnly || file.isFavorite;
    return matchesSearch && matchesTags && matchesFavorites;
  });

  const handleToggleFavorite = (fileId: string, currentStatus: boolean) => {
    toggleFavoriteMutation.mutate({ fileId, isFavorite: !currentStatus });
  };

  const handleDelete = (fileId: string) => {
    setDeleteConfirmDialog({ open: true, fileId });
  };

  const confirmDelete = () => {
    if (deleteConfirmDialog.fileId) {
      deleteMutation.mutate(deleteConfirmDialog.fileId);
    }
    setDeleteConfirmDialog({ open: false, fileId: null });
  };

  const handleUseFile = (file: MediaFile) => {
    if (onSelectFile) {
      onSelectFile(file);
    } else {
      // Copy URL to clipboard
      navigator.clipboard.writeText(file.url);
      toast({
        title: 'URL copied',
        description: 'File URL has been copied to clipboard.'
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B','KB','MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (type: MediaType) => {
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'document': return FileText;
      default: return FileText;
    }
  };

  const renderFilePreview = (file: MediaFile) => {
    if (file.type === 'image') {
      return <img src={file.url} alt={file.name} className="w-full h-full object-cover" />;
    } else if (file.type === 'video') {
      return (
        <video src={file.url} controls className="w-full h-full">
          Your browser does not support the video tag.
        </video>
      );
    } else if (file.type === 'audio') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Music className="h-12 w-12 text-muted-foreground mb-4" />
          <audio src={file.url} controls className="w-full" />
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{file.mimeType}</p>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Media Library</h2>
          <p className="text-muted-foreground">
            Manage your media files with Google Drive integration
          </p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <CloudUpload className="h-4 w-4 mr-2" />
              Upload to Drive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
              <DialogDescription>
                Upload files to your Google Drive media library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input type="file" multiple onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  Array.from(files).forEach(file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    if (selectedFolderId) {
                      formData.append('folderId', selectedFolderId);
                    }
                    uploadMutation.mutate(formData);
                  });
                }
              }} />
              {selectedFolderId && (
                <p className="text-sm text-muted-foreground">
                  Uploading to: {folders.find(f => f.id === selectedFolderId)?.name || 'Root'}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[180px]">
              <SortAsc className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="size">File Size</SelectItem>
              <SelectItem value="usage">Most Used</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Star className={`h-4 w-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ', '}`} />
            Favorites
          </Button>
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tags filter */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Filter by tags:</span>
            {availableTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedTags(prev =>
                    prev.includes(tag)
                      ? prev.filter(t => t !== tag)
                      : [...prev, tag]
                  );
                }}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Folders and Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Folders Sidebar */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Folders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={selectedFolderId === null ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setSelectedFolderId(null)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                All Files ({files.length})
              </Button>
              {folders.map(folder => (
                <Button
                  key={folder.id}
                  variant={selectedFolderId === folder.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  {folder.name} ({folder.fileCount})
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* File Grid/List */}
        <div className="col-span-9">
          <Tabs value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
            <TabsList>
              {MEDIA_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {type.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={selectedType} className="mt-6">
              {filesLoading ? (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md: grid-cols-2 lg:grid-cols-3, xl:grid-cols-4 gap-4' : 'space-y-2'}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <Card key={i} className="animate-pulse">
                      <div className="h-48 bg-gray-200" />
                      <CardContent className="pt-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredFiles.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No files found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload files or adjust your filters
                    </p>
                  </CardContent>
                </Card>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md: grid-cols-2 lg:grid-cols-3, xl:grid-cols-4 gap-4">
                  {filteredFiles.map(file => {
                    const Icon = getFileIcon(file.type);
                    return (
                      <Card key={file.id} className="hover:shadow-lg transition-shadow group">
                        <div className="relative h-48 bg-gray-100 overflow-hidden">
                          {file.thumbnailUrl || file.type === 'image' ? (
                            <img 
                              src={file.thumbnailUrl || file.url} 
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100"
                              onClick={() => handleToggleFavorite(file.id, file.isFavorite)}
                            >
                              {file.isFavorite ? (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <p className="font-medium truncate" title={file.name}>{file.name}</p>
                          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(file.size)}</span>
                            <span>Used {file.usageCount}x</span>
                          </div>
                          {file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {file.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {file.tags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{file.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="flex-1">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>{file.name}</DialogTitle>
                                  <DialogDescription>
                                    {formatFileSize(file.size)} • {file.mimeType}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="border rounded-md overflow-hidden" style={{ maxHeight: '70vh' }}>
                                  {renderFilePreview(file)}
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={() => handleUseFile(file)} className="flex-1">
                                    Use File
                                  </Button>
                                  <Button variant="outline" asChild>
                                    <a href={file.url} download>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" className="flex-1" onClick={() => handleUseFile(file)}>
                              Use
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredFiles.map(file => {
                    const Icon = getFileIcon(file.type);
                    return (
                      <Card key={file.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center">
                            {file.thumbnailUrl ? (
                              <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover rounded" />
                            ) : (
                              <Icon className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)} • {file.mimeType}</p>
                            <div className="flex gap-2 mt-1">
                              {file.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleFavorite(file.id, file.isFavorite)}
                            >
                              {file.isFavorite ? (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button size="sm" onClick={() => handleUseFile(file)}>
                              Use File
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={file.url} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => !open && setDeleteConfirmDialog({ open: false, fileId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmDialog({ open: false, fileId: null })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
