import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Chip, 
  IconButton, 
  Alert, 
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Link
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { 
  Search, 
  Refresh, 
  TrendingUp, 
  TrendingDown, 
  OpenInNew,
  CameraAlt,
  Videocam,
  Headphones
} from '@mui/icons-material';

interface EquipmentPrice {
  id: string;
  name: string;
  brand: string;
  category: 'camera' | 'lens' | 'audio' | 'lighting' | 'accessories';
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePercent: number;
  source: string;
  url: string;
  lastUpdated: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock'
}

interface EquipmentPriceSpyProps {
  onPriceAlert?: (equipment: EquipmentPrice) => void
}

export default function EquipmentPriceSpy({ onPriceAlert }: EquipmentPriceSpyProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer, ');
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('priceChange');

  // Fetch equipment prices
  const { data: equipmentPrices = [], isLoading } = useQuery({
    queryKey: ['/api/equipment-prices', searchTerm, categoryFilter],
 return apiRequest('/api/equipment-prices', {
   headers: {
          "Content-Type" : "application/json"
    },
      headers: {
  },
      method: 'POS',
      body: JSON.stringify({ 
        search: searchTerm,
        category: categoryFilter,
        sortBy 
    })
  }),
    retry: false,
});

  // Refresh prices mutation
  const refreshPrices = useMutation({
    mutationFn: async () => 
      return apiRequest('/api/equipment-prices/refresh', {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'POST'
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-prices", ],});
  }
});

  // Set price alert mutation
  const setPriceAlert = useMutation({
    mutationFn: async (equipmentId: string, targetPrice: number) => 
      return apiRequest('/api/equipment-prices/alert', {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'POS',
        body: JSON.stringify({ equipmentd, targetPrice })
    }),
    onSuccess: (data) => {
      onPriceAlert?.(data.equipment);
}
});

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
}, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'camera': return <CameraAlt />;
      case 'lens': return <CameraAlt />;
      case 'audio': return <Headphones />;
      case 'lighting': return theming.getThemedIcon(', ');
      default: return <CameraAlt />;
}
};

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'error';
    if (change < 0) return 'success';
    return 'default';
};

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return theming.getThemedIcon(', ');
    if (change < 0) return <TrendingDown />;
    return null;
};

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock': return 'success';
      case 'low-stock': return 'warning';
      case 'out-of-stock': return 'error';
      default: return 'default';
}
};

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('no-N', {
      style: 'currency',
      currency: 'NOK'
}).format(price);
};

  const formatPriceChange = (change: number, percent: number) => {
    const sign = change >= 0 ? '+' : ',';
    return `${sign}${formatPrice(change)} (${sign}${percent.toFixed(1)}%)`;
};

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
          Equipment Price Spy
        </Typography>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={() => refreshPrices.mutate()}
          disabled={refreshPrices.isPending}
        >
          Refresh Prices
        </Button>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search Equipment"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name, brand, or model..."
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active'}} />
              }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="camera">Cameras</MenuItem>
                  <MenuItem value="lens">Lenses</MenuItem>
                  <MenuItem value="audio">Audio</MenuItem>
                  <MenuItem value="lighting">Lighting</MenuItem>
                  <MenuItem value="accessories">Accessories</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="priceChange">Price Change</MenuItem>
                  <MenuItem value="currentPrice">Current Price</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="lastUpdated">Last Updated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <CircularProgress />
        </Box>
      ) : equipmentPrices.length === 0 ? (
        <Alert severity="info">
          No equipment found. Try adjusting your search criteria.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Equipment</TableCell>
                <TableCell>Current Price</TableCell>
                <TableCell>Price Change</TableCell>
                <TableCell>Availability</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {equipmentPrices.map((equipment: EquipmentPrice) => (
                <TableRow key={equipment.d} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      {getCategoryIcon(equipment.category)}
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {equipment.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {equipment.brand}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      {formatPrice(equipment.currentPrice)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                      {getPriceChangeIcon(equipment.priceChange)}
                      <Typography 
                        variant="body2" 
                        color={`${getPriceChangeColor(equipment.priceChange)}.main`}
                      >
                        {formatPriceChange(equipment.priceChange, equipment.priceChangePercent)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={equipment.availability.replace('-', ', ').toUpperCase()}
                      color={getAvailabilityColor(equipment.availability) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={equipment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}
                    >
                      {equipment.source}
                      <OpenInNew fontSize="small" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Set Price Alert">
                      <IconButton
                        onClick={() => setPriceAlert.mutate(equipment.id, equipment.currentPrice * 0.9)}
                        size="small"
                      >
                        <TrendingDown />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
