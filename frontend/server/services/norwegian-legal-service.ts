/**
 * Norwegian Legal Service
 * Service for fetching, searching, and managing Norwegian legal data
 * Supports both internal database and external API integration (Lovdata)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface NorwegianLaw {
  id: string;
  law_name: string;
  law_code?: string;
  chapter?: string;
  paragraph?: string;
  paragraph_number?: number;
  content: string;
  category: 'copyright' | 'music_industry' | 'contracts' | 'royalties' | 'performer_rights' | 'publishing' | 'other';
  keywords?: string[];
  related_laws?: string[];
  external_source?: string;
  external_id?: string;
  last_updated?: string;
}

export interface LegalSuggestion {
  id: string;
  split_sheet_id: string;
  law_id: string;
  suggestion_type: 'compliance_warning' | 'recommendation' | 'requirement' | 'best_practice';
  title: string;
  description: string;
  explanation?: string;
  section_type?: string;
  confidence_score: number;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
}

export class NorwegianLegalService {
  /**
   * Search laws by keyword, category, or full-text search
   */
  static async searchLaws(params: {
    query?: string;
    category?: string;
    law_name?: string;
    limit?: number;
    offset?: number;
  }): Promise<NorwegianLaw[]> {
    const { query, category, law_name, limit = 50, offset = 0 } = params;

    let searchQuery = sql`
      SELECT * FROM norwegian_laws WHERE 1=1
    `;
    const paramsArray: any[] = [];
    const paramIndex = 1;

    if (query) {
      // Full-text search
      searchQuery = sql`
        SELECT *, ts_rank(to_tsvector('norwegian', content), plainto_tsquery('norwegian', ${query})) as rank
        FROM norwegian_laws
        WHERE to_tsvector('norwegian', content) @@ plainto_tsquery('norwegian', ${query})
           OR ${query} = ANY(keywords)
           OR law_name ILIKE ${`%${query}%`}
        ORDER BY rank DESC, paragraph_number ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      if (category) {
        searchQuery = sql`
          ${searchQuery} AND category = ${category}
        `;
      }
      if (law_name) {
        searchQuery = sql`
          ${searchQuery} AND law_name ILIKE ${`%${law_name}%`}
        `;
      }
      searchQuery = sql`
        ${searchQuery}
        ORDER BY law_name ASC, paragraph_number ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const result = await db.execute(searchQuery);
    return result.rows as NorwegianLaw[];
  }

  /**
   * Get law by ID
   */
  static async getLawById(id: string): Promise<NorwegianLaw | null> {
    const result = await db.execute(sql`
      SELECT * FROM norwegian_laws WHERE id = ${id}
    `);
    return result.rows[0] as NorwegianLaw || null;
  }

  /**
   * Generate legal suggestions for a split sheet
   * Analyzes split sheet content and suggests relevant legal paragraphs
   */
  static async generateSuggestions(splitSheetId: string, splitSheetData: {
    contributors?: any[];
    total_percentage?: number;
    status?: string;
  }): Promise<LegalSuggestion[]> {
    const suggestions: LegalSuggestion[] = [];

    // Check if total percentage is 100%
    if (splitSheetData.total_percentage !== undefined && Math.abs(splitSheetData.total_percentage - 100) > 0.01) {
      const law = await this.searchLaws({ query: 'andel inntekter samarbeidsverk', limit: 1 });
      if (law.length > 0) {
        suggestions.push({
          id: '', // Will be generated on insert
          split_sheet_id: splitSheetId,
          law_id: law[0].id,
          suggestion_type: 'compliance_warning',
          title: 'Prosentandeler summerer ikke til 100%',
          description: 'Åndsverkloven krever at inntektsfordeling skal være klar og komplett.',
          explanation: `Din split sheet har totalt ${splitSheetData.total_percentage}% fordelt. For å være i samsvar med norsk lov bør totalen være 100%.`,
          section_type: 'percentages',
          confidence_score: 0.9,
          status: 'pending'
        } as LegalSuggestion);
      }
    }

    // Check if split sheet has multiple contributors (collaboration)
    if (splitSheetData.contributors && splitSheetData.contributors.length > 1) {
      const law = await this.searchLaws({ query: 'samarbeidsverk opphavsmann', limit: 1 });
      if (law.length > 0) {
        suggestions.push({
          id: '',
          split_sheet_id: splitSheetId,
          law_id: law[0].id,
          suggestion_type: 'recommendation',
          title: 'Samarbeidsverk - skriftlig avtale anbefales',
          description: 'For samarbeidsverk med flere opphavsmenn bør avtalen være skriftlig.',
          explanation: 'Åndsverkloven § 60 krever skriftlig avtale for overføring av opphavsrett. Med flere bidragsytere bør avtalen dokumenteres tydelig.',
          section_type: 'contributors',
          confidence_score: 0.85,
          status: 'pending'
        } as LegalSuggestion);
      }
    }

    // Check if signatures are missing
    if (splitSheetData.status === 'draft' || splitSheetData.status === 'pending_signatures') {
      const law = await this.searchLaws({ query: 'avtale skriftlig gyldig', limit: 1 });
      if (law.length > 0) {
        suggestions.push({
          id: '',
          split_sheet_id: splitSheetId,
          law_id: law[0].id,
          suggestion_type: 'requirement',
          title: 'Signaturer kreves for gyldig avtale',
          description: 'For at avtalen skal være juridisk bindende, må alle parter signere.',
          explanation: 'Norsk kontraktsrett krever at alle parter i en avtale bekrefter sin deltakelse gjennom signatur.',
          section_type: 'signatures',
          confidence_score: 0.95,
          status: 'pending'
        } as LegalSuggestion);
      }
    }

    return suggestions;
  }

  /**
   * Sync laws from external API (Lovdata)
   * This is a placeholder - actual implementation would connect to Lovdata API
   */
  static async syncFromExternal(source: 'lovdata' = 'lovdata'): Promise<number> {
    // Placeholder for external API integration
    // In production, this would:
    // 1. Connect to Lovdata API
    // 2. Fetch relevant laws
    // 3. Parse and store in database
    // 4. Update existing laws if changed
    
    console.log(`Syncing laws from ${source}...`);
    // TODO: Implement actual API integration
    
    return 0; // Return number of laws synced
  }

  /**
   * Get legal references for a split sheet
   */
  static async getReferences(splitSheetId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        sslr.*,
        nl.law_name,
        nl.law_code,
        nl.chapter,
        nl.paragraph,
        nl.content,
        nl.category
      FROM split_sheet_legal_references sslr
      INNER JOIN norwegian_laws nl ON sslr.law_id = nl.id
      WHERE sslr.split_sheet_id = ${splitSheetId}
      ORDER BY sslr.created_at DESC
    `);
    return result.rows;
  }

  /**
   * Add legal reference to split sheet
   */
  static async addReference(splitSheetId: string, lawId: string, data: {
    section_type?: string;
    relevance_score?: number;
    notes?: string;
    added_by?: string;
  }): Promise<any> {
    const { v4: uuidv4 } = require('uuid');
    const referenceId = uuidv4();

    await db.execute(sql`
      INSERT INTO split_sheet_legal_references (
        id, split_sheet_id, law_id, section_type, relevance_score, notes, added_by
      )
      VALUES (
        ${referenceId}, ${splitSheetId}, ${lawId}, 
        ${data.section_type || null}, 
        ${data.relevance_score || 1.0}, 
        ${data.notes || null}, 
        ${data.added_by || null}
      )
      RETURNING *
    `);

    return this.getReferences(splitSheetId);
  }
}























