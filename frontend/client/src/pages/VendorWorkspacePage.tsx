import React from 'react';
import { Box, Card, Chip, Stack, Typography } from '@mui/material';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import VendorProductManager from '@/components/vendor/VendorProductManager';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';
import { ws, type WsNavItem } from '@/components/workspace/workspaceTheme';
import { FileManagementStatusProvider } from '@/contexts/FileManagementStatusContext';

const vendorNav: WsNavItem[] = [
  { key: 'produkter', label: 'Produkter', labelEn: 'Products', icon: 'Inventory2', group: 'hoved', route: true, categories: ['vendor'] },
  { key: 'bookinger', label: 'Bookinger', labelEn: 'Bookings', icon: 'EventAvailable', group: 'hoved', route: true, categories: ['vendor'] },
  { key: 'prosjekter', label: 'Prosjekter', labelEn: 'Projects', icon: 'AccountTree', group: 'hoved', route: true, categories: ['vendor'] },
  { key: 'team', label: 'Team', labelEn: 'Team', icon: 'Group', group: 'hoved', route: true, categories: ['vendor'] },
];

export default function VendorWorkspacePage() {
  const { user, logout, isLoading } = useAuth();
  const [, navigate] = useLocation();
  if (isLoading) return <Box sx={{ minHeight: '100vh', bgcolor: ws.bg }} />;
  if (!user?.id) {
    if (typeof window !== 'undefined') window.location.replace('/login?returnPath=/vendor-dashboard');
    return null;
  }

  const displayName = user.businessName || user.displayName || user.name || 'Vendor';
  const onTab = (key: string) => {
    if (key === 'bookinger') navigate('/booking');
    else if (key === 'prosjekter') navigate('/workspace?pick=1');
    else if (key === 'team') navigate('/profil');
  };

  return (
    <WorkspaceShell
      project={{ id: `vendor-${user.id}`, name: displayName, type: 'Vendor Workspace', status: 'Aktiv', members: [] }}
      user={{ name: user.name || displayName, role: 'Vendor', email: user.email, avatarUrl: user.picture || null }}
      activeTab="produkter"
      onTab={onTab}
      navItems={vendorNav}
      onNewProject={() => navigate('/workspace?new=1')}
      onLogout={() => logout()}
      showMediaAccessBanner={false}
      headerActions={<Chip label="Enterprise produkt-API" size="small" sx={{ bgcolor: ws.accentSoft, color: ws.accent, border: `1px solid ${ws.accentBorder}`, fontWeight: 700 }} />}
    >
      <Stack spacing={2.5}>
        <Card sx={{ p: { xs: 2, md: 2.5 }, bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, boxShadow: 'none' }}>
          <Typography variant="overline" sx={{ color: ws.accent, fontWeight: 800, letterSpacing: 1.2 }}>Vendor</Typography>
          <Typography variant="h5" component="h1" sx={{ color: ws.text, fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>Produktkatalog</Typography>
          <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.75, maxWidth: 760 }}>
            Administrer produkter, publisering, lagerdata og sikker API-tilgang fra samme CreatorHub Workspace.
          </Typography>
        </Card>
        <Box sx={{
          bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, overflow: 'hidden',
          '& .MuiCard-root': { bgcolor: ws.panelSolid, borderColor: ws.border },
          '& .MuiDialog-paper': { bgcolor: ws.panelSolid },
          '& .MuiTabs-indicator': { bgcolor: ws.accent },
          '& .MuiTab-root.Mui-selected': { color: ws.accent },
        }}>
          <FileManagementStatusProvider>
            <VendorProductManager userId={user.id} vendorType="general" />
          </FileManagementStatusProvider>
        </Box>
      </Stack>
    </WorkspaceShell>
  );
}
