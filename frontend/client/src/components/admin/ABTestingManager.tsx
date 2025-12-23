import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Play, 
  Pause, 
  Stop, 
  TrendingUp, 
  Users, 
  Mail,
  Share2,
  BarChart3,
  Eye,
  MousePointer,
  Target,
  Crown,
  AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';

type TestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
type TestType = 'email' | 'social';

interface ABTest {
  id: string;
  name: string;
  type: TestType;
  status: TestStatus;
  variants: TestVariant[];
  config: TestConfig;
  results?: TestResults;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface TestVariant {
  id: string;
  name: string;
  description: string;
  audienceSplit: number; // percentage
  content: any;
  metrics: VariantMetrics;
}

interface VariantMetrics {
  views: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  engagementRate: number;
  revenue?: number;
}

interface TestConfig {
  duration: number; // days
  minSampleSize: number;
  significanceLevel: number; // 0.95 = 95%
  primaryMetric: 'clicks' | 'conversions' | 'engagement' | 'revenue';
  audienceSegment?: string;
}

interface TestResults {
  winner?: string;
  confidence: number;
  improvement: number;
  recommendation: string;
  statisticalSignificance: boolean;
}

export default function ABTestingManager() {
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'draft'>('active');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch AB tests
  const { data: tests = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.AB_TESTS, selectedTab],
    queryFn: async () => {
      const res = await fetch(`/api/ab-tests?status=${selectedTab}`);
      if (!res.ok) throw new Error('Failed to fetch AB tests ');
      return res.json() as Promise<ABTest[]>;
    }
  });

  // Start test mutation
  const startTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/start`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to start test');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      toast({
        title: 'Test started',
        description: 'Your A/B test is now running.'
      });
    }
  });

  // Pause test mutation
  const pauseTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/pause`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to pause test');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
    }
  });

  // Stop test mutation
  const stopTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const res = await fetch(`/api/ab-tests/${testId}/stop`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to stop test');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AB_TESTS });
      toast({
        title: 'Test completed',
        description: 'Results are now available.'
      });
    }
  });

  const getStatusBadge = (status: TestStatus) => {
    const variants = {
      draft: { variant: 'secondary' as const, text: 'Draft' },
      running: { variant: 'default' as const, text: 'Running' },
      paused: { variant: 'outline' as const, text: 'Paused' },
      completed: { variant: 'default' as const, text: 'Completed' },
      cancelled: { variant: 'destructive' as const, text: 'Cancelled' }
    };

    const config = variants[status];
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getTypeIcon = (type: TestType) => {
    return type === 'email' ? <Mail className="h-4 w-4" /> : <Share2 className="h-4 w-4" />;
  };

  const calculateProgress = (test: ABTest): number => {
    if (!test.startedAt || test.status !== 'running') return 0;
    
    const startTime = new Date(test.startedAt).getTime();
    const endTime = startTime + (test.config.duration * 24 * 60 * 60 * 1000);
    const now = Date.now();
    
    if (now >= endTime) return 100;
    
    const elapsed = now - startTime;
    const total = endTime - startTime;
    return Math.min(100, (elapsed / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">A/B Testing</h2>
          <p className="text-muted-foreground">
            Test and optimize your email campaigns and social media posts
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>
                Set up a new A/B test for your campaign
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Test Name</Label>
                <Input placeholder="e.g. Email Subject Line Test" />
              </div>
              <div>
                <Label>Test Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Campaign</SelectItem>
                    <SelectItem value="social">Social Media Post</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primary Metric</Label>
                <Select defaultValue="conversions">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clicks">Click Rate</SelectItem>
                    <SelectItem value="conversions">Conversions</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration (days)</Label>
                  <Input type="number" defaultValue="7" min="1" />
                </div>
                <div>
                  <Label>Min Sample Size</Label>
                  <Input type="number" defaultValue="1000" min="100" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1">Create Test</Button>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests.filter(t => t.status === 'running').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests.filter(t => t.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests.filter(t => t.results?.improvement).length > 0
                ? `${(tests.reduce((sum, t) => sum + (t.results?.improvement || 0), 0) / tests.filter(t => t.results?.improvement).length).toFixed(1)}%`
                : '0%'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Audience</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tests.reduce((sum, t) => sum + t.variants.reduce((vSum, v) => vSum + v.metrics.views, 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tests List */}
      <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                Loading tests...
              </CardContent>
            </Card>
          ) : tests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tests found</p>
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Test
                </Button>
              </CardContent>
            </Card>
          ) : (
            tests.map(test => (
              <Card key={test.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(test.type)}
                        <CardTitle className="text-xl">{test.name}</CardTitle>
                        {getStatusBadge(test.status)}
                      </div>
                      <CardDescription>
                        Testing {test.variants.length} variants • Primary metric: {test.config.primaryMetric}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {test.status === 'draft' && (
                        <Button size="sm" onClick={() => startTestMutation.mutate(test.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                      {test.status === 'running' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => pauseTestMutation.mutate(test.id)}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => stopTestMutation.mutate(test.id)}
                          >
                            <Stop className="h-4 w-4 mr-2" />
                            Stop
                          </Button>
                        </>
                      )}
                      {test.status === 'paused' && (
                        <Button size="sm" onClick={() => startTestMutation.mutate(test.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  {test.status === 'running' && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{calculateProgress(test).toFixed(0)}%</span>
                      </div>
                      <Progress value={calculateProgress(test)} />
                    </div>
                  )}

                  {/* Variants */}
                  <div className="grid md: grid-cols-2, lg:grid-cols-3 gap-4">
                    {test.variants.map(variant => (
                      <Card key={variant.id} className={test.results?.winner === variant.id ? 'border-green-500' : ','}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{variant.name}</CardTitle>
                            {test.results?.winner === variant.id && (
                              <Crown className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                          <CardDescription className="text-xs">{variant.audienceSplit}% of audience</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Views
                            </span>
                            <span className="font-medium">{variant.metrics.views.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <MousePointer className="h-3 w-3" /> Clicks
                            </span>
                            <span className="font-medium">{variant.metrics.clicks.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Target className="h-3 w-3" /> Conversions
                            </span>
                            <span className="font-medium">{variant.metrics.conversions.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs pt-2 border-t">
                            <span className="text-muted-foreground">Conv. Rate</span>
                            <span className="font-bold">{variant.metrics.conversionRate.toFixed(2)}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Results */}
                  {test.results && test.status === 'completed' && (
                    <Card className="bg-muted/50">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Test Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Winner</span>
                          <Badge variant="default">
                            {test.variants.find(v => v.id === test.results?.winner)?.name ||'N/A'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Improvement</span>
                          <span className="font-semibold text-green-600">
                            +{test.results.improvement.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Confidence</span>
                          <span className="font-semibold">
                            {(test.results.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        {!test.results.statisticalSignificance && (
                          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800">
                              Results are not statistically significant. Consider running the test longer.
                            </p>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground pt-2 border-t">
                          {test.results.recommendation}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
