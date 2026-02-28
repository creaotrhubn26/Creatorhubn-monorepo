import { ProductionDay, CastingShot } from '../models/casting';
import { castingService } from './castingService';

/**
 * Production Planning Service
 * Handles day-for-day production planning and scene scheduling
 */
export const productionPlanningService = {
  /**
   * Get production days for a project, sorted by date
   */
  async getProductionDays(projectId: string): Promise<ProductionDay[]> {
    const days = await castingService.getProductionDays(projectId);
    const daysArray = Array.isArray(days) ? days : [];
    return daysArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  /**
   * Get production day by date
   */
  async getProductionDayByDate(projectId: string, date: string): Promise<ProductionDay | null> {
    const days = await this.getProductionDays(projectId);
    return days.find(d => d.date === date) || null;
  },

  /**
   * Create a new production day
   */
  createProductionDay(projectId: string, date: string, locationId: string): ProductionDay {
    const productionDay: ProductionDay = {
      id: `production-day-${Date.now()}`,
      projectId,
      date,
      callTime: '09:00',
      wrapTime: '17:00',
      locationId,
      scenes: [],
      crew: [],
      props: [],
      notes: '',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    castingService.saveProductionDay(projectId, productionDay);
    return productionDay;
  },

  /**
   * Assign scene to production day
   */
  async assignSceneToDay(projectId: string, productionDayId: string, sceneId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    if (!productionDay.scenes.includes(sceneId)) {
      productionDay.scenes.push(sceneId);
      await castingService.saveProductionDay(projectId, productionDay);
    }
  },

  /**
   * Remove scene from production day
   */
  async removeSceneFromDay(projectId: string, productionDayId: string, sceneId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    productionDay.scenes = productionDay.scenes.filter(id => id !== sceneId);
    await castingService.saveProductionDay(projectId, productionDay);
  },

  /**
   * Assign crew to production day
   */
  async assignCrewToDay(projectId: string, productionDayId: string, crewId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    if (!productionDay.crew.includes(crewId)) {
      productionDay.crew.push(crewId);
      await castingService.saveProductionDay(projectId, productionDay);
    }
  },

  /**
   * Remove crew from production day
   */
  async removeCrewFromDay(projectId: string, productionDayId: string, crewId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    productionDay.crew = productionDay.crew.filter(id => id !== crewId);
    await castingService.saveProductionDay(projectId, productionDay);
  },

  /**
   * Assign prop to production day
   */
  async assignPropToDay(projectId: string, productionDayId: string, propId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    if (!productionDay.props.includes(propId)) {
      productionDay.props.push(propId);
      await castingService.saveProductionDay(projectId, productionDay);
    }
  },

  /**
   * Remove prop from production day
   */
  async removePropFromDay(projectId: string, productionDayId: string, propId: string): Promise<void> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return;
    
    productionDay.props = productionDay.props.filter(id => id !== propId);
    await castingService.saveProductionDay(projectId, productionDay);
  },

  /**
   * Get scenes for a production day with details
   */
  async getScenesForDay(projectId: string, productionDayId: string): Promise<Array<{ id: string; name: string; thumbnail?: string }>> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return [];
    
    const availableScenes = castingService.getAvailableScenes();
    return productionDay.scenes
      .map(sceneId => availableScenes.find(s => s.id === sceneId))
      .filter((s): s is { id: string; name: string; thumbnail?: string } => s !== undefined);
  },

  /**
   * Get crew for a production day with details
   */
  async getCrewForDay(projectId: string, productionDayId: string): Promise<Array<{ id: string; name: string; role: string }>> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return [];

    const allCrew = await castingService.getCrew(projectId);
    return productionDay.crew
      .map(crewId => allCrew.find(c => c.id === crewId))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map(c => ({ id: c.id, name: c.name, role: c.role }));
  },

  /**
   * Get props for a production day with details
   */
  async getPropsForDay(projectId: string, productionDayId: string): Promise<Array<{ id: string; name: string; category: string }>> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) return [];

    const allProps = await castingService.getProps(projectId);
    return productionDay.props
      .map(propId => allProps.find(p => p.id === propId))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map(p => ({ id: p.id, name: p.name, category: p.category }));
  },

  /**
   * Delete production day
   */
  async deleteProductionDay(projectId: string, productionDayId: string): Promise<void> {
    await castingService.deleteProductionDay(projectId, productionDayId);
  },

  /**
   * Save production day
   */
  async saveProductionDay(projectId: string, productionDay: ProductionDay): Promise<void> {
    await castingService.saveProductionDay(projectId, productionDay);
  },

  /**
   * Validate production day (check conflicts, availability, etc.)
   */
  async validateProductionDay(projectId: string, productionDayId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const days = await castingService.getProductionDays(projectId);
    const productionDay = days.find(pd => pd.id === productionDayId);
    if (!productionDay) {
      return { valid: false, errors: ['Production day not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check location availability
    const locations = await castingService.getLocations(projectId);
    const location = locations.find(l => l.id === productionDay.locationId);
    if (!location) {
      errors.push('Location not found');
    } else {
      // Check if location is available on this date
      if (location.availability.startDate && productionDay.date < location.availability.startDate) {
        warnings.push(`Location may not be available before ${location.availability.startDate}`);
      }
      if (location.availability.endDate && productionDay.date > location.availability.endDate) {
        warnings.push(`Location may not be available after ${location.availability.endDate}`);
      }
    }

    // Check crew availability
    const allCrew = await castingService.getCrew(projectId);
    productionDay.crew.forEach(crewId => {
      const crew = allCrew.find(c => c.id === crewId);
      if (!crew) {
        errors.push(`Crew member ${crewId} not found`);
      } else {
        if (crew.availability?.startDate && productionDay.date < crew.availability.startDate) {
          warnings.push(`${crew.name} may not be available before ${crew.availability.startDate}`);
        }
        if (crew.availability?.endDate && productionDay.date > crew.availability.endDate) {
          warnings.push(`${crew.name} may not be available after ${crew.availability.endDate}`);
        }
      }
    });

    // Check prop availability
    const allProps = await castingService.getProps(projectId);
    productionDay.props.forEach(propId => {
      const prop = allProps.find(p => p.id === propId);
      if (!prop) {
        errors.push(`Prop ${propId} not found`);
      } else {
        if (prop.availability?.startDate && productionDay.date < prop.availability.startDate) {
          warnings.push(`${prop.name} may not be available before ${prop.availability.startDate}`);
        }
        if (prop.availability?.endDate && productionDay.date > prop.availability.endDate) {
          warnings.push(`${prop.name} may not be available after ${prop.availability.endDate}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  calculateAvailableTime(productionDay: ProductionDay): number {
    if (!productionDay.callTime || !productionDay.wrapTime) return 0;
    const [callHours, callMinutes] = productionDay.callTime.split(':').map(Number);
    const [wrapHours, wrapMinutes] = productionDay.wrapTime.split(':').map(Number);
    if ([callHours, callMinutes, wrapHours, wrapMinutes].some((value) => Number.isNaN(value))) {
      return 0;
    }
    const start = callHours * 60 + callMinutes;
    let end = wrapHours * 60 + wrapMinutes;
    if (end < start) {
      end += 24 * 60;
    }
    return Math.max(0, end - start);
  },

  calculateEstimatedTime(shots: CastingShot[]): number {
    return shots.reduce((acc, shot) => {
      if (typeof shot.estimatedTime === 'number') {
        return acc + shot.estimatedTime;
      }
      if (typeof shot.duration === 'number') {
        return acc + Math.max(1, Math.round(shot.duration / 60));
      }
      return acc + 5;
    }, 0);
  },

  calculateActualTime(shots: CastingShot[]): number {
    return shots.reduce((acc, shot) => {
      if (typeof shot.actualDuration === 'number') {
        return acc + shot.actualDuration;
      }
      if (shot.status === 'completed') {
        if (typeof shot.estimatedTime === 'number') {
          return acc + shot.estimatedTime;
        }
        if (typeof shot.duration === 'number') {
          return acc + Math.max(1, Math.round(shot.duration / 60));
        }
        return acc + 5;
      }
      return acc;
    }, 0);
  },

  isTimePressureMode(productionDay: ProductionDay, shots: CastingShot[]): boolean {
    const availableTime = this.calculateAvailableTime(productionDay);
    const estimatedTime = this.calculateEstimatedTime(shots);
    return availableTime > 0 && estimatedTime > availableTime;
  },

  calculateDeadline(productionDay: ProductionDay): Date | null {
    if (!productionDay.date || !productionDay.wrapTime) return null;
    const deadline = new Date(`${productionDay.date}T${productionDay.wrapTime}:00`);
    if (Number.isNaN(deadline.getTime())) {
      return null;
    }
    return deadline;
  },
};
