import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Mail, 
  Share2, 
  Calendar,
  Target,
  Eye,
  MousePointerClick,
  Heart,
  MessageCircle,
  Send,
  Activity,
  Download,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { QUERY_KEYS } from '@/lib/queryKeys';

interface AnalyticsMetric {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

interface SocialAnalytics {
  platform: string;
  posts: number;
  engagement: number;
  reach: number;
  clicks: number;
  shares: number;
  comments: number;
  likes: number;
}

interface EmailAnalytics {
  campaign: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
}

interface WorkflowAnalytics {
  name: string;
  executions: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
}

interface TimeSeriesData {
  date: string;
  social: number;
  email: number;
  workflow: number;
}

export default function UnifiedAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('30d, ');
  const [selectedTab, setSelectedTab] = useState('overview,');

  // Fetch analytics data
  const { data: socialAnalytics, isLoading: socialLoading } = useQuery({
    queryKey: [...QUERY_KEYS.SOCIAL_POSTS'analytics', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/social-media/analytics?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch social analytics');
      return res.json() as Promise<{ platforms: SocialAnalytics[] }>;
    }
  });

  const { data: emailAnalytics, isLoading: emailLoading } = useQuery({
    queryKey: [...QUERY_KEYS.EMAIL_TEMPLATES'analytics', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/email-campaigns/analytics?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch email analytics');
      return res.json() as Promise<{ campaigns: EmailAnalytics[] }>;
    }
  });

  const { data: workflowAnalytics, isLoading: workflowLoading } = useQuery({
    queryKey: [...QUERY_KEYS.WORKFLOWS'analytics', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/marketing-automation/analytics?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch workflow analytics');
      return res.json() as Promise<{ workflows: WorkflowAnalytics[] }>;
    }
  });

  const { data: timeSeriesData } = useQuery({
    queryKey: ['analytics','timeseries', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/timeseries?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch time series data');
      return res.json() as Promise<{ data: TimeSeriesData[] }>;
    }
  });

  // Calculate overview metrics
  const calculateOverviewMetrics = (): AnalyticsMetric[] => {
    const totalSocialEngagement = socialAnalytics?.platforms.reduce((sum, p) => sum + p.engagement, 0) || 0;
    const totalEmailSent = emailAnalytics?.campaigns.reduce((sum, c) => sum + c.sent, 0) || 0;
    const avgOpenRate = emailAnalytics?.campaigns.length 
      ? (emailAnalytics.campaigns.reduce((sum, c) => sum + c.openRate, 0) / emailAnalytics.campaigns.length)
      : 0;
    const totalWorkflowExecutions = workflowAnalytics?.workflows.reduce((sum, w) => sum + w.executions, 0) || 0;
    const totalConversions = workflowAnalytics?.workflows.reduce((sum, w) => sum + w.conversions, 0) || 0;
    const totalRevenue = workflowAnalytics?.workflows.reduce((sum, w) => sum + w.revenue, 0) || 0;

    return [
      {
        label: 'Total Engagement',
        value: totalSocialEngagement,
        change: 15.3,
        trend: 'up',
        icon: <Activity className="h-4 w-4" />
      },
      {
        label: 'Emails Sent',
        value: totalEmailSent,
        change: 8.7,
        trend: 'up',
        icon: <Mail className="h-4 w-4" />
      },
      {
        label: 'Avg Open Rate',
        value: avgOpenRate,
        change: -2.1,
        trend: 'down',
        icon: <Eye className="h-4 w-4" />
      },
      {
        label: 'Workflow Runs',
        value: totalWorkflowExecutions,
        change: 22.5,
        trend: 'up',
        icon: <Target className="h-4 w-4" />
      },
      {
        label: 'Conversions',
        value: totalConversions,
        change: 12.8,
        trend: 'up',
        icon: <TrendingUp className="h-4 w-4" />
      },
      {
        label: 'Revenue',
        value: totalRevenue,
        change: 18.4,
        trend: 'up',
        icon: <BarChart3 className="h-4 w-4" />
      }
    ];
  };

  const overviewMetrics = calculateOverviewMetrics();

  // Chart colors
  const COLORS = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444'];

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const exportData = () => {
    const data = {
      timeRange,
      social: socialAnalytics?.platforms || [],
      email: emailAnalytics?.campaigns || [],
      workflows: workflowAnalytics?.workflows || [],
      timeSeries: timeSeriesData?.data || []
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = socialLoading || emailLoading || workflowLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Marketing Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive overview of all marketing activities and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md: grid-cols-2 lg:grid-cols-3, xl:grid-cols-6">
        {overviewMetrics.map((metric, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              {metric.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.label.includes('Rate') || metric.label.includes('Revenue')
                  ? `${metric.label.includes('Revenue') ? '$' : ', '}${formatNumber(metric.value)}${metric.label.includes('Rate') ? '%' : ', '}`
                  : formatNumber(metric.value)}
              </div>
              <p className={`text-xs ${metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} {Math.abs(metric.change)}% from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="email">Email Campaigns</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Engagement across all marketing channels over time</CardDescription>
            </CardHeader>
            <CardContent>
              {timeSeriesData?.data && (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={timeSeriesData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="social" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Social Media" />
                    <Area type="monotone" dataKey="email" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Email" />
                    <Area type="monotone" dataKey="workflow" stackId="1" stroke="#10b981" fill="#10b981" name="Automation" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
                <CardDescription>Engagement by marketing channel</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Social Media', value: socialAnalytics?.platforms.reduce((s, p) => s + p.engagement, 0) || 0 },
                        { name: 'Email', value: emailAnalytics?.campaigns.reduce((s, c) => s + c.clicked, 0) || 0 },
                        { name: 'Automation', value: workflowAnalytics?.workflows.reduce((s, w) => s + w.conversions, 0) || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Best performing content this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {socialAnalytics?.platforms.slice(0, 3).map((platform, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{platform.platform}</Badge>
                        <span className="text-sm">Social Posts</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatNumber(platform.engagement)}</div>
                        <div className="text-xs text-muted-foreground">engagement</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Performance</CardTitle>
              <CardDescription>Detailed metrics by platform</CardDescription>
            </CardHeader>
            <CardContent>
              {socialAnalytics?.platforms && (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={socialAnalytics.platforms}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="engagement" fill="#3b82f6" name="Engagement" />
                    <Bar dataKey="reach" fill="#8b5cf6" name="Reach" />
                    <Bar dataKey="clicks" fill="#10b981" name="Clicks" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md: grid-cols-2, lg:grid-cols-3">
            {socialAnalytics?.platforms.map((platform, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    {platform.platform}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Posts</span>
                    <span className="font-semibold">{platform.posts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Heart className="h-3 w-3" /> Likes
                    </span>
                    <span className="font-semibold">{formatNumber(platform.likes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> Comments
                    </span>
                    <span className="font-semibold">{formatNumber(platform.comments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Send className="h-3 w-3" /> Shares
                    </span>
                    <span className="font-semibold">{formatNumber(platform.shares)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Total Engagement</span>
                    <span className="font-bold">{formatNumber(platform.engagement)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Email Campaigns Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Campaign Performance</CardTitle>
              <CardDescription>Open and click rates by campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {emailAnalytics?.campaigns && (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={emailAnalytics.campaigns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="campaign" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="openRate" fill="#3b82f6" name="Open Rate %" />
                    <Bar dataKey="clickRate" fill="#10b981" name="Click Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {emailAnalytics?.campaigns.map((campaign, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    {campaign.campaign}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{formatNumber(campaign.sent)}</div>
                      <div className="text-xs text-muted-foreground">Sent</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{campaign.openRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Open Rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{campaign.clickRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Click Rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{formatNumber(campaign.bounced)}</div>
                      <div className="text-xs text-muted-foreground">Bounced</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{formatNumber(campaign.unsubscribed)}</div>
                      <div className="text-xs text-muted-foreground">Unsubscribed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Performance</CardTitle>
              <CardDescription>Conversion rates and revenue by workflow</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowAnalytics?.workflows && (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={workflowAnalytics.workflows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="conversions" fill="#3b82f6" name="Conversions" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {workflowAnalytics?.workflows.map((workflow, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {workflow.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{formatNumber(workflow.executions)}</div>
                      <div className="text-xs text-muted-foreground">Executions</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{formatNumber(workflow.conversions)}</div>
                      <div className="text-xs text-muted-foreground">Conversions</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{workflow.conversionRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Conv. Rate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${formatNumber(workflow.revenue)}</div>
                      <div className="text-xs text-muted-foreground">Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel Comparison</CardTitle>
              <CardDescription>Performance metrics across all marketing channels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={[
                    {
                      name: 'Social Media',
                      engagement: socialAnalytics?.platforms.reduce((s, p) => s + p.engagement, 0) || 0,
                      reach: socialAnalytics?.platforms.reduce((s, p) => s + p.reach, 0) || 0,
                    },
                    {
                      name: 'Email',
                      engagement: emailAnalytics?.campaigns.reduce((s, c) => s + c.clicked, 0) || 0,
                      reach: emailAnalytics?.campaigns.reduce((s, c) => s + c.sent, 0) || 0,
                    },
                    {
                      name: 'Automation',
                      engagement: workflowAnalytics?.workflows.reduce((s, w) => s + w.conversions, 0) || 0,
                      reach: workflowAnalytics?.workflows.reduce((s, w) => s + w.executions, 0) || 0,
                    }
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="reach" fill="#8b5cf6" name="Reach" />
                  <Bar dataKey="engagement" fill="#3b82f6" name="Engagement" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
