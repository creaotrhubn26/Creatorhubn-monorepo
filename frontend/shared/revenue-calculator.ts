/**
 * Academy Revenue Calculator
 * Handles all revenue split calculations and formatting
 */

export interface RevenueSplit {
  totalPrice: number; // in øre
  platformFee: number; // in øre
  platformFeePercentage: number;
  instructorRevenue: number; // in øre
  instructorRevenuePercentage: number;
  priceNOK: number; // in NOK (for display)
  platformFeeNOK: number; // in NOK (for display)
  instructorRevenueNOK: number; // in NOK (for display)
}

export type InstructorPlan = 'basic' | 'pro' | 'enterprise';

/**
 * Calculate revenue split based on course price and instructor plan
 */
export function calculateRevenueSplit(
  coursePriceOre: number, // in øre (100 = 1 NOK)
  instructorPlan: InstructorPlan,
): RevenueSplit {
  // Platform fee based on instructor's plan
  let platformFeePercentage: number;

  switch (instructorPlan) {
    case 'enterprise':
      platformFeePercentage = 15;
      break;
    case 'pro':
      platformFeePercentage = 20;
      break;
    case 'basic':
    default:
      platformFeePercentage = 0; // Basic plan can't sell courses
      break;
  }

  const instructorRevenuePercentage = 100 - platformFeePercentage;

  // Calculate amounts in øre
  const platformFee = Math.round(coursePriceOre * (platformFeePercentage / 100));
  const instructorRevenue = coursePriceOre - platformFee;

  // Convert to NOK for display
  const priceNOK = coursePriceOre / 100;
  const platformFeeNOK = platformFee / 100;
  const instructorRevenueNOK = instructorRevenue / 100;

  return {
    totalPrice: coursePriceOre,
    platformFee,
    platformFeePercentage,
    instructorRevenue,
    instructorRevenuePercentage,
    priceNOK,
    platformFeeNOK,
    instructorRevenueNOK,
  };
}

/**
 * Calculate total revenue for multiple enrollments
 */
export function calculateTotalRevenue(
  enrollments: Array<{
    amountPaidNok: number;
    platformFeeNok: number;
    instructorRevenueNok: number;
  }>,
): {
  totalRevenue: number;
  totalPlatformFee: number;
  totalInstructorRevenue: number;
  count: number;
} {
  const totalRevenue = enrollments.reduce((sum, e) => sum + e.amountPaidNok, 0);
  const totalPlatformFee = enrollments.reduce((sum, e) => sum + e.platformFeeNok, 0);
  const totalInstructorRevenue = enrollments.reduce((sum, e) => sum + e.instructorRevenueNok, 0);

  return {
    totalRevenue,
    totalPlatformFee,
    totalInstructorRevenue,
    count: enrollments.length,
  };
}

/**
 * Format currency (øre to NOK)
 */
export function formatNOK(ore: number): string {
  const nok = ore / 100;
  return new Intl.NumberFormat('no-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(nok);
}

/**
 * Convert NOK to øre
 */
export function nokToOre(nok: number): number {
  return Math.round(nok * 100);
}

/**
 * Convert øre to NOK
 */
export function oreToNok(ore: number): number {
  return ore / 100;
}

/**
 * Calculate instructor earnings projection
 */
export function calculateEarningsProjection(
  coursePriceOre: number,
  expectedStudents: number,
  instructorPlan: InstructorPlan,
): {
  perStudent: RevenueSplit;
  totalRevenue: number;
  totalPlatformFee: number;
  totalInstructorRevenue: number;
  totalRevenueNOK: number;
  totalPlatformFeeNOK: number;
  totalInstructorRevenueNOK: number;
  studentCount: number;
} {
  const perStudent = calculateRevenueSplit(coursePriceOre, instructorPlan);

  return {
    perStudent,
    totalRevenue: perStudent.totalPrice * expectedStudents,
    totalPlatformFee: perStudent.platformFee * expectedStudents,
    totalInstructorRevenue: perStudent.instructorRevenue * expectedStudents,
    totalRevenueNOK: perStudent.priceNOK * expectedStudents,
    totalPlatformFeeNOK: perStudent.platformFeeNOK * expectedStudents,
    totalInstructorRevenueNOK: perStudent.instructorRevenueNOK * expectedStudents,
    studentCount: expectedStudents,
  };
}

/**
 * Get platform fee percentage based on instructor plan
 */
export function getPlatformFeePercentage(instructorPlan: InstructorPlan): number {
  switch (instructorPlan) {
    case 'enterprise':
      return 15;
    case 'pro':
      return 20;
    case 'basic':
    default:
      return 0; // Basic plan can't sell courses
  }
}

/**
 * Get instructor revenue percentage based on plan
 */
export function getInstructorRevenuePercentage(instructorPlan: InstructorPlan): number {
  return 100 - getPlatformFeePercentage(instructorPlan);
}

/**
 * Check if instructor can monetize courses
 */
export function canMonetizeCourses(instructorPlan: InstructorPlan): boolean {
  return instructorPlan === 'pro' || instructorPlan === 'enterprise';
}

/**
 * Calculate minimum payout threshold
 */
export function getMinimumPayoutThreshold(instructorPlan: InstructorPlan): number {
  // Minimum payout in øre
  switch (instructorPlan) {
    case 'enterprise':
      return 25000; // 250 NOK (lower threshold for Enterprise)
    case 'pro':
      return 50000; // 500 NOK
    case 'basic':
    default:
      return 0; // Can't request payouts
  }
}

/**
 * Validate payout request
 */
export function validatePayoutRequest(
  availableBalance: number, // in øre
  requestedAmount: number, // in øre
  instructorPlan: InstructorPlan,
): {
  isValid: boolean;
  reason?: string;
} {
  const minimumThreshold = getMinimumPayoutThreshold(instructorPlan);

  if (!canMonetizeCourses(instructorPlan)) {
    return {
      isValid: false,
      reason: 'Basic plan users cannot request payouts. Upgrade to Pro or Enterprise.',
    };
  }

  if (requestedAmount < minimumThreshold) {
    return {
      isValid: false,
      reason: `Minimum payout is ${formatNOK(minimumThreshold)}. Current request: ${formatNOK(requestedAmount)}.`,
    };
  }

  if (requestedAmount > availableBalance) {
    return {
      isValid: false,
      reason: `Insufficient balance. Available: ${formatNOK(availableBalance)}, Requested: ${formatNOK(requestedAmount)}.`,
    };
  }

  return {
    isValid: true,
  };
}

/**
 * Calculate refund amounts
 */
export function calculateRefund(
  originalPriceOre: number,
  platformFeeOre: number,
  instructorRevenueOre: number,
): {
  refundToStudent: number;
  platformFeeRefund: number;
  instructorDeduction: number;
} {
  // Full refund to student
  const refundToStudent = originalPriceOre;

  // Platform refunds its fee
  const platformFeeRefund = platformFeeOre;

  // Instructor's revenue is deducted
  const instructorDeduction = instructorRevenueOre;

  return {
    refundToStudent,
    platformFeeRefund,
    instructorDeduction,
  };
}

/**
 * Suggested pricing based on course content
 */
export function suggestCoursePrice(
  videoCount: number,
  totalDurationMinutes: number,
  hasQuizzes: boolean,
  hasCertificate: boolean,
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert',
): {
  suggestedPriceOre: number;
  suggestedPriceNOK: number;
  reasoning: string;
} {
  let basePrice = 0;

  // Base price by difficulty
  switch (difficulty) {
    case 'beginner':
      basePrice = 29900; // 299 NOK
      break;
    case 'intermediate':
      basePrice = 49900; // 499 NOK
      break;
    case 'advanced':
      basePrice = 79900; // 799 NOK
      break;
    case 'expert':
      basePrice = 99900; // 999 NOK
      break;
  }

  // Adjust for content length
  const hoursOfContent = totalDurationMinutes / 60;
  if (hoursOfContent > 10) {
    basePrice += 20000; // +200 NOK for 10+ hours
  } else if (hoursOfContent > 5) {
    basePrice += 10000; // +100 NOK for 5-10 hours
  }

  // Adjust for interactive features
  if (hasQuizzes) {
    basePrice += 5000; // +50 NOK for quizzes
  }
  if (hasCertificate) {
    basePrice += 5000; // +50 NOK for certificate
  }

  // Adjust for video count
  if (videoCount > 50) {
    basePrice += 15000; // +150 NOK for 50+ videos
  } else if (videoCount > 20) {
    basePrice += 7500; // +75 NOK for 20-50 videos
  }

  const reasoning = `Based on ${difficulty} level, ${hoursOfContent.toFixed(1)}h of content, ${videoCount} videos${hasQuizzes ? ', quizzes' : ''}${hasCertificate ? ', certificate' : ''}`;

  return {
    suggestedPriceOre: basePrice,
    suggestedPriceNOK: basePrice / 100,
    reasoning,
  };
}
