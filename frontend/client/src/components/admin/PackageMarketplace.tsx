import { useMemo, useState, type FC } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Download,
  Error,
  InfoOutlined,
  Refresh,
  Search,
  Store,
  Warning,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  AdminCard,
  AdminButton,
  StatusChip,
  AdminLoading,
  AdminEmpty,
  AdminError,
  AdminTableContainer,
  adminTokens,
  useIsMobile,
} from './design-system';

interface MarketplacePackage {
  name: string;
  current: string;
  latest: string;
  category: string;
  description: string;
  downloads: number;
  rating: number;
  vulnerabilities: number;
  isOutdated: boolean;
  installed: boolean;
  repository?: string;
  license?: string;
  size?: string;
  lastUpdated?: string;
}

interface MarketplaceSummary {
  total: number;
  installed: number;
  outdated: number;
  vulnerable: number;
}

interface MarketplaceResponse {
  packages: MarketplacePackage[];
  summary: MarketplaceSummary;
}

interface RepositoryInfo {
  id: string;
  name: string;
  url: string;
  type: 'npm' | 'github' | 'private' | 'custom';
  trusted: boolean;
  status: 'active' | 'inactive' | 'error';
  packageCount: number;
}

const fallbackPackages: MarketplacePackage[] = [
  {
    name: 'react',
    current: '18.2.0',
    latest: '19.0.0',
    category: 'ui',
    description: 'UI library for component-driven applications.',
    downloads: 35400000,
    rating: 4.9,
    vulnerabilities: 0,
    isOutdated: true,
    installed: true,
    repository: 'https://github.com/facebook/react',
    license: 'MIT',
    size: '2.8 MB',
    lastUpdated: '2026-02-15',
  },
  {
    name: '@tanstack/react-query',
    current: '5.62.0',
    latest: '5.66.1',
    category: 'data',
    description: 'Powerful asynchronous state and caching for React apps.',
    downloads: 7600000,
    rating: 4.8,
    vulnerabilities: 0,
    isOutdated: true,
    installed: true,
    repository: 'https://github.com/TanStack/query',
    license: 'MIT',
    size: '1.1 MB',
    lastUpdated: '2026-02-21',
  },
  {
    name: 'zod',
    current: '3.24.0',
    latest: '3.24.0',
    category: 'validation',
    description: 'Type-safe schema validation for forms and API payloads.',
    downloads: 14900000,
    rating: 4.9,
    vulnerabilities: 0,
    isOutdated: false,
    installed: true,
    repository: 'https://github.com/colinhacks/zod',
    license: 'MIT',
    size: '620 KB',
    lastUpdated: '2026-01-10',
  },
  {
    name: 'legacy-audit-lib',
    current: '1.4.2',
    latest: '1.4.2',
    category: 'security',
    description: 'Legacy audit helper pending migration.',
    downloads: 12000,
    rating: 3.4,
    vulnerabilities: 2,
    isOutdated: false,
    installed: true,
    repository: 'https://example.com/legacy-audit-lib',
    license: 'Apache-2.0',
    size: '410 KB',
    lastUpdated: '2025-11-02',
  },
  {
    name: 'remark',
    current: '15.0.1',
    latest: '15.1.0',
    category: 'content',
    description: 'Markdown parser and AST processing toolkit.',
    downloads: 2100000,
    rating: 4.6,
    vulnerabilities: 0,
    isOutdated: true,
    installed: false,
    repository: 'https://github.com/remarkjs/remark',
    license: 'MIT',
    size: '300 KB',
    lastUpdated: '2026-02-19',
  },
];

const fallbackRepositories: RepositoryInfo[] = [
  {
    id: 'repo-1',
    name: 'npmjs.org',
    url: 'https://registry.npmjs.org',
    type: 'npm',
    trusted: true,
    status: 'active',
    packageCount: 2800000,
  },
  {
    id: 'repo-2',
    name: 'CreatorHub Internal Registry',
    url: 'https://packages.creatorhub.no',
    type: 'private',
    trusted: true,
    status: 'active',
    packageCount: 124,
  },
];

function tabA11yProps(index: number) {
  return {
    id: `package-marketplace-tab-${index}`,
    'aria-controls': `package-marketplace-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`package-marketplace-tabpanel-${index}`}
      aria-labelledby={`package-marketplace-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index ? children : null}
    </Box>
  );
}

async function safeApiRequest<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiRequest(url);
    return response as T;
  } catch {
    return fallback;
  }
}

function packageStatusIcon(pkg: MarketplacePackage) {
  if (pkg.vulnerabilities > 0) {
    return <Error color="error" fontSize="small" />;
  }

  if (pkg.isOutdated) {
    return <Warning color="warning" fontSize="small" />;
  }

  return <CheckCircle color="success" fontSize="small" />;
}

function generateInstallScript(packages: MarketplacePackage[]): string {
  const targets = packages.filter((pkg) => pkg.isOutdated || !pkg.installed).map((pkg) => `${pkg.name}@${pkg.latest}`);

  const installLine = targets.length > 0 ? `npm install ${targets.join(' ')}` : 'echo "No package updates required"';

  return `#!/usr/bin/env bash
set -euo pipefail

echo "Starting CreatorHub package refresh"
${installLine}
echo "Done"
`;
}

const PackageMarketplace: FC = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [packageDetails, setPackageDetails] = useState<MarketplacePackage | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const marketplaceQuery = useQuery({
    queryKey: ['/api/admin/dependencies-manager/marketplace'],
    queryFn: async () => {
      const fallback: MarketplaceResponse = {
        packages: fallbackPackages,
        summary: {
          total: fallbackPackages.length,
          installed: fallbackPackages.filter((pkg) => pkg.installed).length,
          outdated: fallbackPackages.filter((pkg) => pkg.isOutdated).length,
          vulnerable: fallbackPackages.filter((pkg) => pkg.vulnerabilities > 0).length,
        },
      };

      return safeApiRequest<MarketplaceResponse>('/api/admin/dependencies-manager/marketplace', fallback);
    },
  });

  const repositoriesQuery = useQuery({
    queryKey: ['/api/admin/dependencies-manager/repositories'],
    queryFn: async () =>
      safeApiRequest<RepositoryInfo[]>('/api/admin/dependencies-manager/repositories', fallbackRepositories),
  });

  const installMutation = useMutation({
    mutationFn: async (payload: { name: string; version: string }) => {
      await apiRequest('/api/admin/dependencies-manager/install', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: async () => {
      setSnackbarMessage('Package install completed.');
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/dependencies-manager/marketplace'] });
    },
    onError: () => {
      setSnackbarMessage('Package install failed.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { name: string; version: string }) => {
      await apiRequest('/api/admin/dependencies-manager/update', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: async () => {
      setSnackbarMessage('Package update completed.');
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/dependencies-manager/marketplace'] });
    },
    onError: () => {
      setSnackbarMessage('Package update failed.');
    },
  });

  const packages = Array.isArray(marketplaceQuery.data?.packages) ? marketplaceQuery.data.packages : fallbackPackages;
  const summary = marketplaceQuery.data?.summary ?? {
    total: fallbackPackages.length,
    installed: fallbackPackages.filter((pkg) => pkg.installed).length,
    outdated: fallbackPackages.filter((pkg) => pkg.isOutdated).length,
    vulnerable: fallbackPackages.filter((pkg) => pkg.vulnerabilities > 0).length,
  };

  const repositories = Array.isArray(repositoriesQuery.data) ? repositoriesQuery.data : fallbackRepositories;
  const isLoading = marketplaceQuery.isLoading || repositoriesQuery.isLoading;

  const categories = useMemo(() => {
    const map = packages.reduce<Record<string, number>>((acc, pkg) => {
      acc[pkg.category] = (acc[pkg.category] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(map)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, count]) => ({ category, count }));
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || pkg.category === selectedCategory;
      const matchesInstalled = !showInstalledOnly || pkg.installed;

      return matchesSearch && matchesCategory && matchesInstalled;
    });
  }, [packages, searchQuery, selectedCategory, showInstalledOnly]);

  const handleRefresh = async () => {
    await Promise.all([marketplaceQuery.refetch(), repositoriesQuery.refetch()]);
  };

  const openDetails = (pkg: MarketplacePackage) => {
    setPackageDetails(pkg);
    setDetailsDialogOpen(true);
  };

  const openScriptDialog = () => {
    setGeneratedScript(generateInstallScript(filteredPackages));
    setScriptDialogOpen(true);
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(generatedScript);
    setSnackbarMessage('Script copied to clipboard.');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Store color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h5" component="h2" fontWeight={700}>
              Package Marketplace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Install, update and audit dependency packages.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <AdminButton tone="secondary" startIcon={<Refresh />} onClick={handleRefresh}>
            Refresh
          </AdminButton>
          <AdminButton tone="secondary" startIcon={<Download />} onClick={openScriptDialog}>
            Generate Script
          </AdminButton>
        </Stack>
      </Stack>

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Packages
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {summary.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Installed
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {summary.installed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Outdated
              </Typography>
              <Typography variant="h5" fontWeight={700} color={summary.outdated > 0 ? 'warning.main' : 'text.primary'}>
                {summary.outdated}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Vulnerabilities
              </Typography>
              <Typography variant="h5" fontWeight={700} color={summary.vulnerable > 0 ? 'error.main' : 'success.main'}>
                {summary.vulnerable}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          <Tab label="Packages" {...tabA11yProps(0)} />
          <Tab label="Repositories" {...tabA11yProps(1)} />
          <Tab label="Health" icon={<InfoOutlined />} iconPosition="start" {...tabA11yProps(2)} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search packages"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="package-category-filter-label">Category</InputLabel>
              <Select
                labelId="package-category-filter-label"
                label="Category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {categories.map((entry) => (
                  <MenuItem key={entry.category} value={entry.category}>
                    {entry.category} ({entry.count})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">Installed only</Typography>
              <Switch aria-label="Vis kun installerte pakker" checked={showInstalledOnly} onChange={(event) => setShowInstalledOnly(event.target.checked)} />
            </Stack>
          </Stack>

          <AdminCard disablePadding>
            <AdminTableContainer ariaLabel="Packages">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Downloads</TableCell>
                    <TableCell>Rating</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPackages.map((pkg) => (
                    <TableRow key={pkg.name} hover>
                      <TableCell>{packageStatusIcon(pkg)}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{pkg.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {pkg.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{pkg.current}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          latest: {pkg.latest}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={pkg.category} variant="outlined" />
                      </TableCell>
                      <TableCell>{pkg.downloads.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>{pkg.rating.toFixed(1)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View package details">
                            <AdminButton tone="secondary" size="small" onClick={() => openDetails(pkg)}>
                              Details
                            </AdminButton>
                          </Tooltip>
                          {pkg.installed ? (
                            <AdminButton
                              tone="primary"
                              size="small"
                              loading={updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ name: pkg.name, version: pkg.latest })}
                              disabled={!pkg.isOutdated || updateMutation.isPending}
                            >
                              Update
                            </AdminButton>
                          ) : (
                            <AdminButton
                              tone="primary"
                              size="small"
                              loading={installMutation.isPending}
                              onClick={() => installMutation.mutate({ name: pkg.name, version: pkg.latest })}
                              disabled={installMutation.isPending}
                            >
                              Install
                            </AdminButton>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </AdminCard>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <AdminCard disablePadding>
            <AdminTableContainer ariaLabel="Repositories">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Trust</TableCell>
                    <TableCell>Packages</TableCell>
                    <TableCell>URL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {repositories.map((repository) => (
                    <TableRow key={repository.id} hover>
                      <TableCell>{repository.name}</TableCell>
                      <TableCell>{repository.type}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={repository.status}
                          tone={repository.status === 'active' ? 'success' : repository.status === 'error' ? 'error' : 'neutral'}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusChip label={repository.trusted ? 'Trusted' : 'Untrusted'} tone={repository.trusted ? 'success' : 'warning'} />
                      </TableCell>
                      <TableCell>{repository.packageCount.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {repository.url}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </AdminCard>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Alert severity={summary.vulnerable > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            {summary.vulnerable > 0
              ? `${summary.vulnerable} package(s) report known vulnerabilities and should be patched.`
              : 'No known vulnerabilities in current package set.'}
          </Alert>
          <Alert severity={summary.outdated > 0 ? 'info' : 'success'}>
            {summary.outdated > 0
              ? `${summary.outdated} installed package(s) are outdated. Generate script and update safely.`
              : 'All installed packages are up to date.'}
          </Alert>
        </TabPanel>
      </Box>

      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="sm">
        <DialogTitle>Package Details</DialogTitle>
        <DialogContent>
          {packageDetails ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {packageDetails.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {packageDetails.description}
              </Typography>
              <Typography variant="body2">Current: {packageDetails.current}</Typography>
              <Typography variant="body2">Latest: {packageDetails.latest}</Typography>
              <Typography variant="body2">License: {packageDetails.license ?? 'Unknown'}</Typography>
              <Typography variant="body2">Size: {packageDetails.size ?? 'Unknown'}</Typography>
              <Typography variant="body2">Updated: {packageDetails.lastUpdated ?? 'Unknown'}</Typography>
              <Typography variant="body2">Repository: {packageDetails.repository ?? 'N/A'}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDetailsDialogOpen(false)}>Close</AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={scriptDialogOpen} onClose={() => setScriptDialogOpen(false)} fullScreen={isMobile} fullWidth maxWidth="md">
        <DialogTitle>Generated Install Script</DialogTitle>
        <DialogContent>
          <TextField
            aria-label="Generert installasjons-skript"
            multiline
            minRows={10}
            value={generatedScript}
            fullWidth
            InputProps={{ readOnly: true }}
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" startIcon={<ContentCopy />} onClick={copyScript}>
            Copy
          </AdminButton>
          <AdminButton tone="ghost" onClick={() => setScriptDialogOpen(false)}>Close</AdminButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={3500}
        onClose={() => setSnackbarMessage(null)}
      >
        <Alert severity={snackbarMessage?.includes('failed') ? 'error' : 'success'} onClose={() => setSnackbarMessage(null)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PackageMarketplace;
