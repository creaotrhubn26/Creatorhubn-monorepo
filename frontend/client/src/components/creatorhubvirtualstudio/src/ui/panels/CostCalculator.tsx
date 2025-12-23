/**
 * CostCalculator - Scene Equipment Cost Calculator
 *
 * Features: * - Automatic MSRP calculation
 * - Equipment list with prices
 * - Total cost display
 * - Export equipment list
 * - Client quote generation
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('CostCalculator, ');
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  Divider,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Lightbulb as LightIcon,
  CameraAlt as CameraIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { calculateSceneCost } from '@/core/services/equipment-integration';
import { useAppStore } from '@/state/store';

export function CostCalculator() {
  const { scene } = useAppStore();
  const [costData, setCostData] = useState<{
    items: Array<{ name: string; price: number; currency: string }>;
    totalMSRP: number;
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    calculateCost();
  }, [scene.nodes]);

  const calculateCost = async () => {
    setLoading(true);
    setError(null);

    try {
      const cost = await calculateSceneCost(scene.nodes);
      setCostData(cost);

      if (cost.items.length === 0) {
        setError(
          'No equipment with pricing found in scene. Try adding equipment from the Equipment Browser.',
        );
      }
    } catch (err) {
      setError('Failed to calculate costs. Please try again.');
      log.error('Cost calculation error: ', err);
    } finally {
      setLoading(false);
    }
  };

  const exportEquipmentList = () => {
    if (!costData) return;

    // Create text export
    let text = '# Equipment List - Virtual Studio\n\n';
    text += `## Scene: ${scene.id}\n\n`;
    text += '### Equipment:\n\n';

    costData.items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name}\n`;
      text += `   Price: ${item.price.toLocaleString()} ${item.currency}\n\n`;
    });

    text += `### Total Cost: ${costData.totalMSRP.toLocaleString()} ${costData.currency}\n`;

    // Download as text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-list-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    log.debug('Equipment list exported');
  };

  const exportClientQuote = () => {
    if (!costData) return;

    // Create formatted client quote
    let quote = '# CLIENT QUOTE - Virtual Studio Setup\n\n';
    quote += `Date: ${new Date().toLocaleDateString()}\n\n`;
    quote += '## Recommended Equipment:\n\n';

    costData.items.forEach((item, idx) => {
      quote += `${idx + 1}. **${item.name}**\n`;
      quote += `   MSRP: ${item.price.toLocaleString()} ${item.currency}\n\n`;
    });

    quote += '---\n\n';
    quote += `### TOTAL INVESTMENT: ${costData.totalMSRP.toLocaleString()} ${costData.currency}\n\n`;
    quote += '---\n\n';
    quote += '### Notes:\n';
    quote += '- Prices are MSRP and may vary by retailer\n';
    quote += '- Professional lighting equipment requires proper training\n';
    quote += '- Contact us for package deals and installation services\n';

    // Download as markdown file
    const blob = new Blob([quote], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-quote-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    log.debug('Client quote exported');
  };

  const getItemIcon = (name: string) => {
    if (name.toLowerCase().includes('camera')) return <CameraIcon />;
    if (name.toLowerCase().includes('light')) return <LightIcon />;
    return <InfoIcon />;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyIcon />
            <Typography variant="h6">Cost Calculator</Typography>
          </Box>
          <Tooltip title="Refresh costs">
            <IconButton size="small" onClick={calculateCost} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Typography variant="body2" color="text.secondary">
            Calculating costs...
          </Typography>
        )}

        {!loading && costData && costData.items.length > 0 && (
          <>
            {/* Equipment List */}
            <List>
              {costData.items.map((item, idx) => (
                <React.Fragment key={idx}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{getItemIcon(item.name)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.name}
                      secondary={`${item.price.toLocaleString()} ${item.currency}`}
                    />
                  </ListItem>
                  {idx < costData.items.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>

            {/* Total */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                bgcolor: 'success.light',
                borderRadius: 1,
                textAlign: 'center'}}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                Total Equipment Cost (MSRP)
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.dark">
                {costData.totalMSRP.toLocaleString()} {costData.currency}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {costData.items.length} item{costData.items.length !== 1 ? 's' : ', '}
              </Typography>
            </Box>

            {/* Export Buttons */}
            <Box sx={{ mt: 2, display:'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportEquipmentList}
                size="small"
              >
                Export List
              </Button>
              <Button
                fullWidth
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportClientQuote}
                size="small"
              >
                Client Quote
              </Button>
            </Box>

            {/* Info */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                Prices are manufacturer MSRP and may vary by retailer. Contact local dealers for
                current pricing and availability.
              </Typography>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
