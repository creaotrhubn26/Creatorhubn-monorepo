import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import {
  WbSunny as SunIcon,
  Cloud as CloudIcon,
  Umbrella as UmbrellaIcon,
  AcUnit as SnowIcon,
  Thunderstorm as ThunderIcon,
  Air as WindIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface WeatherForecastCardProps {
  forecast?: {
    location: string;
    forecast: Array<{
      date: string;
      temperature: number;
      humidity: number;
      windSpeed: number;
      precipitation: number;
      symbol: string;
    }>;
    days: number;
    source: 'yr_api' | 'fallback';
  };
  alerts?: {
    location: string;
    alerts: Array<{
      id: string;
      severity: string;
      category: string;
      description: string;
      effective: string;
      expires: string;
      area: string;
    }>;
    source: 'yr_api' | 'fallback';
  };
  date?: string; // Production day date
}

export function WeatherForecastCard({ forecast, alerts, date }: WeatherForecastCardProps) {
  if (!forecast) {
    return (
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center' }}>
            Ingen værvarsel tilgjengelig
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Find forecast for the specific date if provided
  const dayForecast = date
    ? forecast.forecast.find(f => f.date.startsWith(date.split('T')[0]))
    : forecast.forecast[0];

  const getWeatherIcon = (symbol: string) => {
    if (symbol.includes('sun') || symbol.includes('clear')) {
      return <SunIcon sx={{ color: '#ffb800', fontSize: 32 }} />;
    } else if (symbol.includes('cloud')) {
      return <CloudIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 32 }} />;
    } else if (symbol.includes('rain')) {
      return <UmbrellaIcon sx={{ color: '#00d4ff', fontSize: 32 }} />;
    } else if (symbol.includes('snow')) {
      return <SnowIcon sx={{ color: '#fff', fontSize: 32 }} />;
    } else if (symbol.includes('thunder')) {
      return <ThunderIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />;
    }
    return <SunIcon sx={{ color: '#ffb800', fontSize: 32 }} />;
  };

  const getWeatherColor = (symbol: string) => {
    if (symbol.includes('sun') || symbol.includes('clear')) {
      return '#ffb800';
    } else if (symbol.includes('rain')) {
      return '#00d4ff';
    } else if (symbol.includes('snow')) {
      return '#fff';
    } else if (symbol.includes('thunder')) {
      return '#8b5cf6';
    }
    return 'rgba(255,255,255,0.7)';
  };

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            Værvarsel
          </Typography>
          {dayForecast && (
            <Chip
              label={dayForecast.date ? new Date(dayForecast.date).toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' }) : 'I dag'}
              size="small"
              sx={{
                bgcolor: 'rgba(0,212,255,0.2)',
                color: '#00d4ff',
                fontWeight: 600,
              }}
            />
          )}
        </Box>

        {dayForecast ? (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getWeatherIcon(dayForecast.symbol)}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ color: getWeatherColor(dayForecast.symbol), fontWeight: 700 }}>
                  {Math.round(dayForecast.temperature)}°C
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  {forecast.location}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WindIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.87)' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                      Vind
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {Math.round(dayForecast.windSpeed)} m/s
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <UmbrellaIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.87)' }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                      Nedbør
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {Math.round(dayForecast.precipitation)} mm
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                    Luftfuktighet
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                    {Math.round(dayForecast.humidity)}%
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {alerts && alerts.alerts.length > 0 && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon sx={{ color: '#ffb800', fontSize: 20 }} />
                    Værvarsler ({alerts.alerts.length})
                  </Typography>
                  <Stack spacing={1}>
                    {alerts.alerts.map((alert) => (
                      <Alert
                        key={alert.id}
                        severity={alert.severity === 'extreme' ? 'error' : alert.severity === 'severe' ? 'warning' : 'info'}
                        icon={<WarningIcon />}
                        sx={{
                          bgcolor: alert.severity === 'extreme' ? 'rgba(255,68,68,0.1)' : 'rgba(255,184,0,0.1)',
                          color: alert.severity === 'extreme' ? '#ff4444' : '#ffb800',
                          border: `1px solid ${alert.severity === 'extreme' ? 'rgba(255,68,68,0.3)' : 'rgba(255,184,0,0.3)'}`,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {alert.category}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          {alert.description}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8 }}>
                          Gyldig: {new Date(alert.effective).toLocaleString('no-NO')} - {new Date(alert.expires).toLocaleString('no-NO')}
                        </Typography>
                      </Alert>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center' }}>
            Ingen værvarsel for denne datoen
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

