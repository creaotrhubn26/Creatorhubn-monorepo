/**
 * LUT LIBRARY COMPONENT
 * Browse and apply 627 professional LUTs
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Stack,
  Badge,
} from '@mui/material';
import { Close, Search, Palette } from '@mui/icons-material';
import { LUTEngine } from '../../services/lut-engine';

interface LUTLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelectLUT: (lutPath: string, lutName: string) => void;
}

export default function LUTLibrary({
  open,
  onClose,
  onSelectLUT
}: LUTLibraryProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLUT, setSelectedLUT] = useState<string | null>(null);
  
  const library = LUTEngine.getLUTLibrary();
  const filteredLUTs = searchQuery
    ? LUTEngine.searchLUTs(searchQuery)
    : library[selectedTab]?.luts || [];
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Professional LUT Library</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              627 LUTs • 440 Cultural • 187 Script
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search LUTs (culture, camera, look...)."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Categories */}
        {!searchQuery && (
          <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 2 }}>
            {library.map((cat, index) => (
              <Tab 
                key={cat.category} 
                label={
                  <Badge badgeContent={cat.luts.length} color="primary">
                    <span>{cat.category}</span>
                  </Badge>
                } 
              />
            ))}
          </Tabs>
        )}
        
        {/* LUT Grid */}
        <Grid container spacing={2}>
          {filteredLUTs.map((lut: any) => (
            <Grid item xs={6} sm={4} md={3} key={lut.path}>
              <Card sx={{
                border: selectedLUT === lut.path ? '2px solid #667eea' : 'none',
                cursor: 'pointer'
              }}>
                <CardActionArea onClick={() => {
                  onSelectLUT(lut.path, lut.name);
                  setSelectedLUT(lut.path);
                  onClose();
                }}>
                  <Box
                    sx={{
                      height: 120,
                      background: lut.category === 'cultural'
                        ? 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)'
                        : lut.category === 'script'
                        ? 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)' : 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <Palette sx={{ fontSize: 48, color: 'white', opacity: 0.8 }} />
                    
                    {lut.culture && (
                      <Chip
                        label={lut.culture}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          fontSize: '0.65rem'
                        }}
                      />
                    )}
                    
                    {lut.camera && (
                      <Chip
                        label={lut.camera}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          bgcolor: 'rgba(255,255,255,0.9)',
                          fontSize: '0.65rem'
                        }}
                      />
                    )}
                  </Box>
                  
                  <CardContent>
                    <Typography variant="subtitle2" noWrap fontWeight={600}>
                      {lut.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {lut.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {searchQuery && filteredLUTs.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography>No LUTs found for "{searchQuery}"</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}


