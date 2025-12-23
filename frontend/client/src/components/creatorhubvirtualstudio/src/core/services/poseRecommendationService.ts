/**
 * Pose Recommendation Service
 * 
 * Provides AI-powered pose suggestions based on photography type and scene analysis
 */

export interface PoseRecommendation {
  name: string;
  description: string;
  category: 'portrait' | 'group' | 'action' | 'casual' | 'formal';
  keyPoints: string[];
  idealAngles: Record<string, number>;
  tips: string[];
  difficulty: 'easy' | 'medium' | 'advanced';
}

export class PoseRecommendationService {
  private poseLibrary: PoseRecommendation[] = [
    {
      name: 'Classic Portrait',
      description: 'Upright posture with slight head tilt',
      category: 'portrait',
      keyPoints: ['nose','left_shoulder','right_shoulder'],
      idealAngles: {
        head_shoulder: 0,
      },
      tips: [
        'Keep shoulders level','Slight head tilt (5-10 degrees)','Weight evenly distributed',
      ],
      difficulty: 'easy',
    },
    {
      name: 'Dynamic Portrait',
      description: 'Forward lean with engaged expression',
      category: 'portrait',
      keyPoints: ['nose','left_shoulder','right_shoulder'],
      idealAngles: {
        head_shoulder: -8,
      },
      tips: [
        'Lean slightly forward','Engage with camera','Keep back straight',
      ],
      difficulty: 'medium',
    },
    {
      name: 'Group - Pyramid',
      description: 'Pyramid formation for group photos',
      category: 'group',
      keyPoints: ['left_hip','right_hip','left_knee','right_knee'],
      idealAngles: {},
      tips: [
        'Tallest in center','Stagger heights','Keep spacing even',
      ],
      difficulty: 'medium',
    },
    {
      name: 'Group - Row',
      description: 'Horizontal row alignment',
      category: 'group',
      keyPoints: ['left_shoulder','right_shoulder'],
      idealAngles: {},
      tips: [
        'Align shoulders horizontally','Equal spacing between subjects','Keep heads at similar height',
      ],
      difficulty: 'easy',
    },
    {
      name: 'Casual Standing',
      description: 'Relaxed standing pose',
      category: 'casual',
      keyPoints: ['left_hip','right_hip'],
      idealAngles: {},
      tips: [
        'Weight on one leg','Relaxed shoulders','Natural hand placement',
      ],
      difficulty: 'easy',
    },
    {
      name: 'Formal Portrait',
      description: 'Professional formal pose',
      category: 'formal',
      keyPoints: ['nose','left_shoulder','right_shoulder','left_hip','right_hip'],
      idealAngles: {
        head_shoulder: 0,
      },
      tips: [
        'Perfect symmetry','Upright posture','Neutral expression',
      ],
      difficulty: 'medium',
    },
  ];

  /**
   * Get pose recommendations based on context
   */
  getRecommendations(context: {
    photographyType?: 'portrait' | 'group' | 'action' | 'casual' | 'formal';
    subjectCount?: number;
    sceneType?: string;
  }): PoseRecommendation[] {
    let recommendations = this.poseLibrary;

    // Filter by photography type
    if (context.photographyType) {
      recommendations = recommendations.filter(
        pose => pose.category === context.photographyType
      );
    }

    // Filter by subject count
    if (context.subjectCount !== undefined) {
      if (context.subjectCount === 1) {
        recommendations = recommendations.filter(
          pose => pose.category === 'portrait' || pose.category === 'casual' || pose.category === 'formal'
        );
      } else if (context.subjectCount > 1) {
        recommendations = recommendations.filter(
          pose => pose.category ==='group'
        );
      }
    }

    // Sort by difficulty (easy first)
    recommendations.sort((a, b) => {
      const difficultyOrder = { easy: 0, medium: 1, advanced: 2 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });

    return recommendations;
  }

  /**
   * Get specific pose by name
   */
  getPoseByName(name: string): PoseRecommendation | undefined {
    return this.poseLibrary.find(pose => pose.name === name);
  }

  /**
   * Get all poses in a category
   */
  getPosesByCategory(category: PoseRecommendation['category']): PoseRecommendation[] {
    return this.poseLibrary.filter(pose => pose.category === category);
  }
}

export const poseRecommendationService = new PoseRecommendationService();


























