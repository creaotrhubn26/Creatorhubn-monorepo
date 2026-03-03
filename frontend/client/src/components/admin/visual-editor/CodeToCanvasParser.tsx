/**
 * Code-to-Canvas Parser
 * Converts React/HTML code back into visual editor elements
 * Enables bi-directional sync between code editor and canvas
 */

import { EditorElement } from './VisualEditorContext';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ParseResult {
  elements: EditorElement[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseWarning {
  line: number;
  message: string;
  suggestion: string;
}

export class CodeToCanvasParser {
  private elementCounter = 0;
  private currentX = 100;
  private currentY = 100;
  private stackDepth = 0;

  /**
   * Parse React JSX code and convert to canvas elements
   */
  parseReactCode(code: string): ParseResult {
    const elements: EditorElement[] = [];
    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    try {
      // Parse React/JSX code using Babel
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx','typescript'],
      });

      // Traverse the AST and extract JSX elements
      traverse(ast, {
        JSXElement: (path) => {
          try {
            const element = this.convertJSXElementToEditorElement(path.node);
            if (element) {
              elements.push(element);
            }
          } catch (error) {
            errors.push({
              line: path.node.loc?.start.line || 0,
              column: path.node.loc?.start.column || 0,
              message: error instanceof Error ? error.message : 'Parse error',
              severity: 'error',
            });
          }
        },
      });

      // Check for common issues
      this.validateElements(elements, warnings);

      return { elements, errors, warnings };
    } catch (error) {
      return {
        elements: [],
        errors: [
          {
            line: 0,
            column: 0,
            message: error instanceof Error ? error.message : 'Failed to parse code',
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Parse HTML code and convert to canvas elements
   */
  parseHTMLCode(html: string): ParseResult {
    const elements: EditorElement[] = [];
    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check for parser errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        errors.push({
          line: 0,
          column: 0,
          message: 'Invalid HTML syntax',
          severity: 'error',
        });
        return { elements, errors, warnings };
      }

      // Convert DOM tree to canvas elements
      const body = doc.body;
      this.traverseHTMLNode(body, elements, null);

      this.validateElements(elements, warnings);

      return { elements, errors, warnings };
    } catch (error) {
      return {
        elements: [],
        errors: [
          {
            line: 0,
            column: 0,
            message: error instanceof Error ? error.message : 'Failed to parse HTML',
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Convert Babel JSX element to EditorElement
   */
  private convertJSXElementToEditorElement(node: t.JSXElement): EditorElement | null {
    const openingElement = node.openingElement;
    const tagName = this.getJSXElementName(openingElement.name);

    if (!tagName) return null;

    const id = `element-${Date.now()}-${this.elementCounter++}`;
    const position = this.calculatePosition();

    // Extract props and styles
    const { props, styles } = this.extractJSXAttributes(openingElement.attributes);

    // Determine element type
    const type = this.mapTagToElementType(tagName);

    // Extract children text
    const text = this.extractJSXText(node.children);

    const element: EditorElement = {
      id,
      type,
      x: position.x,
      y: position.y,
      width: styles.width ? parseInt(styles.width as string) : 200,
      height: styles.height ? parseInt(styles.height as string) : 100,
      styles,
      props: {
        ...props,
        tagName,
        text: text || props.children,
      },
    };

    return element;
  }

  /**
   * Traverse HTML DOM tree and convert to elements
   */
  private traverseHTMLNode(node: Node, elements: EditorElement[], parentId: string | null): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // Skip script, style, and meta tags
    if (['script','style','meta','link','head'].includes(tagName)) {
      return;
    }

    const id = `element-${Date.now()}-${this.elementCounter++}`;
    const position = this.calculatePosition();

    // Extract inline styles
    const styles = this.extractInlineStyles(element);

    // Extract attributes
    const props = this.extractHTMLAttributes(element);

    // Get text content
    const text = this.extractTextContent(element);

    const editorElement: EditorElement = {
      id,
      type: this.mapTagToElementType(tagName),
      x: position.x,
      y: position.y,
      width: styles.width ? parseInt(styles.width as string) : 200,
      height: styles.height ? parseInt(styles.height as string) : 100,
      styles,
      props: {
        ...props,
        tagName,
        text,
      },
      parent: parentId || undefined,
    };

    elements.push(editorElement);

    // Recursively process children
    Array.from(element.children).forEach((child) => {
      this.traverseHTMLNode(child, elements, id);
    });
  }

  /**
   * Extract JSX element name
   */
  private getJSXElementName(
    name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
  ): string | null {
    if (t.isJSXIdentifier(name)) {
      return name.name;
    }
    if (t.isJSXMemberExpression(name)) {
      // Handle cases like <Box.Item>
      return this.getJSXElementName(name.property);
    }
    return null;
  }

  /**
   * Extract attributes from JSX element
   */
  private extractJSXAttributes(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>) {
    const props: Record<string, unknown> = {};
    const styles: Record<string, unknown> = {};

    attributes.forEach((attr) => {
      if (!t.isJSXAttribute(attr)) return;
      if (!t.isJSXIdentifier(attr.name)) return;

      const name = attr.name.name;
      const value = this.extractJSXAttributeValue(attr.value);

      if (name === 'style' && typeof value === 'object') {
        Object.assign(styles, value);
      } else if (name === 'className' || name === 'class') {
        props.className = value;
      } else {
        props[name] = value;
      }
    });

    return { props, styles };
  }

  /**
   * Extract JSX attribute value
   */
  private extractJSXAttributeValue(value: t.JSXAttribute['value']): string | number | boolean | Record<string, unknown> | null {
    if (!value) return true;

    if (t.isStringLiteral(value)) {
      return value.value;
    }

    if (t.isJSXExpressionContainer(value)) {
      const expr = value.expression;

      if (t.isStringLiteral(expr)) {
        return expr.value;
      }
      if (t.isNumericLiteral(expr)) {
        return expr.value;
      }
      if (t.isBooleanLiteral(expr)) {
        return expr.value;
      }
      if (t.isObjectExpression(expr)) {
        // Parse style objects
        const obj: Record<string, unknown> = {};
        expr.properties.forEach((prop) => {
          if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
            const key = prop.key.name;
            if (t.isStringLiteral(prop.value)) {
              obj[key] = prop.value.value;
            } else if (t.isNumericLiteral(prop.value)) {
              obj[key] = prop.value.value;
            }
          }
        });
        return obj;
      }
    }

    return null;
  }

  /**
   * Extract text from JSX children
   */
  private extractJSXText(
    children: Array<
      t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment | t.JSXSpreadChild
    >,
  ): string {
    let text = '';

    children.forEach((child) => {
      if (t.isJSXText(child)) {
        text += child.value.trim();
      } else if (t.isJSXExpressionContainer(child)) {
        if (t.isStringLiteral(child.expression)) {
          text += child.expression.value;
        }
      }
    });

    return text;
  }

  /**
   * Extract inline styles from HTML element
   */
  private extractInlineStyles(element: HTMLElement): Record<string, unknown> {
    const styles: Record<string, unknown> = {};

    if (element.style) {
      // Convert CSSStyleDeclaration to object
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i];
        const value = element.style.getPropertyValue(prop);
        const camelProp = this.cssPropToCamelCase(prop);
        styles[camelProp] = value;
      }
    }

    return styles;
  }

  /**
   * Extract attributes from HTML element
   */
  private extractHTMLAttributes(element: HTMLElement): Record<string, unknown> {
    const props: Record<string, unknown> = {};

    Array.from(element.attributes).forEach((attr) => {
      if (attr.name === 'style') return; // Skip style, handled separately
      props[attr.name] = attr.value;
    });

    return props;
  }

  /**
   * Extract text content from HTML element
   */
  private extractTextContent(element: HTMLElement): string {
    // Get direct text nodes only (not nested)
    let text = '';
    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent?.trim() || '';
      }
    });
    return text;
  }

  /**
   * Map HTML/JSX tag to editor element type
   */
  private mapTagToElementType(tag: string): EditorElement['type'] {
    const tagLower = tag.toLowerCase();

    if (tagLower === 'button') return 'button';
    if (['p','span','h1','h2','h3','h4','h5', 'h6','label'].includes(tagLower))
      return 'text';
    if (tagLower === 'img') return 'image';
    if (['section', 'article', 'aside', 'nav', 'main', 'header','footer'].includes(tagLower))
      return 'container';
    if (['ul', 'ol', 'dl'].includes(tagLower)) return 'container';
    if (tagLower === 'audio') return 'audio';
    if (tagLower === 'video') return 'video';
    if (tagLower === 'div') return 'card';

    // Default to container
    return 'container';
  }

  /**
   * Convert CSS property to camelCase
   */
  private cssPropToCamelCase(prop: string): string {
    return prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Calculate position for new element (staggered layout)
   */
  private calculatePosition(): { x: number; y: number } {
    const x = this.currentX + this.stackDepth * 20;
    const y = this.currentY + this.stackDepth * 20;

    // Move down for next element
    this.currentY += 120;

    // Reset if too far down
    if (this.currentY > 800) {
      this.currentY = 100;
      this.currentX += 250;
    }

    return { x, y };
  }

  /**
   * Validate parsed elements and add warnings
   */
  private validateElements(elements: EditorElement[], warnings: ParseWarning[]): void {
    // Check for overlapping elements
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        if (this.elementsOverlap(elements[i], elements[j])) {
          warnings.push({
            line: 0,
            message: `Elements "${this.getElementLabel(elements[i])}" and "${this.getElementLabel(elements[j])}" overlap`,
            suggestion: 'Adjust positioning or use auto-layout',
          });
        }
      }
    }

    // Check for missing required props
    elements.forEach((element) => {
      if (element.type === 'image' && !element.props.src) {
        warnings.push({
          line: 0,
          message: `Image element "${this.getElementLabel(element)}" is missing src attribute`,
          suggestion: 'Add src attribute with image URL',
        });
      }
      if (element.type === 'button' && !element.props.text && !element.props.children) {
        warnings.push({
          line: 0,
          message: `Button element "${this.getElementLabel(element)}" has no text content`,
          suggestion: 'Add button text or children',
        });
      }
    });
  }

  private getElementLabel(element: EditorElement): string {
    const tagName = element.props.tagName;
    if (typeof tagName === 'string' && tagName.length > 0) {
      return tagName;
    }
    return element.type;
  }

  /**
   * Check if two elements overlap
   */
  private elementsOverlap(a: EditorElement, b: EditorElement): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.elementCounter = 0;
    this.currentX = 100;
    this.currentY = 100;
    this.stackDepth = 0;
  }
}

/**
 * Singleton instance
 */
export const codeToCanvasParser = new CodeToCanvasParser();

/**
 * Helper function to parse code based on language
 */
export function parseCode(code: string, language: 'react' | 'html'): ParseResult {
  codeToCanvasParser.reset();

  if (language ==='react') {
    return codeToCanvasParser.parseReactCode(code);
  } else {
    return codeToCanvasParser.parseHTMLCode(code);
  }
}
