/**
 * AI Feedback Widget
 *
 * Collects user feedback on AI suggestions with: * - Thumb up/down buttons
 * - Optional comment field
 * - Visual feedback animation
 * - Auto-saves to learning system
 */

import React, { useState } from 'react';

interface AIFeedbackWidgetProps {
  suggestionId: string;
  aiService: 'ai_director, ' | 'ai_vision' | 'mini_sora' | 'photo_quality' | 'shot_suggestions';
  suggestionType: string;
  suggestionText: string;
  onFeedbackSubmitted?: (feedback: FeedbackData) => void;
  compact?: boolean;
}

interface FeedbackData {
  rating: 'positive' | 'negative';
  comment?: string;
  timestamp: string;
}

export const AIFeedbackWidget: React.FC<AIFeedbackWidgetProps> = ({
  suggestionId,
  aiService,
  suggestionType,
  suggestionText,
  onFeedbackSubmitted,
  compact = false,
}) => {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRating = async (newRating: 'positive' | 'negative') => {
    if (submitted) return;

    setRating(newRating);

    // If negative, show comment box
    if (newRating === 'negative') {
      setShowComment(true);
    } else {
      // Auto-submit positive feedback
      await submitFeedback(newRating, '');
    }
  };

  const submitFeedback = async (
    feedbackRating: 'positive' | 'negative',
    feedbackComment: string,
  ) => {
    setSubmitting(true);

    try {
      const feedback: FeedbackData = {
        rating: feedbackRating,
        comment: feedbackComment || undefined,
        timestamp: new Date().toISOString(),
      };

      // Send to API
      const response = await fetch('/api/ai/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          suggestionId,
          aiService,
          suggestionType,
          suggestionText,
          ...feedback,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setShowComment(false);

        // Call callback
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(feedback);
        }

        // Show thank you message briefly
        setTimeout(() => {
          setSubmitted(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit feedback: ', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = () => {
    if (rating) {
      submitFeedback(rating, comment);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          ...styles.container,
          ...(compact ? styles.compact : {})}}
      >
        <div style={styles.thankYou}>
          <span style={styles.thankYouIcon}>✓</span>
          <span style={styles.thankYouText}>Thanks! AI is learning from your feedback</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.container,
        ...(compact ? styles.compact : {}),
      }}
    >
      <div style={styles.question}>How was this suggestion?</div>

      <div style={styles.buttons}>
        <button
          style={{
            ...styles.button,
            ...styles.thumbUp,
            ...(rating === 'positive' ? styles.buttonActive : {})}}
          onClick={() => handleRating('positive')}
          disabled={submitting}
        >
          <span style={styles.buttonIcon}>👍</span>
          {!compact && <span style={styles.buttonText}>Helpful</span>}
        </button>

        <button
          style={{
            ...styles.button,
            ...styles.thumbDown,
            ...(rating === 'negative' ? styles.buttonActive : {})}}
          onClick={() => handleRating('negative')}
          disabled={submitting}
        >
          <span style={styles.buttonIcon}>👎</span>
          {!compact && <span style={styles.buttonText}>Not helpful</span>}
        </button>
      </div>

      {showComment && (
        <div style={styles.commentBox}>
          <textarea
            style={styles.textarea}
            placeholder="What could be improved? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div style={styles.commentActions}>
            <button
              style={styles.skipButton}
              onClick={() => submitFeedback(rating!, '')}
              disabled={submitting}
            >
              Skip
            </button>
            <button style={styles.submitButton} onClick={handleCommentSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  compact: {
    padding: '8px',
    marginTop: '8px',
  },
  question: {
    fontSize: '13px',
    color: '#aaa',
    marginBottom: '12px',
    fontWeight: 50,
  },
  buttons: {
    display: 'flex',
    gap: '12px',
  },
  button: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#0a0a0a',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  thumbUp: {
    ':hover': {
      borderColor: '#00ff00',
      backgroundColor: '#001100',
    },
  },
  thumbDown: {
    ':hover': {
      borderColor: '#ff0000',
      backgroundColor: '#110000',
    },
  },
  buttonActive: {
    borderColor: '#ff8c00',
    backgroundColor: '#221100',
    transform: 'scale(0.98)',
  },
  buttonIcon: {
    fontSize: '20px',
  },
  buttonText: {
    fontSize: '14px',
  },
  commentBox: {
    marginTop: '16px',
    animation: 'slideDown 0.3s ease',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    resize: 'vertical',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  commentActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '12px',
  },
  skipButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#888',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  submitButton: {
    padding: '8px 20px',
    backgroundColor: '#ff8c00',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  thankYou: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#001100',
    border: '1px solid #00ff00',
    borderRadius: '6px',
    animation: 'fadeIn 0.3s ease',
  },
  thankYouIcon: {
    fontSize: '20px',
    color: '#00ff00',
  },
  thankYouText: {
    fontSize: '13px',
    color:'#00ff00',
    fontWeight: 50,
  },
};

export default AIFeedbackWidget;
