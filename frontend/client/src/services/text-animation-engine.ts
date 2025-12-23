/**
 * TEXT ANIMATION ENGINE
 * Using GSAP for professional text animations
 * Like After Effects text presets
 */

import { gsap } from 'gsap';

export type TextAnimationType = 
  | 'fade_in'
  | 'fade_out'
  | 'slide_up'
  | 'slide_down'
  | 'slide_left'
  | 'slide_right'
  | 'zoom_in'
  | 'zoom_out'
  | 'rotate_in'
  | 'bounce_in'
  | 'elastic_in'
  | 'glitch_in'
  | 'typewriter'
  | 'character_by_character';

export interface TextAnimation {
  type: TextAnimationType;
  duration: number;
  delay: number;
  easing: string;
}

/**
 * GSAP Text Animation Engine
 */
export class TextAnimationEngine {
  /**
   * Animate element with GSAP
   */
  static animate(
    element: HTMLElement | string,
    animation: TextAnimation
  ): gsap.core.Tween {
    const config = this.getAnimationConfig(animation);
    
    return gsap.to(element, {
      ...config,
      duration: animation.duration,
      delay: animation.delay,
      ease: animation.easing
    });
  }
  
  /**
   * Get GSAP config for animation type
   */
  private static getAnimationConfig(animation: TextAnimation): gsap.TweenVars {
    switch (animation.type) {
      case 'fade_in':
        return {
          opacity: 1,
          from: { opacity: 0 }
        };
        
      case 'fade_out':
        return {
          opacity: 0,
          from: { opacity: 1 }
        };
        
      case 'slide_up':
        return {
          y: 0,
          opacity: 1,
          from: { y: 50, opacity: 0 }
        };
        
      case 'slide_down':
        return {
          y: 0,
          opacity: 1,
          from: { y: -50, opacity: 0 }
        };
        
      case 'slide_left':
        return {
          x: 0,
          opacity: 1,
          from: { x: 100, opacity: 0 }
        };
        
      case 'slide_right':
        return {
          x: 0,
          opacity: 1,
          from: { x: -100, opacity: 0 }
        };
        
      case 'zoom_in':
        return {
          scale: 1,
          opacity: 1,
          from: { scale: 0, opacity: 0 }
        };
        
      case 'zoom_out':
        return {
          scale: 1,
          opacity: 1,
          from: { scale: 2, opacity: 0 }
        };
        
      case 'rotate_in':
        return {
          rotation: 0,
          opacity: 1,
          from: { rotation: -90, opacity: 0 }
        };
        
      case 'bounce_in':
        return {
          y: 0,
          opacity: 1,
          from: { y: -100, opacity: 0 }
        };
        
      case 'elastic_in':
        return {
          scale: 1,
          from: { scale: 0 }
        };
        
      case 'glitch_in':
        return {
          x: 0,
          opacity: 1,
          from: { x: () => Math.random() * 20 - 10, opacity: 0 }
        };
        
      default:
        return { opacity: 1, from: { opacity: 0 } };
    }
  }
  
  /**
   * Animate text character by character
   */
  static animateCharacters(
    element: HTMLElement,
    animation: Omit<TextAnimation , 'type, '>,
    stagger: number = 0.03
  ): gsap.core.Timeline {
    // Split text into characters
    const text = element.textContent || '';
    element.innerHTML = text.split('').map(char => 
      `<span style="display:inline-block">${char === ', ' ? '&nbsp;' : char}</span>`
    ).join(', ');
    
    const chars = element.querySelectorAll('span');
    
    const tl = gsap.timeline();
    
    tl.from(chars, {
      opacity: 0,
      y: 20,
      duration: animation.duration,
      stagger: stagger,
      ease: animation.easing
    });
    
    return tl;
  }
  
  /**
   * Typewriter effect
   */
  static typewriter(
    element: HTMLElement,
    duration: number,
    cursor: boolean = true
  ): gsap.core.Timeline {
    const text = element.textContent || ', ';
    const chars = text.split(', ');
    
    element.textContent = cursor ? '|' : ', ';
    
    const tl = gsap.timeline();
    
    chars.forEach((char, i) => {
      tl.call(() => {
        element.textContent = text.substring(0, i + 1) + (cursor ? '|' : ', ');
      }, undefined, i * (duration / chars.length));
    });
    
    if (cursor) {
      tl.call(() => {
        element.textContent = text;
      });
    }
    
    return tl;
  }
  
  /**
   * Get animation presets
   */
  static getAnimationPresets(): Array<{
    name: string;
    animation: TextAnimation;
    category: string;
  }> {
    return [
      // Basic
      { name: 'Fade In', animation: { type: 'fade_in', duration: 0.5, delay: 0, easing: 'power2.out' }, category: 'Basic' },
      { name: 'Fade Out', animation: { type: 'fade_out', duration: 0.5, delay: 0, easing: 'power2.in' }, category: 'Basic' },
      
      // Slide
      { name: 'Slide Up', animation: { type: 'slide_up', duration: 0.6, delay: 0, easing: 'power3.out' }, category: 'Slide' },
      { name: 'Slide Down', animation: { type: 'slide_down', duration: 0.6, delay: 0, easing: 'power3.out' }, category: 'Slide' },
      { name: 'Slide Left', animation: { type: 'slide_left', duration: 0.6, delay: 0, easing: 'power3.out' }, category: 'Slide' },
      { name: 'Slide Right', animation: { type: 'slide_right', duration: 0.6, delay: 0, easing: 'power3.out' }, category: 'Slide' },
      
      // Zoom
      { name: 'Zoom In', animation: { type: 'zoom_in', duration: 0.8, delay: 0, easing: 'power2.out' }, category: 'Zoom' },
      { name: 'Zoom Out', animation: { type: 'zoom_out', duration: 0.8, delay: 0, easing: 'power2.out' }, category: 'Zoom' },
      
      // Rotate
      { name: 'Rotate In', animation: { type: 'rotate_in', duration: 0.7, delay: 0, easing: 'back.out(1.7)' }, category: 'Rotate' },
      
      // Bounce & Elastic
      { name: 'Bounce In', animation: { type: 'bounce_in', duration: 1.0, delay: 0, easing: 'bounce.out' }, category: 'Playful' },
      { name: 'Elastic In', animation: { type: 'elastic_in', duration: 1.2, delay: 0, easing: 'elastic.out(1, 0.5)' }, category: 'Playful' },
      
      // Creative
      { name: 'Glitch In', animation: { type: 'glitch_in', duration: 0.4, delay: 0, easing: 'steps(5)' }, category: 'Creative' },
      { name: 'Typewriter', animation: { type: 'typewriter', duration: 2.0, delay: 0, easing: 'none' }, category: 'Creative' }
    ];
  }
  
  /**
   * Get GSAP easing options
   */
  static getEasingOptions(): string[] {
    return [
      'none','power1.in','power1.out','power1.inOut','power2.in','power2.out','power2.inOut','power3.in','power3.out','power3.inOut','back.in(1.7)','back.out(1.7)','back.inOut(1.7)','elastic.in(1, 0.5)','elastic.out(1, 0.5)','elastic.inOut(1, 0.5)','bounce.in','bounce.out','bounce.inOut','circ.in','circ.out','circ.inOut','expo.in','expo.out','expo.inOut','sine.in','sine.out','sine.inOut','steps(5)','steps(10)','steps(20)'
    ];
  }
}


