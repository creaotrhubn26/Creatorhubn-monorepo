import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { Step, Box } from "@mui/material";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card as MuiCard, CardContent, Button, Chip as Badge } from '@mui/material';
import { SearchOutlined, TrendingUp } from "@mui/icons-material";
import { Visibility, Message, ThumbUp, ArrowForward, Lightbulb } from "@mui/icons-material";

export default function
  // Theming system
  const theming = useTheming('photographer'); JourneyProgress() { 
  const { data: journeyStage } = useQuery({ 
    queryKey: ["/api/customer-journey/stage", ],
    refetchInterval: 30000 // Refresh every 30 seconds 
});
  
  const { data: recommendations } = useQuery({ 
    queryKey: ["/api/marketplace/recommendations"] 
});
  
  // Journey stages data
  const journeyStages = [
    { id: 'discovery', label: 'Discovery', description: 'Finding your needs', color: '#ff8c00', icon: SearchOutlined },
    { id: 'consideration', label: 'Consideration', description: 'Evaluating options', color: '#ffa500', icon: Visibility },
    { id: 'decision', label: 'Decision', description: 'Making choice', color: '#ffb340', icon: ThumbU, p,},
    { id: 'action', label: 'Action', description: 'Taking action', color: '#ffd700', icon: ArrowForward },
    { id: 'advocacy', label: 'Advocacy', description: 'Sharing experience', color: '#32cd30', icon: Lightbulb }
  ];

  const currentStageIndex = journeyStages.findIndex(stage => stage.id === journeyStage?.stage) || 0;

  if (!journeyStage) return null;

  return (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      {/* Journey Progress Bar */}
      <MuiCard>
        <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600}>Your Journey Progress</h3>
            <Badge 
              label={journeyStages[currentStageIndex]?.label}
              style={{ backgroundColor: journeyStages[currentStageIndex]?.color }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {journeyStages.map((stage, index) => {
              const isActive = index === currentStageIndex;
              const isCompleted = index < currentStageIndex;
              const IconComponent = stage.icon;
              
              return (
                <Box key={stage.id} sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr:  2 }}>
                    <Box
                      sx={{
                        width:  40,
                        height:  40,
                        borderRadius: '50, %',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isActive ? '#8B4513' : isCompleted ? '#fbbf24' : '#e5e7eb',
                        color: isActive || isCompleted ? 'white' : '#6b7280'
                  }}
                    >
                      <IconComponent sx={{ fontSize: 20}} />
                    </Box>
                    <Box sx={{ textAlign: 'center', mt:  1 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500}}>{stage.label}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{stage.description}</p>
                    </Box>
                  </Box>
                  {index < journeyStages.length - 1 && (
                    <Box
                      sx={{
                        flexGrow:  1,
                        height:  4,
                        mx:  2,
                        bgcolor: index < currentStageIndex ? '#fbbf24' : '#e5e7eb',
                        borderRadius: 1 }}
                    />
                  )}
                </Box>
              );
          })}
          </div>

          {journeyStage.personalizedMessage && (
            <Box sx={{ mt:  3, p: 2, bgcolor: '#eff6ff', borderRadius:  2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <Lightbulb sx={{ fontSize:  20, color: '#2563eb' }} />
                <p style={{ fontSize: '0.875rem', color: '#1e40af', margin:  0 }}>{journeyStage.personalizedMessage}</p>
              </Box>
            </Box>
          )}
        </CardContent>
      </MuiCard>

      {/* Next Actions */}
      {journeyStage.nextSuggestedActions && journeyStage.nextSuggestedActions.length > 0 && (
        <MuiCard sx={{ mt:  2 }}>
          <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600,marginBottom: '1rem' }}>Suggested Next Steps</h3>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
              {journeyStage.nextSuggestedActions.map((action: string, index: number) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <ArrowForward sx={{ fontSize:  20, color: '#8B4513' }} />
                  <span style={{ fontSize: '0.875rem' }}>{action}</span>
                </Box>
              ))}
            </Box>
          </CardContent>
        </MuiCard>
      )}

      {/* Personalized Recommendations */}
      {recommendations && (
        <MuiCard sx={{ mt:  2 }}>
          <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUp sx={{ fontSize:  20, color: '#8B4513' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600,margin:  0 }}>Recommended for You</h3>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
              {recommendations.trending && recommendations.trending.length > 0 && (
                <Box>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Trending Now</h4>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    {recommendations.trending.map((rec: any, index: number) => (
                      <Box 
                        key={index}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          p: 1,
                          bgcolor: 'rgba(21, 191, 36, 0.1)', 
                          borderRadius: 2 }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>Vendor #{rec.vendorId}</span>
                        <Badge 
                          variant="outlined" 
                          label={rec.reason}
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              
              {recommendations.similar && recommendations.similar.length > 0 && (
                <Box>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Based on Your Timeline</h4>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    {recommendations.similar.map((rec: any, index: number) => (
                      <Box 
                        key={index}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          p: 1,
                          bgcolor: 'rgba(21, 191, 36, 0.1)', 
                          borderRadius: 2 }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>Vendor #{rec.vendorId}</span>
                        <Badge 
                          variant="outlined" 
                          label={rec.reason}
                          size="small"
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </CardContent>
        </MuiCard>
      )}
    </div>
  );
}