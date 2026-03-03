import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Pagination,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Search,
  FilterList,
  ViewModule,
  ViewList,
  Sort,
  Star,
  Download,
  Favorite,
} from '@mui/icons-material';
import TemplatePreviewCard from './TemplatePreviewCard';

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'lower-third' | 'transition' | 'intro' | 'outro' | 'overlay' | 'background';
  thumbnail: string;
  preview: string;
  duration: number;
  resolution: string;
  frameRate: number;
  fileSize: string;
  tags: string[];
  isFavorite: boolean;
  isPublic: boolean;
  downloads: number;
  rating: number;
  author: string;
  createdAt: string;
  updatedAt: string
}

interface TemplateLibraryProps {
  projectId?: string;
  onTemplateSelect?: (template: Template) => void;
  onTemplateEdit?: (template: Template) => void;
  onTemplateDownload?: (template: Template) => void;
  onTemplateToggleFavorite?: (template: Template) => void;
  showActions?: boolean
}

export default function TemplateLibrary({ 
  projectId,
  onTemplateSelect,
  onTemplateEdit,
  onTemplateDownload,
  onTemplateToggleFavorite,
  showActions = true 
}: TemplateLibraryProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'downloads' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/templates', projectId, searchTerm, selectedCategory, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('projectId', projectId);
      if (searchTerm) params.set('search', searchTerm);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      return apiRequest(`/api/templates?${params.toString()}`);
    },
    retry: false,
});

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = [...templates];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
  }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'rating':
          aValue = a.rating;
          bValue = b.rating;
          break;
        case 'downloads':
          aValue = a.downloads;
          bValue = b.downloads;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default: aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
  }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
    } else {
        return aValue < bValue ? 1 : -1;
    }
  });

    return filtered;
}, [templates, searchTerm, selectedCategory, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(templates.map(t => t.category))];
    return uniqueCategories.map(category => ({
      value: category,
      label: category.replace(', -', ', ').toUpperCase()
  }));
}, [templates]);

  // Get unique tags
  const allTags = useMemo(() => {
    const tags = templates.flatMap(t => t.tags);
    return [...new Set(tags)].sort();
}, [templates]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
}, []);

  const handleCategoryChange = useCallback((event: any) => {
    setSelectedCategory(event.target.value);
    setCurrentPage(1);
}, []);

  const handleSortChange = useCallback((event: any) => {
    setSortBy(event.target.value);
    setCurrentPage(1);
}, []);

  const handleSortOrderToggle = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setCurrentPage(1);
}, []);

  const handleViewModeChange = useCallback((event: any, newViewMode: 'grid' | 'list') => {
    if (newViewMode !== null) {
      setViewMode(newViewMode);
}
}, []);

  const handlePageChange = useCallback((event: any, page: number) => {
    setCurrentPage(page);
}, []);

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <FilterList color="primary" />
          Template Library
        </Typography>
        <Box sx={{ display: 'flex', gap:  1 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="grid">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ mb:  3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              placeholder="Search templates..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />
            }}
            />
          </Grid>
          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={handleCategoryChange}
                label="Category"
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map(category => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={handleSortChange}
                label="Sort By"
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="rating">Rating</MenuItem>
                <MenuItem value="downloads">Downloads</MenuItem>
                <MenuItem value="createdAt">Date Created</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              startIcon={theming.getThemedIcon('sort')}
              onClick={handleSortOrderToggle}
              variant="outlined"
            >
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Results Summary */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
        <Typography variant="body2" color="text.secondary">
          {filteredTemplates.length} templates found
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
          {allTags.slice(0, 5).map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              onClick={() => setSearchTerm(tag)}
            />
          ))}
          {allTags.length > 5 && (
            <Chip
              label={`+${allTags.length - 5} more`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Templates Grid/List */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <CircularProgress />
        </Box>
      ) : paginatedTemplates.length === 0 ? (
        <Alert severity="info">
          No templates found matching your criteria. Try adjusting your search or filters.
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {paginatedTemplates.map((template: Template) => (
              <Grid 
                item 
                xs={2} 
                sm={viewMode === 'grid' ? 6 : 12} 
                md={viewMode === 'grid' ? 4 : 12} 
                key={template.id}
              >
                <TemplatePreviewCard
                  template={template}
                  onSelect={onTemplateSelect}
                  onEdit={onTemplateEdit}
                  onDownload={onTemplateDownload}
                  onToggleFavorite={onTemplateToggleFavorite}
                  showActions={showActions}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt:  4 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
