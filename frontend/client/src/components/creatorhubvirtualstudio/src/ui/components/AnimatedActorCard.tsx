/**
 * Animated Actor Card
 * 
 * Displays actor preview with genre-specific idle animations
 * and mood-based movement characteristics.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Card, CardContent, CardActions, Typography, Chip, Divider, Button, IconButton, Tooltip } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { CachedActor } from '../../core/services/actorModelCache';
import { SKIN_TONES } from '../../core/data/actorPresets';
import { getPreviewAnimation, getMoodAnimation, PREVIEW_ANIMATIONS } from '../../core/animations/CharacterAnimations';

interface AnimatedActorCardProps {
  actor: CachedActor;
  onAddToScene: (actor: CachedActor) => void;
  onDelete: (id: string) => void;
}

// Inject all animation keyframes once
let stylesInjected = false;
function injectAnimationStyles() {
  if (stylesInjected) return;
  
  const styleSheet = document.createElement('style, ');
  styleSheet.id = 'actor-preview-animations';
  
  const allKeyframes = Object.values(PREVIEW_ANIMATIONS)
    .map(anim => anim.keyframes)
    .join('\n,');
  
  styleSheet.textContent = allKeyframes;
  document.head.appendChild(styleSheet);
  stylesInjected = true;
}

export const AnimatedActorCard: React.FC<AnimatedActorCardProps> = ({ actor, onAddToScene, onDelete }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Inject styles on first render
  useEffect(() => {
    injectAnimationStyles();
  }, []);

  // Get animation based on genre
  const previewAnimation = useMemo(() => {
    return getPreviewAnimation(actor.metadata?.genre);
  }, [actor.metadata?.genre]);

  // Get mood parameters for intensity
  const moodParams = useMemo(() => {
    return getMoodAnimation(actor.metadata?.mood);
  }, [actor.metadata?.mood]);

  // Calculate animation style
  const animationStyle = useMemo(() => {
    const duration = parseFloat(previewAnimation.duration) / moodParams.speed;
    return {
      animation: `${previewAnimation.name} ${duration}s ${previewAnimation.timing} infinite`,
      transformOrigin: 'center bottom',
    };
  }, [previewAnimation, moodParams]);

  // Character silhouette based on body type
  const silhouetteStyle = useMemo(() => {
    const { gender, height, weight, muscle } = actor.parameters;
    
    // Calculate proportions
    const shoulderWidth = 30 + (gender * 15) + (muscle * 10);
    const hipWidth = 35 - (gender * 10) + (weight * 8);
    const chestSize = 25 + (muscle * 15) + (weight * 5);
    const waistSize = 20 + (weight * 12);
    const heightScale = 0.8 + (height * 0.4);
    
    return {
      '--shoulder-width': `${shoulderWidth}px`'--hip-width': `${hipWidth}px`'--chest-size': `${chestSize}px`'--waist-size': `${waistSize}px`'--height-scale': heightScale,
    } as React.CSSProperties;
  }, [actor.parameters]);

  // Get genre-specific color
  const genreColor = useMemo(() => {
    const colors: Record<string, string> = {
      'cosmic-horror':'#4a1a6b','horror':'#8b0000','action':'#ff6b00','sci-fi':'#00a8ff','fantasy':'#9370db','western':'#cd853f','film-noir':'#2c2c2c','period-drama':'#8b7355','asian-cinema':'#c41e3a','superhero':'#1e90ff','profession' : '#2e8b57', // Sea green for professionals
    };
    return colors[actor.metadata?.genre || ', '] || '#555';
  }, [actor.metadata?.genre]);

  return (
    <Card 
      ref={cardRef}
      sx={{ 
        backgroundColor: '#2a2a2a', '&:hover': { 
          backgroundColor: '#333','& .character-silhouette': {
            transform: 'scale(1.05)',
          }
        },
        position: 'relative',
        overflow: 'hidden'}}
    >
      {/* Animated character preview area */}
      <Box 
        sx={{ 
          height: 80, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: `linear-gradient(180deg, ${genreColor}22 0%, transparent 100%)`,
          position: 'relative',
          overflow: 'hidden'}}
      >
        {/* Animated silhouette */}
        <Box
          className="character-silhouette"
          sx={{
            width: 40,
            height: 60,
            position: 'relative',
            transition: 'transform 0.3s ease',
            ...animationStyle,
            ...silhouetteStyle}}
        >
          {/* Simple animated character silhouette */}
          <svg viewBox="0 0 40 60" style={{ width: '100%', height: '100%' }}>
            {/* Head */}
            <circle 
              cx="20" 
              cy="8" 
              r="7" 
              fill={SKIN_TONES[actor.skinTone] || '#888'}
              opacity="0.9"
            />
            {/* Hair indicator */}
            {actor.appearance?.hairStyle && (
              <ellipse 
                cx="20" 
                cy="5" 
                rx="6" 
                ry="4" 
                fill={actor.appearance.hairColor === 'black' ? '#1a1a1a' : 
                      actor.appearance.hairColor === 'blonde' ? '#d4af37' :
                      actor.appearance.hairColor?.includes('grey') ? '#808080' :
                      actor.appearance.hairColor?.includes('red') ? '#8b4513' :
                      '#4a3728'}
              />
            )}
            {/* Body */}
            <path 
              d={`M 12 15 
                  Q 10 25, ${15 - actor.parameters.gender * 3 + actor.parameters.weight * 5} 30 
                  L ${15 + actor.parameters.weight * 3} 55 
                  L ${25 - actor.parameters.weight * 3} 55 
                  Q ${25 + actor.parameters.gender * 3 - actor.parameters.weight * 5} 30, 28 15 
                  Z`}
              fill={genreColor}
              opacity="0.8"
            />
            {/* Arms */}
            <line x1="10" y1="18" x2="5" y2="35" stroke={SKIN_TONES[actor.skinTone] || '#888'} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
            <line x1="30" y1="18" x2="35" y2="35" stroke={SKIN_TONES[actor.skinTone] || '#888'} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
            {/* Facial hair indicator */}
            {actor.appearance?.facialHair && actor.appearance.facialHair !== 'clean-shaven' && (
              <ellipse cx="20" cy="12" rx="4" ry="2" fill="#333" opacity="0.5" />
            )}
            {/* Eye glow for horror/cosmic */}
            {(actor.metadata?.genre === 'cosmic-horror' || actor.metadata?.genre === 'horror') && (
              <>
                <circle cx="17" cy="7" r="1" fill="#fff" opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="23" cy="7" r="1" fill="#fff" opacity="0.8">
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </svg>
        </Box>

        {/* Mood indicator */}
        {actor.metadata?.mood && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              fontSize: '0.6rem',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: 1}}
          >
            {actor.metadata.mood}
          </Box>
        )}
      </Box>

      <CardContent sx={{ pb: 1, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
            {actor.name}
          </Typography>
          {actor.metadata?.genre && (
            <Chip 
              label={actor.metadata.genre.replace(/-/g, ', ')} 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.6rem',
                backgroundColor: genreColor,
                color: '#fff'}}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.2 }}>
          {actor.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: actor.appearance?.hairStyle ? 0.5 : 0 }}>
          <Chip 
            label={`${actor.parameters.age}y`} 
            size="small" 
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
          <Chip 
            label={actor.parameters.gender === 0 ? 'F' : actor.parameters.gender === 1 ? 'M' : 'N'}
            size="small"
            sx={{ height: 18, fontSize: '0.65rem' }}
          />
          <Chip
            size="small"
            sx={{ 
              height: 18, 
              fontSize: '0.65rem',
              backgroundColor: SKIN_TONES[actor.skinTone] || '#888',
              color: actor.skinTone === 'dark' || actor.skinTone === 'brown' ? '#fff' : '#000'
            }}
            label={actor.skinTone}
          />
        </Box>
        {/* Extended character properties */}
        {actor.appearance && (actor.appearance.hairStyle || actor.appearance.facialHair) && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {actor.appearance.hairStyle && (
              <Chip 
                label={actor.appearance.hairStyle.replace(/-/g, ' ')} 
                size="small" 
                variant="outlined"
                sx={{ height: 16, fontSize: '0.55rem', borderColor: '#555' }}
              />
            )}
            {actor.appearance.facialHair && actor.appearance.facialHair !== 'clean-shaven' && (
              <Chip 
                label={actor.appearance.facialHair.replace(/-/g, ' ')} 
                size="small" 
                variant="outlined"
                sx={{ height: 16, fontSize: '0.55rem', borderColor: '#555' }}
              />
            )}
            {actor.metadata?.era && (
              <Chip 
                label={actor.metadata.era} 
                size="small" 
                variant="outlined"
                sx={{ height: 16, fontSize: '0.55rem', borderColor: '#666' }}
              />
            )}
          </Box>
        )}
        {/* Costume preview */}
        {actor.costume?.clothingStyle && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', fontSize: '0.65rem' }}>
            {actor.costume.clothingStyle.replace(/-/g, ', ')}
            {actor.costume.accessories && actor.costume.accessories.length > 0 && 
              ` + ${actor.costume.accessories.length} items`}
          </Typography>
        )}
      </CardContent>
      <Divider />
      <CardActions sx={{ justifyContent: 'space-between', pt: 0.5, pb: 0.5 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => onAddToScene(actor)}
          sx={{ fontSize: '0.75rem' }}
        >
          Add to Scene
        </Button>
        <Tooltip title="Remove from library">
          <IconButton 
            size="small" 
            onClick={() => onDelete(actor.id)}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
};

export default AnimatedActorCard;

