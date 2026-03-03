/**
 * Model Version Comparison UI
 *
 * Side-by-side comparison of AI model versions with: * - Performance metrics
 * - A/B testing controls
 * - Traffic split visualization
 * - Winner determination
 */

import React, { useEffect, useState } from 'react';

interface ModelVersion {
  id: string;
  name: string;
  service: string;
  version: string;
  researchEnhanced: boolean;
  active: boolean;
  trafficPercentage: number;
  metrics: {
    accuracy: number;
    followRate: number;
    avgQuality: number;
    totalSamples: number;
    positiveCount: number;
    negativeCount: number;
  };
  createdAt: string;
}

export const ModelVersionComparison: React.FC = () => {
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [selectedService, setSelectedService] = useState('ai_director, ');
  const [selectedVersions, setSelectedVersions] = useState<[string?, string?]>([
    undefined,
    undefined,
  ]);
  const [comparison, setComparison] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [selectedService]);

  const loadVersions = async () => {
    try {
      const response = await fetch(`/api/ai/research/versions/${selectedService}`);
      const data = await response.json();

      if (data.success) {
        setVersions(data.versions);

        // Auto-select first two versions for comparison
        if (data.versions.length >= 2) {
          setSelectedVersions([data.versions[0].id, data.versions[1].id]);
          compareVersions(data.versions[0].id, data.versions[1].id);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load versions: ', error);
      setLoading(false);
    }
  };

  const compareVersions = async (v1: string, v2: string) => {
    try {
      const response = await fetch('/api/ai/research/versions/compare, ', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId1: v1, versionId2: v2 }),
      });

      const data = await response.json();
      if (data.success) {
        setComparison(data.comparison);
      }
    } catch (error) {
      console.error('Failed to compare versions: ', error);
    }
  };

  const handleVersionSelect = (index: 0 | 1, versionId: string) => {
    const newSelection: [string?, string?] = [...selectedVersions] as [string?, string?];
    newSelection[index] = versionId;
    setSelectedVersions(newSelection);

    if (newSelection[0] && newSelection[1]) {
      compareVersions(newSelection[0], newSelection[1]);
    }
  };

  const handleTrafficChange = async (versionId: string, percentage: number) => {
    try {
      await fetch(`/api/ai/research/versions/${versionId}/traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage }),
      });

      loadVersions();
    } catch (error) {
      console.error('Failed to update traffic:', error);
    }
  };

  const renderVersionCard = (versionId: string | undefined, index: number) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return <div style={styles.emptyCard}>Select a version</div>;

    const isWinner = comparison && comparison.comparison.winner === version.id;
    const isTie = comparison && comparison.comparison.winner === 'tie';

    return (
      <div
        style={{
          ...styles.versionCard,
          borderColor: isWinner ? '#00ff00' : isTie ? '#ffaa00' : '#333'}}>
        <div style={styles.versionHeader}>
          <div>
            <div style={styles.versionName}>{version.name}</div>
            <div style={styles.versionMeta}>
              {version.version} • {version.researchEnhanced ? '🔬 Research Enhanced' : '📝 Basic'}
            </div>
          </div>
          {isWinner && <div style={styles.winnerBadge}>🏆 WINNER</div>}
        </div>

        <div style={styles.metricsGrid}>
          <MetricDisplay
            label="Accuracy"
            value={version.metrics.accuracy}
            format="percentage"
            icon="🎯"
          />
          <MetricDisplay
            label="Follow Rate"
            value={version.metrics.followRate}
            format="percentage"
            icon="✓"
          />
          <MetricDisplay
            label="Avg Quality"
            value={version.metrics.avgQuality}
            format="percentage"
            icon="⭐"
          />
          <MetricDisplay
            label="Samples"
            value={version.metrics.totalSamples}
            format="number"
            icon="📊"
          />
        </div>

        <div style={styles.feedbackSection}>
          <div style={styles.feedbackBar}>
            <div
              style={{
                ...styles.feedbackPositive,
                width: `${(version.metrics.positiveCount / version.metrics.totalSamples) * 100}%`,
              }}
            />
          </div>
          <div style={styles.feedbackLabels}>
            <span style={{ color: '#00ff00' }}>👍 {version.metrics.positiveCount}</span>
            <span style={{ color: '#ff6600' }}>👎 {version.metrics.negativeCount}</span>
          </div>
        </div>

        {version.active && (
          <div style={styles.trafficSection}>
            <div style={styles.trafficLabel}>Traffic: {version.trafficPercentage}%</div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={version.trafficPercentage}
              onChange={(e) => handleTrafficChange(version.id, parseInt(e.target.value))}
              style={styles.trafficSlider}
            />
          </div>
        )}

        {!version.active && <div style={styles.inactiveBadge}>Inactive</div>}
      </div>
    );
  };

  if (loading) {
    return <div style={styles.loading}>Loading versions...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔬 Model Version Comparison & A/B Testing</h2>
        <select
          style={styles.serviceSelect}
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
        >
          <option value="ai_director">AI Director</option>
          <option value="ai_vision">AI Vision</option>
          <option value="mini_sora">Mini-Sora</option>
        </select>
      </div>

      <div style={styles.selectors}>
        <div style={styles.selectorGroup}>
          <label style={styles.selectorLabel}>Version 1:</label>
          <select
            style={styles.versionSelect}
            value={selectedVersions[0] || ', '}
            onChange={(e) => handleVersionSelect(0, e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.vsIndicator}>VS</div>

        <div style={styles.selectorGroup}>
          <label style={styles.selectorLabel}>Version 2:</label>
          <select
            style={styles.versionSelect}
            value={selectedVersions[1] || ', '}
            onChange={(e) => handleVersionSelect(1, e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.comparisonGrid}>
        {renderVersionCard(selectedVersions[0], 0)}
        {renderVersionCard(selectedVersions[1], 1)}
      </div>

      {comparison && (
        <div style={styles.comparisonStats}>
          <h3 style={styles.statsTitle}>📊 Comparison Results</h3>
          <div style={styles.statsGrid}>
            <StatDiff label="Accuracy" diff={comparison.comparison.accuracyDiff} />
            <StatDiff label="Follow Rate" diff={comparison.comparison.followRateDiff} />
            <StatDiff label="Quality" diff={comparison.comparison.qualityDiff} />
          </div>
        </div>
      )}
    </div>
  );
};

const MetricDisplay: React.FC<{
  label: string;
  value: number;
  format: 'percentage' | 'number';
  icon: string;
}> = ({ label, value, format, icon }) => (
  <div style={styles.metric}>
    <div style={styles.metricIcon}>{icon}</div>
    <div style={styles.metricLabel}>{label}</div>
    <div style={styles.metricValue}>
      {format === 'percentage' ? `${(value * 100).toFixed(1)}%` : value.toLocaleString()}
    </div>
  </div>
);

const StatDiff: React.FC<{
  label: string;
  diff: number;
}> = ({ label, diff }) => {
  const isPositive = diff > 0;
  const isNeutral = Math.abs(diff) < 0.01;

  return (
    <div style={styles.statDiff}>
      <div style={styles.statDiffLabel}>{label}</div>
      <div
        style={{
          ...styles.statDiffValue,
          color: isNeutral ? '#888': isPositive ? '#00ff00' : '#ff6600'}}>
        {isPositive && '+'}
        {(diff * 100).toFixed(1)}%{!isNeutral && (isPositive ? ' ↑' : ' ↓')}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'monospace',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
  },
  serviceSelect: {
    padding: '8px 16px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  selectors: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  selectorGroup: {
    flex: 1,
  },
  selectorLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  versionSelect: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  vsIndicator: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ff8c00',
    padding: '0 20px',
  },
  comparisonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
    marginBottom: '24px',
  },
  versionCard: {
    padding: '24px',
    backgroundColor: '#1a1a1a',
    border: '2px solid',
    borderRadius: '8px',
    transition: 'all 0.3s',
  },
  emptyCard: {
    padding: '60px',
    textAlign: 'center',
    backgroundColor: '#1a1a1a',
    border: '2px dashed #333',
    borderRadius: '8px',
    color: '#666',
  },
  versionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  versionName: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  versionMeta: {
    fontSize: '12px',
    color: '#888',
  },
  winnerBadge: {
    padding: '6px 12px',
    backgroundColor: '#003300',
    border: '1px solid #00ff00',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#00ff00',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  metric: {
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '6px',
  },
  metricIcon: {
    fontSize: '24px',
    marginBottom: '4px',
  },
  metricLabel: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '4px',
  },
  metricValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ff8c00',
  },
  feedbackSection: {
    marginBottom: '16px',
  },
  feedbackBar: {
    height: '8px',
    backgroundColor: '#330000',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  feedbackPositive: {
    height: '100%',
    backgroundColor: '#00ff00',
    transition: 'width 0.3s',
  },
  feedbackLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  trafficSection: {
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '6px',
  },
  trafficLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
  },
  trafficSlider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    background: '#333',
    cursor: 'pointer',
  },
  inactiveBadge: {
    padding: '8px',
    textAlign: 'center',
    backgroundColor: '#330000',
    border: '1px solid #ff0000',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#ff0000',
    fontWeight: 'bold',
  },
  comparisonStats: {
    padding: '24px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
  },
  statsTitle: {
    fontSize: '18px',
    marginBottom: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  statDiff: {
    padding: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '6px',
    textAlign: 'center',
  },
  statDiffLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '8px',
  },
  statDiffValue: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  loading: {
    padding: '60px',
    textAlign: 'center',
    color:'#888',
  },
};

export default ModelVersionComparison;
