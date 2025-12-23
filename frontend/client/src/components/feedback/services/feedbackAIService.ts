/**
 * FeedbackAIService - Smart Form Suggestions
 * 
 * Features:
 * - AI-powered title suggestions based on description
 * - Auto-tag based on keywords
 * - Similar existing issues detection
 * - Template suggestions based on feedback type
 */

// ============================================================================
// Types
// ============================================================================

export interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

export interface TitleSuggestion {
  title: string;
  confidence: number;
}

export interface SimilarIssue {
  id: string;
  title: string;
  description: string;
  status: string;
  similarity: number;
}

export interface FeedbackTemplate {
  id: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
}

// ============================================================================
// Keyword Mappings
// ============================================================================

const TAG_KEYWORDS: Record<string, string[]> = {
  'UI/UX': ['button','layout','design','color','font','style','interface','look','ugly','beautiful','confusing'],
  'Performance': ['slow','fast','lag','loading','freeze','crash','memory','cpu','fps','performance'],
  'Navigation': ['navigate','menu','sidebar','breadcrumb','back','forward','route','link','path'],
  'Mobile': ['mobile','phone','touch','swipe','responsive','tablet','ipad','android','ios'],
  'Desktop': ['desktop','window','mouse','keyboard','screen','monitor','laptop'],
  'Google Drive': ['google','drive','upload','download','sync','cloud','storage','file'],
  'Tutorial': ['tutorial','guide','help','learn','instruction','onboarding','walkthrough'],
  'Dashboard': ['dashboard','overview','stats','metrics','chart','graph','analytics'],
  'Project Management': ['project','task','workflow','deadline','assignment','schedule'],
  'Camera Detection': ['camera','detect','recognize','lens','exif','metadata'],
  'Equipment': ['equipment','gear','lens','flash','tripod','light','modifier'],
  'Client Management': ['client','customer','gallery','share','delivery','contract'],
  'Settings': ['setting','preference','option','config','customize','theme'],
  'Virtual Studio': ['virtual','studio','3d','scene','render','preview'],
  '3D Rendering': ['3d','render','model','mesh','texture','material','shader'],
  'Lighting': ['light','shadow','exposure','brightness','contrast','hdri'],
  'Animation': ['animation','keyframe','timeline','motion','animate','sequence'],
  'Export': ['export','download','save','format','quality','resolution','video','image'],
};

const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  // Bug templates
  {
    id: 'bug-crash',
    type: 'bug',
    title: 'Application crashes when [action]',
    description: '**Steps to reproduce:**\n1. \n2. \n3. \n\n**Expected behavior:**\n\n**Actual, behavior:**\nThe application crashes.\n\n**Error message (if any):**\n',
    tags: ['Performance'],
  },
  {
    id: 'bug-visual',
    type: 'bug',
    title: 'Visual glitch in [component]',
    description: '**Where does this happen?**\n\n**What should it look like?**\n\n**What does it actually look like?**\n\n**Browser/Device:**\n',
    tags: ['UI/UX'],
  },
  {
    id: 'bug-functionality',
    type: 'bug',
    title: '[Feature] is not working correctly',
    description: '**What I tried to do:**\n\n**What happened instead:**\n\n**Steps to, reproduce:**\n1. \n2. \n3. \n',
    tags: [],
  },
  // Feature templates
  {
    id: 'feature-new',
    type: 'feature',
    title: 'Add [feature] to improve [workflow]',
    description: '**Problem this solves:**\n\n**Proposed solution:**\n\n**Alternatives, considered:**\n\n**How important is this to you?**\n',
    tags: [],
  },
  {
    id: 'feature-improvement',
    type: 'feature',
    title: 'Improve [existing feature]',
    description: '**Current behavior:**\n\n**Desired behavior:**\n\n**Why this would, help:**\n',
    tags: [],
  },
  // Usability templates
  {
    id: 'usability-confusing',
    type: 'usability',
    title: '[Component] is confusing to use',
    description: '**What I was trying to do:**\n\n**What confused me:**\n\n**What would make it, clearer:**\n',
    tags: ['UI/UX'],
  },
  {
    id: 'usability-hard-to-find',
    type: 'usability',
    title: 'Hard to find [feature]',
    description: '**What I was looking for:**\n\n**Where I looked:**\n\n**Where I eventually found it:**\n\n**Suggestion for, improvement:**\n',
    tags: ['Navigation','UI/UX'],
  },
  // General templates
  {
    id: 'general-praise',
    type: 'general',
    title: 'I love [feature]!',
    description: '**What I like about it:**\n\n**How it helps my, workflow:**\n',
    tags: [],
  },
  {
    id: 'general-suggestion',
    type: 'general',
    title: 'Suggestion for [area]',
    description: '**Current experience:**\n\n**My suggestion:**\n\n**Expected, benefit:**\n',
    tags: [],
  },
];

// ============================================================================
// AI Service
// ============================================================================

class FeedbackAIService {
  /**
   * Suggest tags based on text content
   */
  suggestTags(text: string): TagSuggestion[] {
    const lowerText = text.toLowerCase();
    const suggestions: TagSuggestion[] = [];

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
      const matchedKeywords = keywords.filter(kw => lowerText.includes(kw));
      
      if (matchedKeywords.length > 0) {
        const confidence = Math.min(matchedKeywords.length / 3, 1); // Max 1.0
        suggestions.push({
          tag,
          confidence,
          reason: `Matched: ${matchedKeywords.slice(0, 3).join('')}`,
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate title suggestions from description
   */
  suggestTitles(description: string, feedbackType: string): TitleSuggestion[] {
    const suggestions: TitleSuggestion[] = [];
    const words = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Extract key phrases
    const keyPhrases: string[] = [];
    
    // Look for action words
    const actionWords = ['click','open','close','save','load','create','delete','edit','update','view','export','import'];
    const foundActions = actionWords.filter(a => words.includes(a));
    
    // Look for component words
    const componentWords = ['button','menu','dialog','panel','page','form','input','dropdown','slider','tab'];
    const foundComponents = componentWords.filter(c => words.includes(c));

    // Generate suggestions based on type
    if (feedbackType === 'bug') {
      if (foundActions.length > 0 && foundComponents.length > 0) {
        suggestions.push({
          title: `Bug: ${foundComponents[0]} ${foundActions[0]} issue`,
          confidence: 0.8,
        });
      }
      if (description.includes('crash,') || description.includes('error,')) {
        suggestions.push({
          title: 'Application error/crash report',
          confidence: 0.9,
        });
      }
      if (description.includes('not working') || description.includes("doesn't work")) {
        suggestions.push({
          title: 'Feature not working as expected',
          confidence: 0.7,
        });
      }
    } else if (feedbackType === 'feature') {
      if (description.includes('would be nice') || description.includes('should have')) {
        suggestions.push({
          title: 'Feature, request: New functionality',
          confidence: 0.7,
        });
      }
      if (description.includes('add') || description.includes('implement')) {
        const nextWord = this.getWordAfter(description, 'add') || this.getWordAfter(description, 'implement');
        if (nextWord) {
          suggestions.push({
            title: `Add ${nextWord} feature`,
            confidence: 0.8,
          });
        }
      }
    } else if (feedbackType === 'usability') {
      if (description.includes('confus') || description.includes('unclear')) {
        suggestions.push({
          title: 'Confusing user interface',
          confidence: 0.8,
        });
      }
      if (description.includes("can't find") || description.includes('hard to find')) {
        suggestions.push({
          title: 'Discoverability issue',
          confidence: 0.8,
        });
      }
    }

    // Generate from first sentence
    const firstSentence = description.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 10 && firstSentence.length < 80) {
      suggestions.push({
        title: this.capitalize(firstSentence),
        confidence: 0.5,
      });
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Find similar existing issues (mock - would connect to backend)
   */
  async findSimilarIssues(description: string, existingFeedback: any[]): Promise<SimilarIssue[]> {
    const descWords = new Set(description.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const withSimilarity = existingFeedback.map(feedback => {
      const feedbackWords = new Set(
        (feedback.title + ', ' + feedback.description).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
      );
      
      // Calculate Jaccard similarity
      const intersection = new Set([...descWords].filter(x => feedbackWords.has(x)));
      const union = new Set([...descWords, ...feedbackWords]);
      const similarity = intersection.size / union.size;

      return {
        id: feedback.id,
        title: feedback.title,
        description: feedback.description?.slice(0, 100) + '...',
        status: feedback.status,
        similarity,
      };
    });

    return withSimilarity
      .filter(f => f.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  /**
   * Get templates for feedback type
   */
  getTemplates(feedbackType: string): FeedbackTemplate[] {
    return FEEDBACK_TEMPLATES.filter(t => t.type === feedbackType);
  }

  /**
   * Auto-complete description based on template
   */
  applyTemplate(template: FeedbackTemplate): { title: string; description: string; tags: string[] } {
    return {
      title: template.title,
      description: template.description,
      tags: template.tags,
    };
  }

  /**
   * Analyze sentiment of feedback
   */
  analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['love','great','awesome','excellent','amazing','good','nice','helpful','perfect','fantastic'];
    const negativeWords = ['hate','terrible','awful','bad','broken','frustrating','annoying','confusing','slow', 'crash'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Suggest priority based on content
   */
  suggestPriority(text: string, feedbackType: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerText = text.toLowerCase();

    // Critical indicators
    if (feedbackType === 'bug') {
      if (lowerText.includes('crash') || lowerText.includes('data loss') || lowerText.includes('security')) {
        return 'critical';
      }
      if (lowerText.includes('broken') || lowerText.includes('not working') || lowerText.includes('error')) {
        return 'high';
      }
    }

    // High priority indicators
    if (lowerText.includes('urgent') || lowerText.includes('blocker') || lowerText.includes('cannot')) {
      return 'high';
    }

    // Low priority indicators
    if (feedbackType === 'general' || feedbackType === 'feature') {
      if (lowerText.includes('minor') || lowerText.includes('small') || lowerText.includes('nice to have')) {
        return 'low';
      }
    }

    return'medium';
  }

  // Helper methods
  private getWordAfter(text: string, word: string): string | null {
      const regex = new RegExp(`${word}\\s+(\\w+)`, 'i');
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

export const feedbackAIService = new FeedbackAIService();
export default feedbackAIService;

