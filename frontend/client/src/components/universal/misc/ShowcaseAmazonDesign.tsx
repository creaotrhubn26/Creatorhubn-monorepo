import { useTheming } from '@/utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  CardMedia,
  Grid,
  Button,
  Rating,
  Chip,
  Divider,
  Avatar,
  IconButton,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Favorite,
  ShoppingCart,
  Verified,
  LocalShipping,
  Security,
} from '@mui/icons-material';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface ShowcaseAmazonDesignProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
}

export default function ShowcaseAmazonDesign({
  profession = 'photographer',
}: ShowcaseAmazonDesignProps) {
  const queryClient = useQueryClient();
  
  // Dynamic profession system integration
  const { professionConfigs } = useProfessionConfigs();
  const { getProfessionConfig } = useDynamicProfessions();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const [selectedImage, setSelectedImage] = useState(0);

  // Get profession-specific configuration
  const currentProfessionConfig = getProfessionConfig(profession);
  const professionConfig = professionConfigs?.[profession];
  const professionIcon = getProfessionIcon(profession);
  
  // Get profession color from config or fallback
  const color = currentProfessionConfig?.iconColor || 
                professionConfig?.color || 
                professionConfig?.iconColor || 
                theming.colors.primary;

  // Database connection for ShowcaseAmazonDesign (available for future use)
  useQuery({
    queryKey: ['/api/component/user-data'],
    queryFn: () => apiRequest('/api/component/user-data'),
    retry: false,
  });

  // Mutation for updating component data (available for future use)
  useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/component/update', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component'] });
    },
  });

  const showcaseItem = {
    title: 'Bryllupsfotografering - Premium Pakke',
    subtitle: 'Komplett bryllupsdokumentasjon med 500+ redigerte bilder',
    price: '5,000',
    originalPrice: '7,000',
    rating: 4.8,
    reviewCount: 17,
    inStock: true,
    deliveryTime: '2-3 uker etter bryllup',
    photographer: {
      name: 'Lars Nordahl',
      verified: true,
      rating: 4.9,
      totalPhotos: '2,500+',
    },
    features: [
      'Hele dagen dekning (12 timer)','Professionell redigering av alle bilder','Online galleri med delingsmuligheter','Utskriftsrettigheter inkludert','Backup på sikre servere i 5 år','Gratis konsultasjon før bryllup',
    ],
    images: [
      'https://images.unsplash.com/photo-1606914469632-7d4e70b3664a?w=400&h=400&fit=crop','https://images.unsplash.com/photo-1519741497674-611481863552?w=400&h=400&fit=crop','https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=400&fit=crop','https://images.unsplash.com/photo-1502780402662-acc01917753e?w=400&h=400&fit=crop',
    ],
    reviews: [
      {
        name: 'Emma Larsen',
        rating: 5,
        comment: 'Fantastiske bilder! Lars fanget alle de perfekte øyeblikkene.',
        date: '2 uker siden',
      },
      {
        name: 'Kari Hansen',
        rating: 5,
        comment: 'Profesjonell, vennlig og levererte over forventning.',
        date: '1 måned siden',
      },
      {
        name: 'Ole Johansen',
        rating: 4,
        comment: 'Meget fornøyd med resultatet. Anbefales!',
        date: '6 uker siden',
      },
    ],
  };

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: 'auto' }}>
      <MuiCard
        sx={{
          border: '1px solid #ddd',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}
      >
        <CardContent sx={{ p: 0,...theming.getThemedCardSx() }}>
          <Grid container>
            {/* Bildeområde - Amazon stil */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2 }}>
                <MuiCard sx={{ mb: 2, border: '1px solid #ddd' }}>
                  <CardMedia
                    component="img"
                    image={showcaseItem.images[selectedImage]}
                    sx={{
                      height: 400,
                      bgcolor: '#f8f8f0',
                      objectFit: 'cover',
                      position: 'relative'}}
                  />
                  <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                    <IconButton
                      sx={{
                        bgcolor: 'white',
                        '&:hover': { bgcolor: '#f5f5f5' }}}
                    >
                      <Favorite sx={{ color: '#ff6b6b' }} />
                    </IconButton>
                  </Box>
                </MuiCard>

                <Grid container spacing={1}>
                  {showcaseItem.images.map((img, index) => (
                    <Grid item xs={3} key={index}>
                      <MuiCard
                        sx={{
                          cursor: 'pointer',
                          border: selectedImage === index ? `2px solid ${color}` : '1px solid #ddd',
                          '&:hover': { borderColor: color }}}
                        onClick={() => setSelectedImage(index)}
                      >
                        <CardMedia
                          component="img"
                          image={img}
                          sx={{
                            height: 80,
                            objectFit: 'cover'}}
                        />
                      </MuiCard>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>

            {/* Produktinformasjon - Amazon stil */}
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {professionIcon && (
                    <Box sx={{ color: color, display: 'flex', alignItems: 'center' }}>
                      {React.cloneElement(professionIcon, { sx: { fontSize: 28 } })}
                    </Box>
                  )}
                  <Typography variant="h5" sx={{ fontWeight: 400, color: theming.colors.primary }}>
                    {showcaseItem.title}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {showcaseItem.subtitle}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Rating value={showcaseItem.rating} precision={0.1} readOnly size="small" />
                  <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
                    {showcaseItem.reviewCount} anmeldelser
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 400}}>
                      {showcaseItem.price} kr
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        textDecoration: 'line-through',
                        color: 'text.secondary'}}
                    >
                      {showcaseItem.originalPrice} kr
                    </Typography>
                    <Chip label="29% RABATT" color="error" size="small" />
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    Inkludert mva. og alle avgifter
                  </Typography>
                </Box>

                {/* Profession info with icon */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: '#f8f8f0',
                    borderRadius: 1,
                    mb: 2}}
                >
                  <Avatar sx={{ bgcolor: color }}>
                    {professionIcon ? (
                      <Box sx={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {React.cloneElement(professionIcon, { sx: { fontSize: 24 } })}
                      </Box>
                    ) : (
                      showcaseItem.photographer.name.charAt(0)
                    )}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {showcaseItem.photographer.name}
                      </Typography>
                      {showcaseItem.photographer.verified && (
                        <Verified sx={{ fontSize: 16, color: '#1976d2' }} />
                      )}
                      {currentProfessionConfig && (
                        <Chip
                          label={currentProfessionConfig.displayName}
                          size="small"
                          sx={{
                            bgcolor: color,
                            color: 'white',
                            fontSize: '0.7rem',
                            height: 20
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating
                        value={showcaseItem.photographer.rating}
                        precision={0.1}
                        readOnly
                        size="small"
                      />
                      <Typography variant="caption">
                        {showcaseItem.photographer.totalPhotos} levert
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Leveringsinformasjon */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocalShipping sx={{ color: '#007600', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: '#007600', fontWeight: 600}}>
                      Levering: {showcaseItem.deliveryTime}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Security sx={{ color: '#007600', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ color: '#007600' }}>
                      Sikker betaling og 30 dagers returrett
                    </Typography>
                  </Box>

                  <Chip
                    label={showcaseItem.inStock ? 'Tilgjengelig for booking' : 'Ikke tilgjengelig'}
                    color={showcaseItem.inStock ? 'success' : 'error'}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                </Box>

                {/* Handlingsknapper - Amazon stil */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      bgcolor: '#FF9900',
                      color: 'black',
                      fontWeight: 400,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#FF8C00' },
                      ...theming.getThemedButtonSx()}}
                  >
                    Book nå
                  </Button>

                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      bgcolor: '#FFA410',
                      color: 'black',
                      fontWeight: 400,
                      textTransform: 'none', '&:hover': { bgcolor: '#FF9300' },
                      ...theming.getThemedButtonSx()}}
                  >
                    <ShoppingCart sx={{ mr: 1 }} />
                    Send forespørsel
                  </Button>
                </Box>

                {/* Funksjoner */}
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                  Inkludert i pakken:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {showcaseItem.features.map((feature, index) => (
                    <Typography component="li" variant="body2" key={index} sx={{ mb: 0.5 }}>
                      {feature}
                    </Typography>
                  ))}
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Divider />

          {/* Anmeldelser seksjon */}
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theming.colors.primary }}>
              Kundeanmeldelser
            </Typography>

            {showcaseItem.reviews.map((review, index) => (
              <Box
                key={index}
                sx={{
                  mb: 3,
                  pb: 2,
                  borderBottom: index < showcaseItem.reviews.length - 1 ? '1px solid #eee' : 'none'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: color,
                      fontSize: '0.875rem'}}
                  >
                    {review.name.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {review.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {review.date}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Rating value={review.rating} readOnly size="small" />
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {review.rating === 5 ? 'Utmerket' : review.rating === 4 ? 'Meget bra' : 'Bra'}
                  </Typography>
                </Box>

                <Typography variant="body2">{review.comment}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </MuiCard>
    </Box>
  );
}
