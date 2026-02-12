import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Rating,
  LinearProgress,
  Collapse,
} from '@mui/material';
import {
  Star,
  StarBorder,
  RateReview,
  Refresh,
  Person,
  ExpandMore,
  ExpandLess,
  Reply,
  VisibilityOff,
} from '@mui/icons-material';

interface VendorResponse {
  body: string;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  title?: string;
  body?: string;
  isAnonymous: boolean;
  createdAt: string;
  vendorResponse: VendorResponse | null;
}

interface ReviewsResponse {
  reviews: Review[];
  vendorId: string;
  totalReviews: number;
  averageRating: number;
}

interface EvendiReviewsProps {
  vendorId: string;
  vendorName?: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function getRatingColor(rating: number): string {
  if (rating >= 4.5) return '#4CAF50';
  if (rating >= 3.5) return '#8BC34A';
  if (rating >= 2.5) return '#FFC107';
  if (rating >= 1.5) return '#FF9800';
  return '#f44336';
}

export default function EvendiReviews({ vendorId, vendorName }: EvendiReviewsProps) {
  const { toast } = useToast();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (vendorId) loadReviews();
  }, [vendorId]);

  async function loadReviews() {
    setLoading(true);
    try {
      const result: ReviewsResponse = await apiRequest(`/api/evendi/reviews/${vendorId}`);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load reviews:', err);
      toast({ title: 'Feil', description: 'Kunne ikke hente anmeldelser', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // Build rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: data?.reviews?.filter(r => r.rating === stars).length || 0,
    percent: data?.totalReviews ? ((data.reviews.filter(r => r.rating === stars).length / data.totalReviews) * 100) : 0,
  }));

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RateReview sx={{ color: '#FFB300' }} />
            <Typography variant="h6">Anmeldelser</Typography>
            {vendorName && (
              <Chip
                size="small"
                label={vendorName}
                sx={{ ml: 1, bgcolor: 'rgba(255, 179, 0, 0.1)', color: '#FF8F00' }}
              />
            )}
          </Box>
          <Tooltip title="Oppdater">
            <IconButton size="small" onClick={loadReviews} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Empty state */}
        {!loading && (!data?.reviews || data.reviews.length === 0) && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <StarBorder sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              Ingen godkjente anmeldelser ennå.
            </Typography>
          </Box>
        )}

        {data && data.reviews.length > 0 && (
          <>
            {/* Summary Stats */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, p: 2, bgcolor: 'rgba(255, 179, 0, 0.04)', borderRadius: 2 }}>
              {/* Big average score */}
              <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                <Typography variant="h3" fontWeight={700} sx={{ color: getRatingColor(data.averageRating), lineHeight: 1 }}>
                  {data.averageRating.toFixed(1)}
                </Typography>
                <Rating
                  value={data.averageRating}
                  precision={0.1}
                  readOnly
                  size="small"
                  sx={{ mt: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  {data.totalReviews} anmeldelse{data.totalReviews !== 1 ? 'r' : ''}
                </Typography>
              </Box>

              {/* Rating distribution bars */}
              <Box sx={{ flex: 1 }}>
                {ratingDistribution.map(({ stars, count, percent }) => (
                  <Box key={stars} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    <Typography variant="caption" sx={{ minWidth: 12, textAlign: 'right' }}>{stars}</Typography>
                    <Star sx={{ fontSize: 14, color: '#FFB300' }} />
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(0,0,0,0.06)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getRatingColor(stars),
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20, textAlign: 'right' }}>
                      {count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Review list */}
            {data.reviews.map((review, index) => (
              <React.Fragment key={review.id}>
                {index > 0 && <Divider sx={{ my: 1.5 }} />}
                <Box sx={{ py: 1 }}>
                  {/* Review header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating value={review.rating} readOnly size="small" />
                      {review.isAnonymous && (
                        <Tooltip title="Anonym anmeldelse">
                          <VisibilityOff sx={{ fontSize: 16, color: 'text.disabled' }} />
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(review.createdAt)}
                    </Typography>
                  </Box>

                  {/* Title */}
                  {review.title && (
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                      {review.title}
                    </Typography>
                  )}

                  {/* Body (expandable if long) */}
                  {review.body && (
                    <>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          ...(review.body.length > 200 && expandedReviewId !== review.id ? {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                          } : {}),
                        }}
                      >
                        {review.body}
                      </Typography>
                      {review.body.length > 200 && (
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mt: 0.5, color: 'primary.main' }}
                          onClick={() => setExpandedReviewId(prev => prev === review.id ? null : review.id)}
                        >
                          <Typography variant="caption" fontWeight={500}>
                            {expandedReviewId === review.id ? 'Vis mindre' : 'Les mer'}
                          </Typography>
                          {expandedReviewId === review.id ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                        </Box>
                      )}
                    </>
                  )}

                  {/* Vendor response */}
                  {review.vendorResponse && (
                    <Box sx={{
                      mt: 1.5,
                      ml: 2,
                      pl: 2,
                      borderLeft: '3px solid',
                      borderColor: 'primary.light',
                      bgcolor: 'rgba(25, 118, 210, 0.04)',
                      borderRadius: '0 8px 8px 0',
                      py: 1,
                      pr: 1.5,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Reply sx={{ fontSize: 14, color: 'primary.main' }} />
                        <Typography variant="caption" fontWeight={600} color="primary.main">
                          Svar fra leverandør
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          {formatDate(review.vendorResponse.createdAt)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {review.vendorResponse.body}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </React.Fragment>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
