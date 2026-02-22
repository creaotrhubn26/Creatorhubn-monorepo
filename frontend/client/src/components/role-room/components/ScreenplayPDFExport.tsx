import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';

// Fountain element types
type FountainElement = 
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'centered'
  | 'section'
  | 'page_break';

interface ParsedLine {
  type: FountainElement;
  content: string;
}

interface ScreenplayPDFExportProps {
  content: string;
  title: string;
  author?: string;
  draft?: string;
  date?: string;
  contactInfo?: string;
  onExport?: () => void;
}

interface PDFSettings {
  paperSize: 'letter' | 'a4';
  includePageNumbers: boolean;
  includeSceneNumbers: boolean;
  startPageNumber: number;
  titlePage: boolean;
  fontFamily: 'courier' | 'courier-prime';
  fontSize: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  revision: string;
  revisionColor: string;
}

// Fountain parsing (simplified version)
const SCENE_HEADING_PATTERN = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\.\s]/i;
const CHARACTER_PATTERN = /^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/;
const TRANSITION_PATTERN = /^[A-Z\s]+:$/;
const CENTERED_PATTERN = /^>.*<$/;
const PARENTHETICAL_PATTERN = /^\(.*\)$/;
const SECTION_PATTERN = /^#+\s/;
const PAGE_BREAK_PATTERN = /^={3,}$/;

const parseFountain = (content: string): ParsedLine[] => {
  const lines = content.split('\n');
  const result: ParsedLine[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    
    let type: FountainElement = 'action';
    
    if (!trimmed) {
      type = 'action';
    } else if (PAGE_BREAK_PATTERN.test(trimmed)) {
      type = 'page_break';
    } else if (SECTION_PATTERN.test(trimmed)) {
      type = 'section';
    } else if (SCENE_HEADING_PATTERN.test(trimmed) || trimmed.startsWith('.')) {
      type = 'scene_heading';
    } else if (CENTERED_PATTERN.test(trimmed)) {
      type = 'centered';
    } else if (trimmed.startsWith('>') || (TRANSITION_PATTERN.test(trimmed) && trimmed === trimmed.toUpperCase())) {
      type = 'transition';
    } else if (PARENTHETICAL_PATTERN.test(trimmed)) {
      const prevType = result.length > 0 ? result[result.length - 1].type : null;
      if (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical') {
        type = 'parenthetical';
      }
    } else if (CHARACTER_PATTERN.test(trimmed) || trimmed.startsWith('@')) {
      if (!prevLine && nextLine) {
        type = 'character';
      }
    }
    
    // Check for dialogue
    if (type === 'action') {
      const prevType = result.length > 0 ? result[result.length - 1].type : null;
      if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
        if (trimmed && !CHARACTER_PATTERN.test(trimmed) && !PARENTHETICAL_PATTERN.test(trimmed)) {
          type = 'dialogue';
        }
      }
    }
    
    result.push({ type, content: trimmed });
  }
  
  return result;
};

export const ScreenplayPDFExport: React.FC<ScreenplayPDFExportProps> = ({
  content,
  title,
  author = '',
  draft = '1st Draft',
  date = new Date().toLocaleDateString('nb-NO'),
  contactInfo = '',
  onExport,
}) => {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<PDFSettings>({
    paperSize: 'letter',
    includePageNumbers: true,
    includeSceneNumbers: true,
    startPageNumber: 1,
    titlePage: true,
    fontFamily: 'courier-prime',
    fontSize: 12,
    margins: {
      top: 1,
      bottom: 1,
      left: 1.5,
      right: 1,
    },
    revision: '',
    revisionColor: '',
  });

  // Parse content
  const parsedContent = useMemo(() => parseFountain(content), [content]);

  // Count scenes
  const sceneCount = useMemo(() => {
    return parsedContent.filter(l => l.type === 'scene_heading').length;
  }, [parsedContent]);

  // Estimate page count (55 lines per page standard)
  const estimatedPages = useMemo(() => {
    return Math.ceil(parsedContent.length / 55);
  }, [parsedContent]);

  // Generate PDF/Print
  const handleExport = async (format: 'pdf' | 'print') => {
    setIsGenerating(true);
    
    try {
      // Create print window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window');
      }

      const css = generateCSS(settings);
      const html = generateHTML(parsedContent, settings, title, author, draft, date, contactInfo);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title} - Screenplay</title>
            <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
            <style>${css}</style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();

      if (format === 'print') {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        // For PDF, trigger print dialog with PDF option
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }

      onExport?.();
      setOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<PdfIcon />}
        onClick={() => setOpen(true)}
      >
        Eksporter PDF
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <PdfIcon color="primary" />
            <Typography variant="h6">Eksporter Screenplay</Typography>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {/* Preview Stats */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Chip label={`${sceneCount} scener`} />
                <Chip label={`~${estimatedPages} sider`} />
                <Chip label={`${content.split(/\s+/).length} ord`} />
              </Stack>
            </Paper>

            {/* Title Page Settings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Tittelside</Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.titlePage}
                    onChange={(e) => setSettings({ ...settings, titlePage: e.target.checked })}
                  />
                }
                label="Inkluder tittelside"
              />
            </Box>

            {/* Page Settings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Sideinnstillinger</Typography>
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Papirstørrelse</InputLabel>
                  <Select
                    value={settings.paperSize}
                    label="Papirstørrelse"
                    onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as 'letter' | 'a4' })}
                  >
                    <MenuItem value="letter">US Letter</MenuItem>
                    <MenuItem value="a4">A4</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.includePageNumbers}
                      onChange={(e) => setSettings({ ...settings, includePageNumbers: e.target.checked })}
                    />
                  }
                  label="Sidenummer"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.includeSceneNumbers}
                      onChange={(e) => setSettings({ ...settings, includeSceneNumbers: e.target.checked })}
                    />
                  }
                  label="Scenenummer"
                />
              </Stack>
            </Box>

            {/* Font Settings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Skrift</Typography>
              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Skrifttype</InputLabel>
                  <Select
                    value={settings.fontFamily}
                    label="Skrifttype"
                    onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value as 'courier' | 'courier-prime' })}
                  >
                    <MenuItem value="courier-prime">Courier Prime</MenuItem>
                    <MenuItem value="courier">Courier New</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Skriftstørrelse"
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 12 })}
                  inputProps={{ min: 10, max: 14 }}
                  sx={{ width: 120 }}
                />
              </Stack>
            </Box>

            {/* Revision Settings */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Revisjon</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  size="small"
                  label="Revisjonsnavn"
                  placeholder="f.eks. Blue Revision"
                  value={settings.revision}
                  onChange={(e) => setSettings({ ...settings, revision: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Farge</InputLabel>
                  <Select
                    value={settings.revisionColor}
                    label="Farge"
                    onChange={(e) => setSettings({ ...settings, revisionColor: e.target.value })}
                  >
                    <MenuItem value="">Ingen</MenuItem>
                    <MenuItem value="white">White</MenuItem>
                    <MenuItem value="blue">Blue</MenuItem>
                    <MenuItem value="pink">Pink</MenuItem>
                    <MenuItem value="yellow">Yellow</MenuItem>
                    <MenuItem value="green">Green</MenuItem>
                    <MenuItem value="goldenrod">Goldenrod</MenuItem>
                    <MenuItem value="buff">Buff</MenuItem>
                    <MenuItem value="salmon">Salmon</MenuItem>
                    <MenuItem value="cherry">Cherry</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            <Divider />

            {/* Preview */}
            <Box>
              <Button
                variant="text"
                startIcon={<PreviewIcon />}
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Skjul forhåndsvisning' : 'Vis forhåndsvisning'}
              </Button>
              
              {showPreview && (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    mt: 2, 
                    p: 3, 
                    bgcolor: '#fff', 
                    color: '#000',
                    maxHeight: 400,
                    overflow: 'auto',
                    fontFamily: settings.fontFamily === 'courier-prime' ? 'Courier Prime, monospace' : 'Courier New, monospace',
                    fontSize: `${settings.fontSize}pt`,
                  }}
                  ref={printRef}
                >
                  {settings.titlePage && (
                    <Box sx={{ textAlign: 'center', mb: 4, pt: 10 }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, fontFamily: 'inherit' }}>
                        {title.toUpperCase()}
                      </Typography>
                      <Typography sx={{ mb: 1, fontFamily: 'inherit' }}>Written by</Typography>
                      <Typography sx={{ mb: 4, fontFamily: 'inherit' }}>{author}</Typography>
                      <Typography sx={{ fontFamily: 'inherit' }}>{draft}</Typography>
                      <Typography sx={{ fontFamily: 'inherit' }}>{date}</Typography>
                      {contactInfo && (
                        <Typography sx={{ mt: 4, fontFamily: 'inherit', whiteSpace: 'pre-line' }}>
                          {contactInfo}
                        </Typography>
                      )}
                    </Box>
                  )}
                  
                  <Box sx={{ borderTop: settings.titlePage ? '1px dashed #ccc' : 'none', pt: 2 }}>
                    {parsedContent.slice(0, 30).map((line, index) => (
                      <Box
                        key={index}
                        sx={{
                          ...getPreviewStyle(line.type),
                          fontFamily: 'inherit',
                          minHeight: '1.5em',
                        }}
                      >
                        {settings.includeSceneNumbers && line.type === 'scene_heading' && (
                          <span style={{ position: 'absolute', left: 0 }}>
                            {parsedContent.slice(0, index + 1).filter(l => l.type === 'scene_heading').length}.
                          </span>
                        )}
                        {line.content || '\u00A0'}
                      </Box>
                    ))}
                    {parsedContent.length > 30 && (
                      <Typography sx={{ fontStyle: 'italic', color: '#666', mt: 2 }}>
                        ... og {parsedContent.length - 30} flere linjer
                      </Typography>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Avbryt</Button>
          <Button
            variant="outlined"
            startIcon={isGenerating ? <CircularProgress size={16} /> : <PrintIcon />}
            onClick={() => handleExport('print')}
            disabled={isGenerating}
          >
            Skriv ut
          </Button>
          <Button
            variant="contained"
            startIcon={isGenerating ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={() => handleExport('pdf')}
            disabled={isGenerating}
          >
            Last ned PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Helper: Generate CSS for print
const generateCSS = (settings: PDFSettings): string => {
  const fontFamily = settings.fontFamily === 'courier-prime' 
    ? "'Courier Prime', 'Courier New', monospace" 
    : "'Courier New', monospace";
  
  const pageSize = settings.paperSize === 'letter' ? '8.5in 11in' : '210mm 297mm';
  
  return `
    @page {
      size: ${pageSize};
      margin: ${settings.margins.top}in ${settings.margins.right}in ${settings.margins.bottom}in ${settings.margins.left}in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fontFamily};
      font-size: ${settings.fontSize}pt;
      line-height: 1;
      color: #000;
      background: #fff;
    }
    
    .title-page {
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    
    .title-page h1 {
      font-size: 24pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 24pt;
    }
    
    .title-page .author {
      margin-bottom: 48pt;
    }
    
    .title-page .contact {
      position: absolute;
      bottom: 1in;
      left: 1.5in;
      text-align: left;
    }
    
    .screenplay {
      max-width: 6in;
      margin: 0 auto;
    }
    
    .scene-heading {
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 24pt;
      margin-bottom: 12pt;
      position: relative;
    }
    
    .scene-number {
      position: absolute;
      left: -0.5in;
    }
    
    .action {
      margin-bottom: 12pt;
    }
    
    .character {
      margin-left: 2in;
      margin-top: 12pt;
      text-transform: uppercase;
    }
    
    .dialogue {
      margin-left: 1in;
      margin-right: 1.5in;
      margin-bottom: 12pt;
    }
    
    .parenthetical {
      margin-left: 1.5in;
      margin-right: 2in;
    }
    
    .transition {
      text-align: right;
      text-transform: uppercase;
      margin-top: 12pt;
      margin-bottom: 12pt;
    }
    
    .centered {
      text-align: center;
      margin: 12pt 0;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    .section {
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
    }
    
    .page-number {
      position: fixed;
      top: 0.5in;
      right: 0.75in;
      font-size: 12pt;
    }
    
    @media print {
      .no-print { display: none; }
    }
  `;
};

// Helper: Generate HTML content
const generateHTML = (
  lines: ParsedLine[],
  settings: PDFSettings,
  title: string,
  author: string,
  draft: string,
  date: string,
  contactInfo: string
): string => {
  let html = '';
  let sceneNumber = 0;
  let pageNumber = settings.startPageNumber;
  
  // Title page
  if (settings.titlePage) {
    html += `
      <div class="title-page">
        <h1>${escapeHtml(title)}</h1>
        <div class="author">
          <p>Written by</p>
          <p>${escapeHtml(author)}</p>
        </div>
        <div>
          <p>${escapeHtml(draft)}</p>
          <p>${escapeHtml(date)}</p>
        </div>
        ${contactInfo ? `<div class="contact">${escapeHtml(contactInfo).replace(/\n/g, '<br>')}</div>` : ''}
      </div>
    `;
  }
  
  // Screenplay content
  html += '<div class="screenplay">';
  
  if (settings.includePageNumbers) {
    html += `<div class="page-number">${pageNumber}.</div>`;
  }
  
  for (const line of lines) {
    if (line.type === 'scene_heading') {
      sceneNumber++;
      const sceneNum = settings.includeSceneNumbers ? `<span class="scene-number">${sceneNumber}</span>` : '';
      html += `<div class="scene-heading">${sceneNum}${escapeHtml(line.content)}</div>`;
    } else if (line.type === 'page_break') {
      pageNumber++;
      html += `<div class="page-break"></div>`;
      if (settings.includePageNumbers) {
        html += `<div class="page-number">${pageNumber}.</div>`;
      }
    } else {
      html += `<div class="${line.type.replace('_', '-')}">${escapeHtml(line.content) || '&nbsp;'}</div>`;
    }
  }
  
  html += '</div>';
  
  return html;
};

// Helper: Get preview style
const getPreviewStyle = (type: FountainElement): React.CSSProperties => {
  const base: React.CSSProperties = {
    fontSize: '12pt',
    lineHeight: 1,
    position: 'relative',
  };
  
  switch (type) {
    case 'scene_heading':
      return { ...base, fontWeight: 700, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 };
    case 'character':
      return { ...base, marginLeft: '2in', textTransform: 'uppercase', marginTop: 12 };
    case 'dialogue':
      return { ...base, marginLeft: '1in', marginRight: '1.5in', marginBottom: 12 };
    case 'parenthetical':
      return { ...base, marginLeft: '1.5in', marginRight: '2in' };
    case 'transition':
      return { ...base, textAlign: 'right', textTransform: 'uppercase', marginTop: 12, marginBottom: 12 };
    case 'centered':
      return { ...base, textAlign: 'center', marginTop: 12, marginBottom: 12 };
    case 'action':
      return { ...base, marginBottom: 12 };
    case 'section':
      return { ...base, fontWeight: 700, marginTop: 24, marginBottom: 12 };
    default:
      return base;
  }
};

// Helper: Escape HTML
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export default ScreenplayPDFExport;
