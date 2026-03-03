import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

function formatDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1} ${message}`;
  }
  return message;
}

const cwd = process.cwd();
const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.story-arc-studio.json');

if (!configPath) {
  console.error('Could not find tsconfig.story-arc-studio.json');
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(formatDiagnostic(configFile.error));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

const rootFiles = parsed.fileNames.filter((file) => !file.includes('__tests__/'));
const program = ts.createProgram(rootFiles, {
  ...parsed.options,
  noEmit: true,
});

const diagnostics = [
  ...program.getOptionsDiagnostics(),
  ...rootFiles.flatMap((fileName) => {
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      return [];
    }
    return [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ];
  }),
];

if (diagnostics.length > 0) {
  diagnostics.forEach((diagnostic) => {
    console.error(formatDiagnostic(diagnostic));
  });
  process.exit(1);
}

console.log(`Story Arc Studio typecheck passed (${rootFiles.length} root files).`);
