/**
 * AI Director Panel
 *
 * Central command panel displaying AI-powered directing suggestions,
 * shot analysis scores, and real-time coaching feedback
 */

import React from 'react';

// ==================== TYPES ====================

export interface DirectorSuggestion {
  type: 'composition' | 'pose' | 'lighting' | 'framing' | 'timing' | 'focus' | 'exposure';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  action: string;
  reasoning: string;
  icon: string;
}

export interface CompositionAnalysis {
  score: number;
  ruleOfThirds: boolean;
  leadingLines: boolean;
  symmetry: boolean;
  negativeSpace: boolean;
  issues: string[];
}

export interface SubjectAnalysis {
  detected: boolean;
  position: { x: number; y: number };
  size: number;
  inFocus: boolean;
  wellLit: boolean;
  pose?: {
    score: number;
    naturalness: number;
    tension: number;
    suggestions: string[];
  };
}

export interface LightingAnalysis {
  score: number;
  exposure: 'underexposed' | 'proper' | 'overexposed';
  contrast: number;
  highlights: { clipped: boolean; percentage: number };
  shadows: { blocked: boolean; percentage: number };
  colorTemp: number;
  suggestions: string[];
}

export interface FramingAnalysis {
  score: number;
  headroom: 'too-much' | 'proper' | 'too-little';
  lookSpace: 'insufficient' | 'proper' | 'excessive';
  balance: number;
  suggestions: string[];
}

export interface TimingInfo {
  captureNow: boolean;
  waitFor?: string;
  countdown?: number;
}

export interface DirectorAnalysis {
  readyToShoot: boolean;
  overallScore: number;
  suggestions: DirectorSuggestion[];
  composition: CompositionAnalysis;
  subject: SubjectAnalysis;
  lighting: LightingAnalysis;
  framing: FramingAnalysis;
  timing: TimingInfo;
  metadata: {
    sceneType: string;
    mood: string;
    dominantColors: string[];
    complexity: number;
  };
  _trackingId?: string; // For learning pipeline
  _timestamp?: Date; // For measuring response time
}

// ==================== AI DIRECTOR PANEL ====================

interface AIDirectorPanelProps {
  analysis: DirectorAnalysis | null;
  isAnalyzing?: boolean;
  showDetailedScores?: boolean;
  onStartCoaching?: () => void;
  onStopCoaching?: () => void;
  isCoachingActive?: boolean;
}

export const AIDirectorPanel: React.FC<AIDirectorPanelProps> = ({
  analysis,
  isAnalyzing = false,
  showDetailedScores = true,
  onStartCoaching,
  onStopCoaching,
  isCoachingActive = false,
}) => {
  // Track user feedback for AI learning
  const recordFeedback = async (action: 'followed' | 'dismissed', suggestionIndex: number) => {
    if (!analysis?._trackingId) return;

    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingId: analysis._trackingId,
          action,
          suggestionIndex,
          timeToAction: analysis._timestamp
            ? Date.now() - new Date(analysis._timestamp).getTime()
            : 0,
        }),
      });
    } catch (error) {
      console.error('Failed to record feedback: ', error);
    }
  };

  const handleSuggestionClick = (suggestionIndex: number) => {
    recordFeedback('followed', suggestionIndex);
    // User can now act on the suggestion
  };

  const handleDismissSuggestion = (suggestionIndex: number) => {
    recordFeedback('dismissed', suggestionIndex);
  };
  if (!analysis && !isAnalyzing) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>🎬 AI DIRECTOR</span>
          <span style={styles.status}>Idle</span>
        </div>
        <div style={styles.emptyState}>
          <p>Waiting for live view...</p>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>🎬 AI DIRECTOR</span>
          <span style={{ ...styles.status, color: '#ffaa00' }}>Analyzing...</span>
        </div>
        <div style={styles.analyzing}>
          <div style={styles.spinner} />
          <p>Analyzing frame...</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number): string => {
    if (score >= 85) return '#00ff00';
    if (score >= 70) return '#ffaa00';
    return '#ff0000';
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical': return '#ff0000';
      case 'high': return '#ff8800';
      case 'medium': return '#ffaa00';
      default: return '#00aaff';
    }
  };

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>🎬 AI DIRECTOR</span>
        <div style={styles.scoreDisplay}>
          <span
            style={{
              ...styles.score,
              color: getScoreColor(analysis.overallScore)}}>
            {analysis.overallScore}/100
          </span>
          {analysis.readyToShoot ? (
            <span style={{ ...styles.readyBadge, backgroundColor: '#00ff00' }}>✓ READY</span>
          ) : (
            <span style={{ ...styles.readyBadge, backgroundColor: '#ff0000' }}>⚠ NOT READY</span>
          )}
        </div>
      </div>

      {/* Timing Info */}
      {analysis.timing.captureNow && (
        <div style={styles.captureNow}>
          <span style={{ fontSize: '24px' }}>📸</span>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>CAPTURE NOW!</span>
          {analysis.timing.countdown !== undefined && (
            <span style={{ fontSize: '20px', marginLeft: '12px' }}>
              {analysis.timing.countdown}
            </span>
          )}
        </div>
      )}

      {analysis.timing.waitFor && !analysis.timing.captureNow && (
        <div style={styles.waitFor}>
          <span>⏳</span>
          <span>{analysis.timing.waitFor}</span>
        </div>
      )}

      {/* Suggestions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Suggestions</div>
        <div style={styles.suggestionsList}>
          {analysis.suggestions.length === 0 ? (
            <div style={styles.noSuggestions}>
              <span>✨</span>
              <span>Perfect shot! No adjustments needed.</span>
            </div>
          ) : (
            analysis.suggestions.map((suggestion, i) => (
              <div
                key={`suggestion-${i}`}
                style={{
                  ...styles.suggestion,
                  borderLeft: `4px solid ${getPriorityColor(suggestion.priority)}`}}
              >
                <div style={styles.suggestionHeader}>
                  <span style={{ fontSize: '18px' }}>{suggestion.icon}</span>
                  <span style={styles.suggestionMessage}>{suggestion.message}</span>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      backgroundColor: getPriorityColor(suggestion.priority)}}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleDismissSuggestion(i)}
                    style={styles.dismissButton}
                    title="Dismiss suggestion"
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.suggestionAction} onClick={() => handleSuggestionClick(i)}>
                  <strong>Action:</strong> {suggestion.action}
                </div>
                <div style={styles.suggestionReasoning}>
                  <em>Why:</em> {suggestion.reasoning}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detailed Scores */}
      {showDetailedScores && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Analysis Breakdown</div>
          <div style={styles.scoresGrid}>
            <ScoreCard
              label="Composition"
              score={analysis.composition.score}
              details={[
                `Rule of Thirds: ${analysis.composition.ruleOfThirds ? '✓' : '✗'}`,
                `Symmetry: ${analysis.composition.symmetry ? '✓' : '✗'}`,
                `Negative Space: ${analysis.composition.negativeSpace ? '✓' : '✗'}`,
              ]}
            />
            <ScoreCard
              label="Lighting"
              score={analysis.lighting.score}
              details={[
                `Exposure: ${analysis.lighting.exposure}`,
                `Contrast: ${analysis.lighting.contrast}`,
                `Highlights: ${analysis.lighting.highlights.percentage}% clipped`,
              ]}
            />
            <ScoreCard
              label="Framing"
              score={analysis.framing.score}
              details={[
                `Headroom: ${analysis.framing.headroom}`,
                `Look Space: ${analysis.framing.lookSpace}`,
                `Balance: ${analysis.framing.balance}/100`,
              ]}
            />
            {analysis.subject.pose && (
              <ScoreCard
                label="Subject Pose"
                score={analysis.subject.pose.score}
                details={[
                  `Naturalness: ${analysis.subject.pose.naturalness}/100`,
                  `Tension: ${analysis.subject.pose.tension}/100`,
                  `In Focus: ${analysis.subject.inFocus ? '✓' : '✗'}`,
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Scene Metadata */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Scene Analysis</div>
        <div style={styles.metadata}>
          <div style={styles.metadataItem}>
            <span style={styles.metadataLabel}>Type:</span>
            <span>{analysis.metadata.sceneType}</span>
          </div>
          <div style={styles.metadataItem}>
            <span style={styles.metadataLabel}>Mood:</span>
            <span>{analysis.metadata.mood}</span>
          </div>
          <div style={styles.metadataItem}>
            <span style={styles.metadataLabel}>Colors:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {analysis.metadata.dominantColors.map((color, i) => (
                <div
                  key={`color-${i}`}
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: color,
                    border: '1px solid #666',
                    borderRadius: '3px'}} />
              ))}
            </div>
          </div>
          <div style={styles.metadataItem}>
            <span style={styles.metadataLabel}>Complexity:</span>
            <div style={styles.complexityBar}>
              <div
                style={{
                  ...styles.complexityFill,
                  width: `${analysis.metadata.complexity}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Coaching Controls */}
      {(onStartCoaching || onStopCoaching) && (
        <div style={styles.coachingControls}>
          {!isCoachingActive ? (
            <button style={styles.coachingButton} onClick={onStartCoaching}>
              🎙️ Start Live Coaching
            </button>
          ) : (
            <button
              style={{ ...styles.coachingButton, backgroundColor: '#ff0000' }}
              onClick={onStopCoaching}
            >
              ⏹ Stop Coaching
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== SCORE CARD COMPONENT ====================

interface ScoreCardProps {
  label: string;
  score: number;
  details: string[];
}

const ScoreCard: React.FC<ScoreCardProps> = ({ label, score, details }) => {
  const getScoreColor = (s: number): string => {
    if (s >= 85) return '#00ff00';
    if (s >= 70) return '#ffaa00';
    return '#ff0000';
  };

  return (
    <div style={styles.scoreCard}>
      <div style={styles.scoreCardHeader}>
        <span style={styles.scoreCardLabel}>{label}</span>
        <span style={{ ...styles.scoreCardScore, color: getScoreColor(score) }}>{score}</span>
      </div>
      <div style={styles.scoreBar}>
        <div
          style={{
            ...styles.scoreBarFill,
            width: `${score}%`,
            backgroundColor: getScoreColor(score),
          }}
        />
      </div>
      <div style={styles.scoreCardDetails}>
        {details.map((detail, i) => (
          <div key={`detail-${i}`} style={styles.detailItem}>
            {detail}
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: '100%',
    maxWidth: '500px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily: 'monospace',
    color: '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  status: {
    fontSize: '12px',
    color: '#888',
  },
  scoreDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  score: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  readyBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#000',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#666',
  },
  analyzing: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#888',
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 16px',
    border: '4px solid #333',
    borderTop: '4px solid #ffaa00',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  captureNow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderBottom: '2px solid #00ff00',
    animation: 'pulse 1s ease-in-out infinite',
  },
  waitFor: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    borderBottom: '1px solid #ffaa00',
    fontSize: '13px',
  },
  section: {
    padding: '16px',
    borderBottom: '1px solid #222',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#aaa',
  },
  suggestionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noSuggestions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
    borderRadius: '6px',
    color: '#00ff00',
  },
  suggestion: {
    padding: '12px',
    backgroundColor: '#151515',
    borderRadius: '6px',
    fontSize: '13px',
  },
  suggestionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  suggestionMessage: {
    flex: 1,
    fontWeight: 'bold',
  },
  priorityBadge: {
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: 'bold',
    color: '#000',
  },
  suggestionAction: {
    padding: '8px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  suggestionReasoning: {
    fontSize: '11px',
    color: '#888',
    fontStyle: 'italic',
  },
  scoresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)',
    gap: '12px',
  },
  scoreCard: {
    padding: '12px',
    backgroundColor: '#151515',
    borderRadius: '6px',
    border: '1px solid #222',
  },
  scoreCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  scoreCardLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#aaa',
  },
  scoreCardScore: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  scoreBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#222',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  scoreBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  scoreCardDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailItem: {
    fontSize: '11px',
    color: '#888',
  },
  metadata: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '12px',
  },
  metadataItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  metadataLabel: {
    fontWeight: 'bold',
    color: '#aaa',
    minWidth: '80px',
  },
  complexityBar: {
    flex: 1,
    height: '16px',
    backgroundColor: '#222',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  complexityFill: {
    height: '100%',
    backgroundColor: '#00aaff',
    transition: 'width 0.3s ease',
  },
  coachingControls: {
    padding: '16px',
  },
  coachingButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#00ff00',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  dismissButton: {
    marginLeft: 'auto',
    padding: '4px 8px',
    backgroundColor: '#ff0000',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily:'monospace',
  },
};
