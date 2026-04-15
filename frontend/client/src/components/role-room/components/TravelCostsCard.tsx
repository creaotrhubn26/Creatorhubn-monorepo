// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  LocalGasStation as FuelIcon,
  Toll as TollIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import type { CrewMember, ProductionDay } from '../models/casting';
import { castingService } from '../services/castingService';

interface TravelCostsCardProps {
  productionDay: ProductionDay;
  projectId: string;
}

export function TravelCostsCard({ productionDay, projectId }: TravelCostsCardProps) {
  const [crew, setCrew] = useState<CrewMember[]>([]);

  useEffect(() => {
    const loadCrew = async () => {
      if (projectId) {
        try {
          const crewData = await castingService.getCrew(projectId);
          setCrew(Array.isArray(crewData) ? crewData : []);
        } catch (error) {
          console.error('Error loading crew:', error);
          setCrew([]);
        }
      }
    };
    loadCrew();
  }, [projectId]);

  const dayCrew = crew.filter(c => productionDay.crew.includes(c.id));
  
  // Calculate total travel costs
  const totalCosts = dayCrew.reduce((total, member) => {
    const dayCost = member.travelCosts?.[productionDay.id];
    return total + (dayCost?.breakdown.totalCost || 0);
  }, 0);

  const hasCosts = dayCrew.some(member => member.travelCosts?.[productionDay.id]);

  if (!hasCosts) {
    return (
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center' }}>
            Ingen reisekostnader beregnet
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CarIcon sx={{ color: '#00d4ff' }} />
            Reisekostnader
          </Typography>
          <Chip
            label={`Total: ${totalCosts.toFixed(0)} NOK`}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontWeight: 700,
              fontSize: '14px',
            }}
          />
        </Box>

        <Stack spacing={2}>
          {dayCrew.map((member) => {
            const travelCost = member.travelCosts?.[productionDay.id];
            if (!travelCost) return null;

            return (
              <Box
                key={member.id}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
                  {member.name}
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0.5, px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CarIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Distanse: {travelCost.breakdown.kilometers.toFixed(1)} km
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0.5, px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FuelIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            Drivstoff: {travelCost.breakdown.fuelCost.toFixed(0)} NOK
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {travelCost.breakdown.tollFees > 0 && (
                    <ListItem sx={{ py: 0.5, px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TollIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              Bompenger: {travelCost.breakdown.tollFees.toFixed(0)} NOK
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  )}
                  <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                  <ListItem sx={{ py: 0.5, px: 0 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MoneyIcon sx={{ fontSize: 16, color: '#00d4ff' }} />
                            <Typography variant="body1" sx={{ color: '#00d4ff', fontWeight: 600 }}>
                              Total: {travelCost.breakdown.totalCost.toFixed(0)} NOK
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                </List>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

