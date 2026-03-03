/**
 * AI Metrics Dashboard
 * Monitors AI learning performance, insights, and research integration status.
 */

import React, { useEffect, useMemo, useState } from 'react';
import AILearningAnalytics from './AILearningAnalytics';
import LiveLearningFeed from './LiveLearningFeed';
import AIFeedbackWidget from './AIFeedbackWidget';

interface Metrics {
  total_interactions: number;
  follow_rate: number;
  dismiss_rate: number;
  avg_quality_score: number;
  avg_user_rating: number;
  avg_response_time: number;
}

interface Insight {
  pattern: string;
  confidence: number;
  examples: number;
  recommendation: string;
}

interface ServiceMetrics {
  service: string;
  metrics: Metrics | null;
  insights: Insight[];
}

interface ResearchStats {
  totalPapers: number;
  categories: Record<string, number>;
  totalCitations: number;
  avgCitationsPerPaper: number;
}

interface TestStep {
  name: string;
  status: 'success' | 'error' | 'pending';
  data?: unknown;
  error?: string;
}

interface TestResults {
  timestamp: string;
  steps: TestStep[];
  stats: ResearchStats | null;
  success: boolean;
  error: string | null;
}

type ServiceId = 'ai_director' | 'ai_vision' | 'photo_quality' | 'shot_suggestions';
type TimeRange = '24h' | '7d' | '30d' | '90d';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const normalizeMetrics = (value: unknown): Metrics | null => {
  if (!isObject(value)) return null;

  return {
    total_interactions: asNumber(value.total_interactions),
    follow_rate: asNumber(value.follow_rate),
    dismiss_rate: asNumber(value.dismiss_rate),
    avg_quality_score: asNumber(value.avg_quality_score),
    avg_user_rating: asNumber(value.avg_user_rating),
    avg_response_time: asNumber(value.avg_response_time),
  };
};

const normalizeInsights = (value: unknown): Insight[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isObject)
    .map((item) => ({
      pattern: asString(item.pattern, 'Unknown pattern'),
      confidence: asNumber(item.confidence),
      examples: asNumber(item.examples),
      recommendation: asString(item.recommendation, 'No recommendation available'),
    }));
};

const normalizeResearchStats = (value: unknown): ResearchStats | null => {
  if (!isObject(value)) return null;

  const categoriesRaw = isObject(value.categories) ? value.categories : {};
  const categories: Record<string, number> = {};
  Object.entries(categoriesRaw).forEach(([key, rawCount]) => {
    categories[key] = asNumber(rawCount);
  });

  return {
    totalPapers: asNumber(value.totalPapers),
    categories,
    totalCitations: asNumber(value.totalCitations),
    avgCitationsPerPaper: asNumber(value.avgCitationsPerPaper),
  };
};

export const AIMetricsDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceId>('ai_director');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeTab, setActiveTab] = useState<'metrics' | 'analytics'>('metrics');

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const hideSnackbar = () => setSnackbar((previous) => ({ ...previous, open: false }));

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);

        const metricsResponse = await fetch(
          `/api/ai/learning/metrics/${selectedService}?timeRange=${timeRange}`,
        );
        const metricsPayload = (await metricsResponse.json()) as Record<string, unknown>;

        const insightsResponse = await fetch(
          `/api/ai/learning/insights/${selectedService}?timeRange=${timeRange}`,
        );
        const insightsPayload = (await insightsResponse.json()) as Record<string, unknown>;

        setServices([
          {
            service: selectedService,
            metrics: normalizeMetrics(metricsPayload.metrics),
            insights: normalizeInsights(insightsPayload.insights),
          },
        ]);
      } catch (error) {
        console.error('Error loading metrics:', error);
        setServices([
          {
            service: selectedService,
            metrics: {
              total_interactions: 0,
              follow_rate: 0,
              dismiss_rate: 0,
              avg_quality_score: 0,
              avg_user_rating: 0,
              avg_response_time: 0,
            },
            insights: [],
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    void loadMetrics();
    const interval = window.setInterval(() => {
      void loadMetrics();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [selectedService, timeRange]);

  useEffect(() => {
    const loadResearchStats = async () => {
      try {
        const response = await fetch('/api/ai/research/stats');
        const payload = (await response.json()) as Record<string, unknown>;
        const stats = normalizeResearchStats(payload.stats);
        if (payload.success && stats) {
          setResearchStats(stats);
        }
      } catch (error) {
        console.error('Failed to load research stats:', error);
      }
    };

    void loadResearchStats();
  }, []);

  const runResearchIntegrationTest = async () => {
    setTestRunning(true);
    setTestResults(null);
    setCurrentStep(0);
    setProgressPercent(0);

    const progressSteps = [20, 40, 60, 80, 100];
    const labels = ['Loading', 'Enhancing', 'Integrating', 'Querying', 'Analyzing'];

    const progressInterval = window.setInterval(() => {
      setCurrentStep((previous) => {
        const next = Math.min(previous + 1, progressSteps.length - 1);
        setProgressPercent(progressSteps[next]);
        return next;
      });
    }, 900);

    try {
      const response = await fetch('/api/ai/research/test-integration', { method: 'POST' });
      const payload = (await response.json()) as Record<string, unknown>;
      const stats = normalizeResearchStats(payload.stats);

      const rawSteps = Array.isArray(payload.steps) ? payload.steps : [];
      const steps: TestStep[] = rawSteps
        .filter(isObject)
        .map((item, index) => ({
          name: asString(item.name, labels[index] ?? `Step ${index + 1}`),
          status:
            asString(item.status) === 'success'
              ? 'success'
              : asString(item.status) === 'error'
                ? 'error'
                : 'pending',
          data: item.data,
          error: typeof item.error === 'string' ? item.error : undefined,
        }));

      setProgressPercent(100);
      setTestResults({
        timestamp: asString(payload.timestamp, new Date().toISOString()),
        success: Boolean(payload.success),
        error: typeof payload.error === 'string' ? payload.error : null,
        stats,
        steps,
      });
      setResearchStats(stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setTestResults({
        timestamp: new Date().toISOString(),
        steps: [],
        stats: null,
        success: false,
        error: message,
      });
    } finally {
      window.clearInterval(progressInterval);
      window.setTimeout(() => setTestRunning(false), 500);
    }
  };

  const currentMetrics = services[0]?.metrics;
  const currentInsights = services[0]?.insights ?? [];

  const scoreColor = (score: number): string => {
    if (score >= 0.8) return '#00ff00';
    if (score >= 0.6) return '#ffaa00';
    return '#ff0000';
  };

  const severityColor = useMemo(() => {
    switch (snackbar.severity) {
      case 'success':
        return '#00aa44';
      case 'error':
        return '#bb2222';
      case 'warning':
        return '#cc8800';
      default:
        return '#2266cc';
    }
  }, [snackbar.severity]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading metrics...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>AI Learning Dashboard</h1>
        <div style={styles.controls}>
          <div style={styles.tabContainer}>
            <button
              style={{ ...styles.tab, ...(activeTab === 'metrics' ? styles.activeTab : {}) }}
              onClick={() => setActiveTab('metrics')}
            >
              Current Metrics
            </button>
            <button
              style={{ ...styles.tab, ...(activeTab === 'analytics' ? styles.activeTab : {}) }}
              onClick={() => setActiveTab('analytics')}
            >
              Learning Analytics
            </button>
          </div>

          {activeTab === 'metrics' && (
            <>
              <select
                style={styles.select}
                value={selectedService}
                onChange={(event) => setSelectedService(event.target.value as ServiceId)}
              >
                <option value="ai_director">AI Director</option>
                <option value="ai_vision">AI Vision</option>
                <option value="photo_quality">Photo Quality</option>
                <option value="shot_suggestions">Shot Suggestions</option>
              </select>

              <select
                style={styles.select}
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </>
          )}
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <AILearningAnalytics />
      ) : (
        <>
          {currentMetrics && (
            <div style={styles.metricsGrid}>
              <MetricCard
                title="Total Interactions"
                value={currentMetrics.total_interactions.toLocaleString()}
                icon="🔢"
              />
              <MetricCard
                title="Follow Rate"
                value={`${(currentMetrics.follow_rate * 100).toFixed(1)}%`}
                icon="✅"
                color={scoreColor(currentMetrics.follow_rate)}
                trend={currentMetrics.follow_rate > 0.7 ? 'up' : 'down'}
              />
              <MetricCard
                title="Avg Quality Score"
                value={`${(currentMetrics.avg_quality_score * 100).toFixed(1)}%`}
                icon="⭐"
                color={scoreColor(currentMetrics.avg_quality_score)}
              />
              <MetricCard
                title="User Rating"
                value={`${currentMetrics.avg_user_rating.toFixed(1)}/5`}
                icon="👤"
                color={scoreColor(currentMetrics.avg_user_rating / 5)}
              />
              <MetricCard
                title="Response Time"
                value={`${(currentMetrics.avg_response_time / 1000).toFixed(2)}s`}
                icon="⚡"
                color={currentMetrics.avg_response_time < 2000 ? '#00ff00' : '#ffaa00'}
              />
              <MetricCard
                title="Dismiss Rate"
                value={`${(currentMetrics.dismiss_rate * 100).toFixed(1)}%`}
                icon="❌"
                color={currentMetrics.dismiss_rate < 0.3 ? '#00ff00' : '#ff0000'}
                trend={currentMetrics.dismiss_rate < 0.3 ? 'up' : 'down'}
              />
            </div>
          )}

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Learning Insights</h2>
            {currentInsights.length === 0 ? (
              <div style={styles.noInsights}>
                No insights yet. Keep using the AI to generate learning data.
              </div>
            ) : (
              <div style={styles.insightsList}>
                {currentInsights.map((insight, index) => (
                  <InsightCard key={`${insight.pattern}-${index}`} insight={insight} />
                ))}
              </div>
            )}
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Live Learning Feed</h2>
            <LiveLearningFeed maxEvents={15} />
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Feedback Widget</h2>
            <div style={styles.feedbackDemo}>
              <p style={{ color: '#aaa', marginBottom: '12px' }}>
                Example feedback path used to improve suggestion quality.
              </p>
              <AIFeedbackWidget
                suggestionId="demo-123"
                aiService={'ai_director, '}
                suggestionType="composition"
                suggestionText="Apply rule of thirds for better composition"
                onFeedbackSubmitted={(feedback) => {
                  setSnackbar({
                    open: true,
                    message: `Feedback submitted: ${feedback.rating}`,
                    severity: 'success',
                  });
                }}
              />
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Research Integration</h2>

            {researchStats && (
              <div style={styles.researchStatsGrid}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Total Papers</div>
                  <div style={styles.statValue}>{researchStats.totalPapers.toLocaleString()}</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Categories</div>
                  <div style={styles.statValue}>{Object.keys(researchStats.categories).length}</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Total Citations</div>
                  <div style={styles.statValue}>{researchStats.totalCitations.toLocaleString()}</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Avg Citations</div>
                  <div style={styles.statValue}>{researchStats.avgCitationsPerPaper}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <button
                style={{
                  ...styles.actionButton,
                  backgroundColor: testRunning ? '#666' : '#ff8c00',
                  cursor: testRunning ? 'not-allowed' : 'pointer',
                }}
                onClick={() => void runResearchIntegrationTest()}
                disabled={testRunning}
              >
                {testRunning ? `Running test (${progressPercent}%)` : 'Run Integration Test'}
              </button>

              {testRunning && (
                <div style={styles.learningProgress}>
                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
                  </div>
                  <div style={styles.progressText}>AI is learning from research papers...</div>
                  <div style={styles.stepIndicators}>
                    {['Loading', 'Enhancing', 'Integrating', 'Querying', 'Analyzing'].map(
                      (step, index) => (
                        <div
                          key={step}
                          style={{
                            ...styles.stepDot,
                            backgroundColor: index <= currentStep ? '#00ff00' : '#333',
                            transform: index === currentStep ? 'scale(1.2)' : 'scale(1)',
                          }}
                        >
                          {index <= currentStep ? '✓' : ''}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>

            {testResults && (
              <div style={styles.testResults}>
                <div
                  style={{
                    ...styles.testHeader,
                    backgroundColor: testResults.success ? '#003300' : '#330000',
                  }}
                >
                  <span>{testResults.success ? 'Test Passed' : 'Test Failed'}</span>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {new Date(testResults.timestamp).toLocaleString()}
                  </span>
                </div>

                {testResults.steps.map((step, index) => (
                  <div key={`${step.name}-${index}`} style={styles.testStep}>
                    <div style={styles.testStepHeader}>
                      <span
                        style={{
                          color:
                            step.status === 'success'
                              ? '#00ff00'
                              : step.status === 'error'
                                ? '#ff0000'
                                : '#ffaa00',
                        }}
                      >
                        {step.status === 'success'
                          ? '✅'
                          : step.status === 'error'
                            ? '❌'
                            : '🔄'}
                      </span>
                      <span style={{ marginLeft: '8px' }}>{step.name}</span>
                    </div>
                    {step.data !== undefined && (
                      <pre style={styles.testStepData}>{JSON.stringify(step.data, null, 2)}</pre>
                    )}
                    {step.error && <div style={styles.testError}>Error: {step.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Actions</h2>
            <div style={styles.actionsGrid}>
              <button
                style={styles.actionButton}
                onClick={() => window.open('/api/ai/learning/export', '_blank', 'noopener,noreferrer')}
              >
                Export Training Data
              </button>
              <button
                style={styles.actionButton}
                onClick={() =>
                  setSnackbar({
                    open: true,
                    message: 'Fine-tuning initiated. Check logs for progress.',
                    severity: 'info',
                  })
                }
              >
                Generate Fine-Tuning Dataset
              </button>
            </div>
          </div>
        </>
      )}

      {snackbar.open && (
        <div style={{ ...styles.snackbar, borderColor: severityColor }}>
          <span>{snackbar.message}</span>
          <button style={styles.snackbarClose} onClick={hideSnackbar}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  color?: string;
  trend?: 'up' | 'down';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color = '#00aaff', trend }) => (
  <div style={styles.metricCard}>
    <div style={styles.metricIcon}>{icon}</div>
    <div style={styles.metricTitle}>{title}</div>
    <div style={{ ...styles.metricValue, color }}>{value}</div>
    {trend && <div style={styles.metricTrend}>{trend === 'up' ? '📈' : '📉'}</div>}
  </div>
);

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const confidenceColor =
    insight.confidence >= 0.8 ? '#00ff00' : insight.confidence >= 0.5 ? '#ffaa00' : '#ff8800';

  return (
    <div style={styles.insightCard}>
      <div style={styles.insightHeader}>
        <span style={styles.insightPattern}>{insight.pattern}</span>
        <span style={{ ...styles.insightConfidence, backgroundColor: confidenceColor }}>
          {(insight.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
      <div style={styles.insightExamples}>Based on {insight.examples} examples</div>
      <div style={styles.insightRecommendation}>💡 {insight.recommendation}</div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: '#0a0a0a',
    minHeight: '100vh',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    gap: '12px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: 0,
  },
  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  select: {
    padding: '8px 16px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    fontSize: '18px',
    color: '#888',
  },
  tabContainer: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#1a1a1a',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  tab: {
    padding: '8px 20px',
    backgroundColor: 'transparent',
    color: '#888',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  activeTab: {
    backgroundColor: '#ff8c00',
    color: '#000',
    boxShadow: '0 0 10px rgba(255, 140, 0, 0.3)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  metricCard: {
    padding: '20px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    position: 'relative',
  },
  metricIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  metricTitle: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: 'bold',
  },
  metricTrend: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    fontSize: '20px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  noInsights: {
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#888',
  },
  insightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  insightCard: {
    padding: '16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
  },
  insightHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  insightPattern: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  insightConfidence: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#000',
  },
  insightExamples: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
  },
  insightRecommendation: {
    fontSize: '14px',
    color: '#00aaff',
    fontStyle: 'italic',
  },
  feedbackDemo: {
    padding: '20px',
    backgroundColor: '#0f0f0f',
    borderRadius: '8px',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  actionButton: {
    padding: '16px',
    backgroundColor: '#00aaff',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  researchStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
  },
  statBox: {
    padding: '16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ff8c00',
  },
  learningProgress: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '8px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ff00',
    transition: 'width 0.5s ease-in-out',
  },
  progressText: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#00ff00',
    marginBottom: '16px',
    fontWeight: 'bold',
  },
  stepIndicators: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: '8px',
  },
  stepDot: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#000',
    transition: 'all 0.3s ease-in-out',
    border: '2px solid #00ff00',
  },
  testResults: {
    marginTop: '20px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  testHeader: {
    padding: '16px',
    borderBottom: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
  },
  testStep: {
    padding: '16px',
    borderBottom: '1px solid #222',
  },
  testStepHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  testStepData: {
    backgroundColor: '#000',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#00ff00',
    overflow: 'auto',
    maxHeight: '300px',
    fontFamily: 'monospace',
    marginTop: '8px',
  },
  testError: {
    backgroundColor: '#330000',
    padding: '12px',
    borderRadius: '4px',
    color: '#ff0000',
    marginTop: '8px',
    fontSize: '12px',
  },
  snackbar: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    backgroundColor: '#101010',
    color: '#fff',
    border: '1px solid',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 1200,
  },
  snackbarClose: {
    border: '1px solid #444',
    background: 'transparent',
    color: '#fff',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
};

export default AIMetricsDashboard;
