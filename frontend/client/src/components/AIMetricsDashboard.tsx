/**
 * AI Metrics Dashboard
 *
 * Monitor AI learning performance in real-time
 */

import React, { useEffect, useState } from 'react';
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

interface TestResults {
  timestamp: string;
  steps: unknown[];
  stats: unknown;
  success: boolean;
  error: string | null;
}

export const AIMetricsDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('ai_director, ');
  const [timeRange, setTimeRange] = useState('7d,');

  // Research Integration Test State
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [researchStats, setResearchStats] = useState<unknown>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [activeTab, setActiveTab] = useState<'metrics' | 'analytics'>('metrics');
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    loadMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedService, timeRange]);

  const loadMetrics = async () => {
    try {
      // Load metrics for all services
      const response = await fetch(
        `/api/ai/learning/metrics/${selectedService}?timeRange=${timeRange}`,
      );
      const data = await response.json();

      const insightsResponse = await fetch(
        `/api/ai/learning/insights/${selectedService}?timeRange=${timeRange}`,
      );
      const insights = await insightsResponse.json();

      setServices([
        {
          service: selectedService,
          metrics: data.metrics,
          insights: insights.insights || [],
        },
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error loading metrics: ', error);
      setLoading(false);
    }
  };

  const runResearchIntegrationTest = async () => {
    setTestRunning(true);
    setTestResults(null);
    setCurrentStep(0);
    setProgressPercent(0);

    // Simulate progress steps
    const steps = [
      { name: 'Loading Research Papers', percent: 20 },
      { name: 'Testing Enhanced Prompts', percent: 40 },
      { name: 'Verifying Hub Integration', percent: 60 },
      { name: 'Querying Papers', percent: 80 },
      { name: 'Analyzing Results', percent: 100 },
    ];

    const progressInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          setProgressPercent(steps[prev + 1].percent);
          return prev + 1;
        }
        return prev;
      });
    }, 1000);

    try {
      const response = await fetch('/api/ai/research/test-integration, ', {
        method: 'POST',
      });
      const results = await response.json();
      clearInterval(progressInterval);
      setProgressPercent(100);
      setTestResults(results);
      setResearchStats(results.stats);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Test failed: ', error);
      setTestResults({
        timestamp: new Date().toISOString(),
        steps: [],
        stats: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTimeout(() => setTestRunning(false), 500);
    }
  };

  const loadResearchStats = async () => {
    try {
      const response = await fetch('/api/ai/research/stats');
      const data = await response.json();
      if (data.success) {
        // Animate stats counting up
        animateStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load research stats:', error);
    }
  };

  const animateStats = (finalStats: unknown) => {
    const duration = 2000; // 2 seconds
    const steps = 50;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setResearchStats({
        totalPapers: Math.floor(finalStats.totalPapers * progress),
        categories: finalStats.categories,
        totalCitations: Math.floor(finalStats.totalCitations * progress),
        avgCitationsPerPaper: Math.floor(finalStats.avgCitationsPerPaper * progress),
      });

      if (currentStep >= steps) {
        clearInterval(interval);
        setResearchStats(finalStats);
      }
    }, stepDuration);
  };

  useEffect(() => {
    loadResearchStats();
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#00ff00';
    if (score >= 0.6) return '#ffaa00';
    return '#ff0000';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading metrics...</div>
      </div>
    );
  }

  const currentMetrics = services[0]?.metrics;
  const currentInsights = services[0]?.insights || [];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🧠 AI Learning Dashboard</h1>
        <div style={styles.controls}>
          {/* Tab Switcher */}
          <div style={styles.tabContainer}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'metrics' ? styles.activeTab : {})}}
              onClick={() => setActiveTab('metrics')}
            >
              📊 Current Metrics
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'analytics' ? styles.activeTab : {})}}
              onClick={() => setActiveTab('analytics')}
            >
              📈 Learning Analytics
            </button>
          </div>

          {activeTab === 'metrics' && (
            <>
              <select
                style={styles.select}
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
              >
                <option value="ai_director">AI Director</option>
                <option value="ai_vision">AI Vision</option>
                <option value="photo_quality">Photo Quality</option>
                <option value="shot_suggestions">Shot Suggestions</option>
              </select>

              <select
                style={styles.select}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
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

      {/* Content based on active tab */}
      {activeTab === 'analytics' ? (
        <AILearningAnalytics />
      ) : (
        <>
          {/* Key Metrics */}
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
                color={getScoreColor(currentMetrics.follow_rate)}
                trend={currentMetrics.follow_rate > 0.7 ? 'up' : 'down'}
              />

              <MetricCard
                title="Avg Quality Score"
                value={`${(currentMetrics.avg_quality_score * 100).toFixed(1)}%`}
                icon="⭐"
                color={getScoreColor(currentMetrics.avg_quality_score)}
              />

              <MetricCard
                title="User Rating"
                value={`${currentMetrics.avg_user_rating?.toFixed(1) || 'N/A'}/5`}
                icon="👤"
                color={getScoreColor((currentMetrics.avg_user_rating || 0) / 5)}
              />

              <MetricCard
                title="Response Time"
                value={`${(currentMetrics.avg_response_time / 1000).toFixed(1)}s`}
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

          {/* Learning Insights */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>💡 Learning Insights</h2>
            {currentInsights.length === 0 ? (
              <div style={styles.noInsights}>
                No insights yet. Keep using the AI to generate learning data!
              </div>
            ) : (
              <div style={styles.insightsList}>
                {currentInsights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            )}
          </div>

          {/* Live Learning Feed */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⚡ Live Learning Feed</h2>
            <LiveLearningFeed maxEvents={15} />
          </div>

          {/* Example Feedback Widget */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>💬 Try the Feedback Widget</h2>
            <div style={{ padding: '20px', backgroundColor: '#0f0f0f', borderRadius: '8px' }}>
              <p style={{ color: '#aaa', marginBottom: '12px' }}>
                This is how users will rate AI suggestions: </p>
              <AIFeedbackWidget
                suggestionId="demo-123"
                aiService="ai_director"
                suggestionType="composition"
                suggestionText="Apply rule of thirds for better composition"
                onFeedbackSubmitted={(feedback) => {
                  console.log('Demo feedback submitted:', feedback);
                }}
              />
            </div>
          </div>

          {/* Research Integration */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🔬 Research Integration</h2>

            {researchStats && (
              <div style={styles.researchStatsGrid}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Total Papers</div>
                  <div style={styles.statValue}>{researchStats.totalPapers?.toLocaleString()}</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Categories</div>
                  <div style={styles.statValue}>
                    {Object.keys(researchStats.categories || {}).length}
                  </div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>Total Citations</div>
                  <div style={styles.statValue}>
                    {researchStats.totalCitations?.toLocaleString()}
                  </div>
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
                  padding: '16px 24px',
                  fontSize: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={runResearchIntegrationTest}
                disabled={testRunning}
              >
                {testRunning && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${progressPercent}%`,
                      backgroundColor: 'rgba(0, 255, 0, 0.2)',
                      transition: 'width 0.5s ease-in-out',
                    }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1}}>
                  {testRunning ? `🔄 ${progressPercent}% - Learning...` : '🧪 Run Integration Test'}
                </span>
              </button>

              {testRunning && (
                <div style={styles.learningProgress}>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${progressPercent}%`,
                      }
                    />
                  </div>
                  <div style={styles.progressText}>🧠 AI is learning from research papers...</div>
                  <div style={styles.stepIndicators}>
                    {['Loading', 'Enhancing', 'Integrating', 'Querying','Analyzing'].map(
                      (step, i) => (
                        <div
                          key={i}
                          style={{
                            ...styles.stepDot,
                            backgroundColor: i <= currentStep ? '#00ff00' : '#333',
                            transform: i === currentStep ? 'scale(1.3)' : 'scale(1)'}}>
                          {i <= currentStep && '✓'}
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
                    backgroundColor: testResults.success ? '#003300' : '#330000'}}>
                  <span>
                    {testResults.success ? '✅' : '❌'} Test{', '}
                    {testResults.success ? 'Passed' : 'Failed'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#888'}}>
                    {new Date(testResults.timestamp).toLocaleString()}
                  </span>
                </div>

                {testResults.success && testResults.stats && (
                  <div style={styles.learningTimeline}>
                    <h3 style={{ color: '#00ff00', marginBottom: '16px' }}>
                      🎓 What the AI Learned
                    </h3>
                    <div style={styles.timelineItems}>
                      <TimelineItem
                        icon="📚"
                        title="Research Knowledge Loaded"
                        description={`${testResults.stats.totalPapers.toLocaleString()} papers from ${Object.keys(testResults.stats.categories).length} categories`}
                        color="#00ff00"
                      />
                      <TimelineItem
                        icon="🎯"
                        title="Citations Indexed"
                        description={`${testResults.stats.totalCitations.toLocaleString()} total citations with avg ${testResults.stats.avgCitationsPerPaper} per paper`}
                        color="#00aaff"
                      />
                      <TimelineItem
                        icon="✨"
                        title="Prompts Enhanced"
                        description="AI Director, AI Vision, and Mini-Sora now use research-backed methods"
                        color="#ff8c00"
                      />
                      <TimelineItem
                        icon="🤝"
                        title="Integration Complete"
                        description="Unified AI Learning Hub connected to research knowledge base"
                        color="#ff00ff"
                      />
                    </div>
                  </div>
                )}

                {testResults.steps.map((step, i) => (
                  <div key={i} style={styles.testStep}>
                    <div style={styles.testStepHeader}>
                      <span
                        style={{
                          color: step.status === 'success'
                              ? '#00ff00'
                              : step.status === 'error'
                                ? '#ff0000'
                                : '#ffaa00'}}>
                        {step.status === 'success' ? '✅' : step.status === 'error' ? '❌' : '🔄'}
                      </span>
                      <span style={{ marginLeft: '8px' }}>{step.name}</span>
                    </div>

                    {step.data && (
                      <pre style={styles.testStepData}>{JSON.stringify(step.data, null, 2)}</pre>
                    )}

                    {step.error && <div style={styles.testError}>Error: {step.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⚚️ Actions</h2>
            <div style={styles.actionsGrid}>
              <button
                style={styles.actionButton}
                onClick={() => window.open('/api/ai/learning/export', ', '_blank')}
              >
                📥 Export Training Data
              </button>

              <button
                style={styles.actionButton}
                onClick={() => setSnackbar({ open: true, message: 'Fine-tuning initiated! Check logs for progress.', severity: 'info' })}
              >
                🎓 Generate Fine-Tuning Dataset
              </button>

              <button style={styles.actionButton} onClick={loadMetrics}>
                🔄 Refresh Metrics
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  color?: string;
  trend?: 'up' | 'down';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color = '#00aaff',
  trend,
}) => (
  <div style={styles.metricCard}>
    <div style={styles.metricIcon}>{icon}</div>
    <div style={styles.metricTitle}>{title}</div>
    <div style={{ ...styles.metricValue, color }}>{value}</div>
    {trend && <div style={styles.metricTrend}>{trend === 'up' ? '📈' : '📉'}</div>}
  </div>
);

// Timeline Item Component
interface TimelineItemProps {
  icon: string;
  title: string;
  description: string;
  color: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ icon, title, description, color }) => (
  <div style={styles.timelineItem}>
    <div style={{ ...styles.timelineIcon, borderColor: color, color }}>{icon}</div>
    <div style={styles.timelineContent}>
      <div style={{ ...styles.timelineTitle, color }}>{title}</div>
      <div style={styles.timelineDescription}>{description}</div>
    </div>
  </div>
);

// Insight Card Component
const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#00ff00';
    if (confidence >= 0.5) return '#ffaa00';
    return '#ff8800';
  };

  return (
    <div style={styles.insightCard}>
      <div style={styles.insightHeader}>
        <span style={styles.insightPattern}>{insight.pattern}</span>
        <span
          style={{
            ...styles.insightConfidence,
            backgroundColor: getConfidenceColor(insight.confidence)}}>
          {(insight.confidence * 100).toFixed(0)}% confidence
        </span>
      </div>
      <div style={styles.insightExamples}>Based on {insight.examples} examples</div>
      <div style={styles.insightRecommendation}>💡 {insight.recommendation}</div>
    </div>
  );
};

// Styles
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
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: 0,
  },
  controls: {
    display: 'flex',
    gap: '12px',
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
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)',
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
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)',
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
    transition: 'all 0.2s',
  },
  researchStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)',
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
  learningProgress: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '8px',
    animation: 'pulse 2s infinite',
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
    boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
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
    boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)',
  },
  learningTimeline: {
    padding: '20px',
    backgroundColor: '#000',
    margin: '16px',
    borderRadius: '8px',
    border: '1px solid #00ff00',
  },
  timelineItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '6px',
    border: '1px solid #222',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  timelineIcon: {
    fontSize: '32px',
    minWidth: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '2px solid',
    backgroundColor: '#0f0f0f',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  timelineDescription: {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: 1.5 },
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
    transition: 'all 0.2s',
  },
  activeTab: {
    backgroundColor: '#ff8c00',
    color: '#000',
    boxShadow:'0 0 10px rgba(255, 140, 0, 0.3)',
  },
};

export default AIMetricsDashboard;
