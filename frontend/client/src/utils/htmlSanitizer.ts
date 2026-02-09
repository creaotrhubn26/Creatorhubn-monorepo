/**
 * HTML Sanitization Utility
 * Provides safe HTML sanitization to prevent XSS attacks
 */

import React from 'react';

// Simple HTML sanitizer that removes potentially dangerous tags and attributes
export const sanitizeHTML = (html: string): string => {
  if (!html || typeof html !== 'string') {
    return '';
}

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove potentially dangerous tags
  const dangerousTags = ['script','object','embed','link','meta','iframe','frame'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
});
  
  // Remove dangerous attributes
  const dangerousAttributes = ['onload','onerror','onclick','onmouseover','onfocus','onblur'];
  dangerousAttributes.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
});
  
  return sanitized;
};

// More comprehensive sanitizer using DOMPurify if available
export const sanitizeHTMLAdvanced = (html: string): string => {
  // If DOMPurify is available, use it for better sanitization
  if (typeof window !== 'undefined' && (window as any).DOMPurify) {
    return (window as any).DOMPurify.sanitize(html);
}
  
  // Fallback to basic sanitization
  return sanitizeHTML(html);
};

// Safe HTML renderer component props
export interface SafeHTMLProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  tag?: keyof JSX.IntrinsicElements
}

// React component for safe HTML rendering
export const SafeHTML: React.FC<SafeHTMLProps> = ({ 
  html, 
  className, 
  style, 
  tag: Tag = 'div', 
}) => {
  const sanitizedHTML = sanitizeHTMLAdvanced(html);
  return React.createElement(Tag, {
    className,
    style,
    dangerouslySetInnerHTML: { __html: sanitizedHTML }
  });
};


