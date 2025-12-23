/**
 * Documentation Generator
 * Automatically generates comprehensive documentation for components and functions
 */

import fs from 'fs';
import path from 'path';

export interface DocumentationConfig {
  inputDir: string;
  outputDir: string;
  includeTests: boolean;
  includeExamples: boolean;
  format: 'markdown' | 'html' | 'json'
}

export interface ComponentDoc {
  name: string;
  type: 'component' | 'hook' | 'utility' | 'api';
  description: string;
  props?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: any;
}>;
  methods?: Array<{
    name: string;
    parameters: Array<{
      name: string;
      type: string;
      description: string;
}>;
    returns: {
      type: string;
      description: string;
};
    description: string;
}>;
  examples: string[];
  tests: string[];
  dependencies: string[];
  lastModified: string
}

export class DocumentationGenerator {
  private config: DocumentationConfig;

  constructor(config: DocumentationConfig) {
    this.config = config;
}

  /**
   * Generate documentation for all components in the input directory
   */
  async generateAll(): Promise<void> {
    const components = await this.scanDirectory(this.config.inputDir);
    
    for (const component of components) {
      const doc = await this.generateComponentDoc(component);
      await this.writeDocumentation(doc);
  }
}

  /**
   * Generate documentation for a specific component
   */
  async generateComponentDoc(filePath: string): Promise<ComponentDoc> {
    const content = await fs.promises.readFile(filePath , 'utf-8');
    const ast = this.parseFile(content);
    
    return {
      name: this.extractName(ast),
      type: this.extractType(ast),
      description: this.extractDescription(ast),
      props: this.extractProps(ast),
      methods: this.extractMethods(ast),
      examples: this.extractExamples(ast),
      tests: this.extractTests(filePath),
      dependencies: this.extractDependencies(ast),
      lastModified: new Date().toISOString()
};
}

  /**
   * Write documentation to output directory
   */
  private async writeDocumentation(doc: ComponentDoc): Promise<void> {
    const fileName = `${doc.name}.${this.config.format}`;
    const outputPath = path.join(this.config.outputDir, fileName);
    
    let content: string;
    
    switch (this.config.format) {
      case 'markdown':
        content = this.generateMarkdown(doc);
        break;
      case 'html':
        content = this.generateHTML(doc);
        break;
      case 'json':
        content = JSON.stringify(doc, null, 2);
        break;
      default: throw new Error(`Unsupported format: ${this.config.format}`);
  }
    
    await fs.promises.writeFile(outputPath, content);
}

  /**
   * Generate Markdown documentation
   */
  private generateMarkdown(doc: ComponentDoc): string {
    let md = `# ${doc.name}\n\n`;
    md += `${doc.description}\n\n`;
    
    if (doc.props && doc.props.length > 0) {
      md += `## Props\n\n`;
      md += `| Name | Type | Required | Description | Default |\n`;
      md += `|------|------|----------|-------------|----------|\n`;
      
      doc.props.forEach(prop => {
        md += `| ${prop.name} | \`${prop.type}\` | ${prop.required ? 'Yes' : 'No'} | ${prop.description} | ${prop.defaultValue || '-'} |\n`;
    });
      
      md += `\n`;
  }
    
    if (doc.methods && doc.methods.length > 0) {
      md += `## Methods\n\n`;
      
      doc.methods.forEach(method => {
        md += `### ${method.name}\n\n`;
        md += `${method.description}\n\n`;
        
        if (method.parameters.length > 0) {
          md += `**Parameters: **\n`;
          method.parameters.forEach(param => {
            md += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
        });
          md += `\n`;
      }
        
        md += `**Returns: ** \`${method.returns.type}\` - ${method.returns.description}\n\n`;
    });
  }
    
    if (doc.examples.length > 0) {
      md += `## Examples\n\n`;
      
      doc.examples.forEach((example, index) => {
        md += `### Example ${index + 1}\n\n`;
        md += `\`\`\`tsx\n${example}\n\`\`\`\n\n`;
    });
  }
    
    if (doc.tests.length > 0) {
      md += `## Tests\n\n`;
      
      doc.tests.forEach((test, index) => {
        md += `### Test ${index + 1}\n\n`;
        md += `\`\`\`ts\n${test}\n\`\`\`\n\n`;
    });
  }
    
    if (doc.dependencies.length > 0) {
      md += `## Dependencies\n\n`;
      md += doc.dependencies.map(dep => `- ${dep}`).join('\n');
      md += `\n\n`;
  }
    
    md += `---\n`;
    md += `*Last modified: ${doc.lastModified}*\n`;
    
    return md;
}

  /**
   * Generate HTML documentation
   */
  private generateHTML(doc: ComponentDoc): string {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `<title>${doc.name} Documentation</title>\n`;
    html += `<style>\n`;
    html += `body { font-family: Arial, sans-serif; margin: 40px }\n`;
    html += `h1 { color: #333; border-bottom: 2px solid #333 }\n`;
    html += `h2 { color: #666; margin-top: 30px }\n`;
    html += `table { border-collapse: collapse; width: 100% }\n`;
    html += `th, td { border: 1px solid #ddd; padding: 8px; text-align: left }\n`;
    html += `th { background-color: #f2f2f2 }\n`;
    html += `code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px }\n`;
    html += `pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto }\n`;
    html += `</style>\n</head>\n<body>\n`;
    
    html += `<h1>${doc.name}</h1>\n`;
    html += `<p>${doc.description}</p>\n`;
    
    if (doc.props && doc.props.length > 0) {
      html += `<h2>Props</h2>\n`;
      html += `<table>\n`;
      html += `<tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th><th>Default</th></tr>\n`;
      
      doc.props.forEach(prop => {
        html += `<tr>\n`;
        html += `<td><code>${prop.name}</code></td>\n`;
        html += `<td><code>${prop.type}</code></td>\n`;
        html += `<td>${prop.required ? 'Yes' : 'No'}</td>\n`;
        html += `<td>${prop.description}</td>\n`;
        html += `<td>${prop.defaultValue || '-'}</td>\n`;
        html += `</tr>\n`;
    });
      
      html += `</table>\n`;
  }
    
    if (doc.examples.length > 0) {
      html += `<h2>Examples</h2>\n`;
      
      doc.examples.forEach((example, index) => {
        html += `<h3>Example ${index + 1}</h3>\n`;
        html += `<pre><code>${example}</code></pre>\n`;
    });
  }
    
    html += `</body>\n</html>`;
    
    return html;
}

  /**
   * Scan directory for component files
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await this.scanDirectory(fullPath);
        files.push(...subFiles);
    } else if (entry.isFile() && this.isComponentFile(entry.name)) {
        files.push(fullPath);
    }
  }
    
    return files;
}

  /**
   * Check if file is a component file
   */
  private isComponentFile(fileName: string): boolean {
    const ext = path.extname(fileName);
    return ['.tsx','.ts','.jsx','.js'].includes(ext);
}

  /**
   * Parse file content (simplified AST parsing)
   */
  private parseFile(content: string): any {
    // Simplified parsing - in a real implementation, use a proper AST parser
    return {
      content,
      lines: content.split('\n')
};
}

  /**
   * Extract component name from AST
   */
  private extractName(ast: any): string {
    // Simplified extraction - in a real implementation, use proper AST parsing
    const match = ast.content.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)/);
    return match ? match[1] : 'Unknown';
}

  /**
   * Extract component type from AST
   */
  private extractType(ast: any): 'component' | 'hook' | 'utility' | 'api' {
    if (ast.content.includes('use')) return 'hook';
    if (ast.content.includes('React.FC') || ast.content.includes('JSX')) return 'component';
    if (ast.content.includes('api') || ast.content.includes('fetch')) return 'api';
    return 'utility';
}

  /**
   * Extract description from JSDoc comments
   */
  private extractDescription(ast: any): string {
    const match = ast.content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\//);
    return match ? match[1].trim() : 'No description available';
}

  /**
   * Extract props from TypeScript interface
   */
  private extractProps(ast: any): Array<any> {
    // Simplified extraction - in a real implementation, use proper TypeScript AST parsing
    const props: any[] = [];
    const interfaceMatch = ast.content.match(/interface\s+(\w+)\s*\{([^}]+)\}/);
    
    if (interfaceMatch) {
      const propsContent = interfaceMatch[2];
      const propMatches = propsContent.matchAll(/(\w+)(\?)?\s*:\s*([^;]+);/g);
      
      for (const match of propMatches) {
        props.push({
          name: match[],
          type: match[3].trim(),
          required: !match[],
          description: 'No description available'
    });
    }
  }
    
    return props;
}

  /**
   * Extract methods from component
   */
  private extractMethods(ast: any): Array<any> {
    // Simplified extraction - in a real implementation, use proper AST parsing
    const methods: any[] = [];
    const methodMatches = ast.content.matchAll(/(\w+)\s*\([^)]*\)\s*:\s*([^{]+)\s*\{/g);
    
    for (const match of methodMatches) {
      methods.push({
        name: match[],
        parameters:  [],
        returns: {
          type: match[2].trim(),
          description: 'No description available'
    },
        description: 'No description available'
  });
  }
    
    return methods;
}

  /**
   * Extract examples from comments
   */
  private extractExamples(ast: any): string[] {
    const examples: string[] = [];
    const exampleMatches = ast.content.matchAll(/@example\s*\n\s*\*\s*```[\s\S]*?```/g);
    
    for (const match of exampleMatches) {
      const example = match[0]
        .replace(/@example\s*\n\s*\*\s*``, `, /g, '')
        .replace(/```$/', ')
        .trim();
      examples.push(example);
  }
    
    return examples;
}

  /**
   * Extract tests from test files
   */
  private extractTests(filePath: string): string[] {
    // In a real implementation, scan for corresponding test files
    return [];
}

  /**
   * Extract dependencies from imports
   */
  private extractDependencies(ast: any): string[] {
    const dependencies: string[] = [];
    const importMatches = ast.content.matchAll(/import\s+.*?\s+from\s+[', "]([^'"]+)['"]/g);
    
    for (const match of importMatches) {
      dependencies.push(match[1]);
}
    
    return dependencies;
}
}

export default DocumentationGenerator;





