import React from 'react';

/**
 * AI Vision Feedback Components
 *
 * React components for displaying AI Vision analysis results: * - Product comparison feedback
 * - Portrait comparison feedback
 * - SKU validation results
 * - Brand compliance checks
 * - Style consistency analysis
 * - Live coaching feedback
 */

// Product Comparison Result Component
export interface ProductComparisonFeedbackProps {
  comparison: {
    overallMatch: number;
    angleMatch: {
      score: number;
      virtualAngle: string;
      realAngle: string;
      correction: string;
    };
    lightingMatch: {
      score: number;
      differences: string[];
      corrections: string[];
    };
    backgroundMatch: {
      score: number;
      issues: string[];
      corrections: string[];
    };
    colorMatch: {
      score: number;
      colorTemperature: {
        virtual: number;
        real: number;
      };
      correction: string;
    };
    productPosition: {
      score: number;
      differences: string[];
      correction: string;
    };
    readyForApproval: boolean;
    criticalIssues: string[];
    minorIssues: string[];
  };
}

export function ProductComparisonFeedback({ comparison }: ProductComparisonFeedbackProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 75) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Overall Match Score */}
      <div className={`p-6 rounded-lg ${getScoreBg(comparison.overallMatch)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Match</h3>
            <p className="text-sm text-gray-600">
              {comparison.readyForApproval ? '✅ Ready for approval' : '⚠️ Needs adjustments'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${getScoreColor(comparison.overallMatch)}`}>
            {comparison.overallMatch}%
          </div>
        </div>
      </div>

      {/* Critical Issues */}
      {comparison.criticalIssues.length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <h4 className="font-semibold text-red-800 mb-2">🚨 Critical Issues</h4>
          <ul className="space-y-1">
            {comparison.criticalIssues.map((issue, idx) => (
              <li key={idx} className="text-red-700 text-sm">
                • {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera Angle */}
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Camera Angle</h4>
            <span className={`text-xl font-bold ${getScoreColor(comparison.angleMatch.score)}`}>
              {comparison.angleMatch.score}%
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Virtual:</span> {comparison.angleMatch.virtualAngle}
            </p>
            <p>
              <span className="font-medium">Real:</span> {comparison.angleMatch.realAngle}
            </p>
            <p className="text-blue-600">💡 {comparison.angleMatch.correction}</p>
          </div>
        </div>

        {/* Lighting */}
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Lighting Setup</h4>
            <span className={`text-xl font-bold ${getScoreColor(comparison.lightingMatch.score)}`}>
              {comparison.lightingMatch.score}%
            </span>
          </div>
          {comparison.lightingMatch.corrections.length > 0 && (
            <ul className="space-y-1 text-sm">
              {comparison.lightingMatch.corrections.map((correction, idx) => (
                <li key={idx} className="text-blue-600">
                  💡 {correction}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Background */}
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Background</h4>
            <span
              className={`text-xl font-bold ${getScoreColor(comparison.backgroundMatch.score)}`}
            >
              {comparison.backgroundMatch.score}%
            </span>
          </div>
          {comparison.backgroundMatch.corrections.length > 0 && (
            <ul className="space-y-1 text-sm">
              {comparison.backgroundMatch.corrections.map((correction, idx) => (
                <li key={idx} className="text-blue-600">
                  💡 {correction}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Color & WB */}
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Color & White Balance</h4>
            <span className={`text-xl font-bold ${getScoreColor(comparison.colorMatch.score)}`}>
              {comparison.colorMatch.score}%
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Virtual:</span>{' '}
              {comparison.colorMatch.colorTemperature.virtual}K
            </p>
            <p>
              <span className="font-medium">Real:</span>{' '}
              {comparison.colorMatch.colorTemperature.real}K
            </p>
            <p className="text-blue-600">💡 {comparison.colorMatch.correction}</p>
          </div>
        </div>
      </div>

      {/* Minor Issues */}
      {comparison.minorIssues.length > 0 && (
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Minor Issues (Can fix in post)</h4>
          <ul className="space-y-1">
            {comparison.minorIssues.map((issue, idx) => (
              <li key={idx} className="text-yellow-700 text-sm">
                • {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Portrait Comparison Result Component
export interface PortraitComparisonFeedbackProps {
  comparison: {
    overallMatch: number;
    poseMatch: {
      score: number;
      differences: string[];
      guidance: string[];
    };
    lightingMatch: {
      score: number;
      setup: {
        keyLight: { match: number; note: string };
        fillLight: { match: number; note: string };
        rimLight: { match: number; note: string };
        hairLight: { match: number; note: string };
      };
      corrections: string[];
    };
    expressionMatch: {
      score: number;
      mood: string;
      matches: boolean;
      notes: string[];
    };
    technicalQuality: {
      focus: { score: number; status: string };
      catchlights: { present: boolean; quality: string };
      skinTone: { accuracy: number; note: string };
      dof: { appropriate: boolean; note: string };
    };
    readyForClient: boolean;
    criticalIssues: string[];
    improvements: string[];
  };
}

export function PortraitComparisonFeedback({ comparison }: PortraitComparisonFeedbackProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 75) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Overall Match Score */}
      <div className={`p-6 rounded-lg ${getScoreBg(comparison.overallMatch)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Match</h3>
            <p className="text-sm text-gray-600">
              {comparison.readyForClient ? '✅ Ready for client' : '⚠️ Needs adjustments'}
            </p>
          </div>
          <div className={`text-4xl font-bold ${getScoreColor(comparison.overallMatch)}`}>
            {comparison.overallMatch}%
          </div>
        </div>
      </div>

      {/* Critical Issues */}
      {comparison.criticalIssues.length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <h4 className="font-semibold text-red-800 mb-2">🚨 Critical Issues</h4>
          <ul className="space-y-1">
            {comparison.criticalIssues.map((issue, idx) => (
              <li key={idx} className="text-red-700 text-sm">
                • {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pose & Expression */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Pose</h4>
            <span className={`text-xl font-bold ${getScoreColor(comparison.poseMatch.score)}`}>
              {comparison.poseMatch.score}%
            </span>
          </div>
          {comparison.poseMatch.guidance.length > 0 && (
            <div className="space-y-1 text-sm">
              {comparison.poseMatch.guidance.map((guide, idx) => (
                <p key={idx} className="text-blue-600">
                  💡 "{guide}"
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Expression & Mood</h4>
            <span
              className={`text-xl font-bold ${getScoreColor(comparison.expressionMatch.score)}`}
            >
              {comparison.expressionMatch.score}%
            </span>
          </div>
          <p className="text-sm mb-2">
            <span className="font-medium">Target:</span> {comparison.expressionMatch.mood}
          </p>
          <p className="text-sm">
            {comparison.expressionMatch.matches
              ? '✅ Expression matches'
              : '⚠️ Expression needs adjustment'}
          </p>
        </div>
      </div>

      {/* Lighting Setup */}
      <div className="p-4 bg-white border rounded-lg">
        <h4 className="font-semibold mb-3">Lighting Setup</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600 mb-1">Key Light</p>
            <p
              className={`text-2xl font-bold ${getScoreColor(comparison.lightingMatch.setup.keyLight.match)}`}
            >
              {comparison.lightingMatch.setup.keyLight.match}%
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {comparison.lightingMatch.setup.keyLight.note}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600 mb-1">Fill Light</p>
            <p
              className={`text-2xl font-bold ${getScoreColor(comparison.lightingMatch.setup.fillLight.match)}`}
            >
              {comparison.lightingMatch.setup.fillLight.match}%
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {comparison.lightingMatch.setup.fillLight.note}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600 mb-1">Rim Light</p>
            <p
              className={`text-2xl font-bold ${getScoreColor(comparison.lightingMatch.setup.rimLight.match)}`}
            >
              {comparison.lightingMatch.setup.rimLight.match}%
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {comparison.lightingMatch.setup.rimLight.note}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600 mb-1">Hair Light</p>
            <p
              className={`text-2xl font-bold ${getScoreColor(comparison.lightingMatch.setup.hairLight.match)}`}
            >
              {comparison.lightingMatch.setup.hairLight.match}%
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {comparison.lightingMatch.setup.hairLight.note}
            </p>
          </div>
        </div>
        {comparison.lightingMatch.corrections.length > 0 && (
          <div className="mt-3 space-y-1">
            {comparison.lightingMatch.corrections.map((correction, idx) => (
              <p key={idx} className="text-sm text-blue-600">
                💡 {correction}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Technical Quality */}
      <div className="p-4 bg-white border rounded-lg">
        <h4 className="font-semibold mb-3">Technical Quality</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="font-medium">Focus</p>
            <p className={getScoreColor(comparison.technicalQuality.focus.score)}>
              {comparison.technicalQuality.focus.score}% -{''}
              {comparison.technicalQuality.focus.status}
            </p>
          </div>
          <div>
            <p className="font-medium">Catchlights</p>
            <p
              className={
                comparison.technicalQuality.catchlights.present ? 'text-green-600' : 'text-red-600'
              }
            >
              {comparison.technicalQuality.catchlights.present ? '✅' : '❌'}{','}
              {comparison.technicalQuality.catchlights.quality}
            </p>
          </div>
          <div>
            <p className="font-medium">Skin Tone</p>
            <p className={getScoreColor(comparison.technicalQuality.skinTone.accuracy)}>
              {comparison.technicalQuality.skinTone.accuracy}% -{''}
              {comparison.technicalQuality.skinTone.note}
            </p>
          </div>
          <div>
            <p className="font-medium">Depth of Field</p>
            <p
              className={
                comparison.technicalQuality.dof.appropriate ? 'text-green-600' : 'text-red-600'
              }
            >
              {comparison.technicalQuality.dof.appropriate ? '✅' : '❌'}{','}
              {comparison.technicalQuality.dof.note}
            </p>
          </div>
        </div>
      </div>

      {/* Improvements */}
      {comparison.improvements.length > 0 && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <h4 className="font-semibold text-blue-800 mb-2">💡 Suggested Improvements</h4>
          <ul className="space-y-1">
            {comparison.improvements.map((improvement, idx) => (
              <li key={idx} className="text-blue-700 text-sm">
                • {improvement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Live Coaching Feedback Component
export interface LiveCoachingFeedbackProps {
  coaching: {
    readyToShoot: boolean;
    score: number;
    feedback: {
      expression: { status: string; note: string; suggestion: string | null };
      pose: { status: string; note: string; suggestion: string | null };
      hands: { status: string; note: string; suggestion: string | null };
      composition: { status: string; note: string; suggestion: string | null };
    };
    coachingTips: string[];
    confidence: number;
    nextShot: string;
  };
}

export function LiveCoachingFeedback({ coaching }: LiveCoachingFeedbackProps) {
  const getStatusColor = (status: string) => {
    if (status === 'excellent') return 'text-green-600 bg-green-100';
    if (status === 'good') return 'text-blue-600 bg-blue-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'excellent') return '✅';
    if (status === 'good') return '👍';
    return '⚠️';
  };

  return (
    <div className="space-y-4">
      {/* Ready to Shoot Indicator */}
      <div className={`p-6 rounded-lg ${coaching.readyToShoot ? 'bg-green-100' : 'bg-yellow-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">
              {coaching.readyToShoot ? '📸 Ready to Shoot!' : '⏳ Almost There...'}
            </h3>
            <p className="text-sm text-gray-700 mt-1">{coaching.nextShot}</p>
          </div>
          <div
            className={`text-4xl font-bold ${coaching.readyToShoot ? 'text-green-600' : 'text-yellow-600'}`}
          >
            {coaching.score}%
          </div>
        </div>
      </div>

      {/* Real-time Feedback */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(coaching.feedback).map(([category, feedback]) => (
          <div
            key={category}
            className={`p-3 rounded-lg border ${getStatusColor(feedback.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold capitalize">{category}</h4>
              <span className="text-xl">{getStatusIcon(feedback.status)}</span>
            </div>
            <p className="text-sm mb-1">{feedback.note}</p>
            {feedback.suggestion && (
              <p className="text-sm font-medium mt-2">💡"{feedback.suggestion}"</p>
            )}
          </div>
        ))}
      </div>

      {/* Coaching Tips */}
      {coaching.coachingTips.length > 0 && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <h4 className="font-semibold text-blue-800 mb-2">💬 Coaching Tips</h4>
          <ul className="space-y-1">
            {coaching.coachingTips.map((tip, idx) => (
              <li key={idx} className="text-blue-700 text-sm">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// SKU Validation Result Component
export interface SKUValidationFeedbackProps {
  validation: {
    totalRequired: number;
    captured: number;
    missing: string[];
    misidentified: Array<{
      sku: string;
      verified: boolean;
      confidence: number;
      actualProduct: string;
      issues: string[];
    }>;
    completionRate: number;
    readyForDelivery: boolean;
  };
}

export function SKUValidationFeedback({ validation }: SKUValidationFeedbackProps) {
  return (
    <div className="space-y-4">
      {/* Completion Summary */}
      <div
        className={`p-6 rounded-lg ${validation.readyForDelivery ? 'bg-green-100' : 'bg-yellow-100'}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">SKU Coverage</h3>
            <p className="text-sm text-gray-700">
              {validation.captured} / {validation.totalRequired} SKUs captured
            </p>
          </div>
          <div
            className={`text-4xl font-bold ${validation.readyForDelivery ? 'text-green-600': 'text-yellow-600'}`}
          >
            {Math.round(validation.completionRate)}%
          </div>
        </div>
      </div>

      {/* Missing SKUs */}
      {validation.missing.length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
          <h4 className="font-semibold text-red-800 mb-2">❌ Missing SKUs</h4>
          <div className="flex flex-wrap gap-2">
            {validation.missing.map((sku) => (
              <span
                key={sku}
                className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-medium"
              >
                {sku}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Misidentified SKUs */}
      {validation.misidentified.length > 0 && (
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Verification Issues</h4>
          <ul className="space-y-2">
            {validation.misidentified.map((item, idx) => (
              <li key={idx} className="text-sm">
                <span className="font-medium">{item.sku}:</span> {item.actualProduct}
                {item.issues.length > 0 && (
                  <span className="text-yellow-700"> - {item.issues.join('')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
