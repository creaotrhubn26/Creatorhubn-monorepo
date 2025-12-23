// INSERT THIS CODE AFTER LINE 425 in PropertyPanel.tsx
// (After the Live Preview </Box>}, before the Tabs <Box sx={{ borderBottom: 1...}}>)

      {/* ===== ZERO-WORK AUTOMATION TOOLBAR - START ===== */}
      {selectedElements.length > 0 && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            🚀 Zero-Work Actions
          </Typography>
          
          {/* Row 1: Export, History, Clipboard, Presets */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            {/* Export */}
            <Tooltip title="Export as PNG">
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<Download />}
                onClick={async () => {
                  const svg = generateElementSVG(getFirstElement());
                  const result = await automation.exportElement(getFirstElement(), svg, 'png');
                  if (result.success) {
                    debugging.logIntegration('info', 'Element exported', { renderTime: result.renderTime });
                  }
                }}
              >
                Export
              </Button>
            </Tooltip>

            {/* Undo */}
            <Tooltip title="Undo">
              <IconButton 
                size="small"
                onClick={() => {
                  const previous = automation.undo();
                  if (previous) {
                    onUpdateElements([{ id: previous.id, styles: previous.styles, props: previous.props }]);
                  }
                }}
                disabled={!automation.canUndo}
              >
                <Undo />
              </IconButton>
            </Tooltip>

            {/* Redo */}
            <Tooltip title="Redo">
              <IconButton 
                size="small"
                onClick={() => {
                  const next = automation.redo();
                  if (next) {
                    onUpdateElements([{ id: next.id, styles: next.styles, props: next.props }]);
                  }
                }}
                disabled={!automation.canRedo}
              >
                <Redo />
              </IconButton>
            </Tooltip>

            {/* Copy Styles */}
            <Tooltip title="Copy Styles">
              <IconButton 
                size="small"
                onClick={() => {
                  automation.copyStyles(getFirstElement());
                }}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>

            {/* Paste Styles */}
            <Tooltip title="Paste Styles">
              <IconButton 
                size="small"
                onClick={() => {
                  const updated = automation.pasteStyles(getFirstElement());
                  onUpdateElements([{ id: updated.id, styles: updated.styles }]);
                }}
                disabled={!automation.hasClipboard}
              >
                <ContentPaste />
              </IconButton>
            </Tooltip>

            {/* Preset Styles */}
            <Tooltip title="Apply Preset">
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<Style />}
                onClick={(e) => setPresetMenuAnchor(e.currentTarget)}
              >
                Preset
              </Button>
            </Tooltip>
            <Menu
              anchorEl={presetMenuAnchor}
              open={Boolean(presetMenuAnchor)}
              onClose={() => setPresetMenuAnchor(null)}
            >
              {automation.presetStyles.map((preset: string) => (
                <MenuItem 
                  key={preset}
                  onClick={() => {
                    const updated = automation.applyPreset(getFirstElement(), preset as any);
                    onUpdateElements([{ id: updated.id, styles: updated.styles }]);
                    setPresetMenuAnchor(null);
                  }}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Row 2: Responsive, AI */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {/* Smart Resize */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Mobile">
                <Button onClick={() => {
                  const resized = automation.smartResize(getFirstElement(), 'mobile');
                  onUpdateElements([{ 
                    id: resized.id, 
                    props: { width: resized.width },
                    styles: resized.styles 
                  }]);
                }}>
                  <PhoneAndroid fontSize="small" />
                </Button>
              </Tooltip>
              <Tooltip title="Tablet">
                <Button onClick={() => {
                  const resized = automation.smartResize(getFirstElement(), 'tablet');
                  onUpdateElements([{ 
                    id: resized.id, 
                    props: { width: resized.width },
                    styles: resized.styles 
                  }]);
                }}>
                  <Tablet fontSize="small" />
                </Button>
              </Tooltip>
              <Tooltip title="Desktop">
                <Button onClick={() => {
                  const resized = automation.smartResize(getFirstElement(), 'desktop');
                  onUpdateElements([{ 
                    id: resized.id, 
                    props: { width: resized.width },
                    styles: resized.styles 
                  }]);
                }}>
                  <Computer fontSize="small" />
                </Button>
              </Tooltip>
            </ButtonGroup>

            {/* Accessibility Check */}
            <Tooltip title="Check Accessibility">
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<CheckCircle />}
                onClick={() => {
                  const check = automation.checkAccessibility(getFirstElement());
                  setAccessibilityCheck(check);
                }}
              >
                A11y
              </Button>
            </Tooltip>

            {/* Color Palette */}
            <Tooltip title="Color Palette">
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<Palette />}
                onClick={() => setShowAiDialog(true)}
              >
                Colors
              </Button>
            </Tooltip>

            {/* AI Suggestions */}
            <Tooltip title="AI Style Suggestions">
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<AutoAwesome />}
                onClick={async () => {
                  const suggestions = await automation.getAISuggestions(getFirstElement());
                  setAiSuggestions(suggestions);
                }}
              >
                AI Improve
              </Button>
            </Tooltip>
          </Box>

          {/* Accessibility Alert */}
          {accessibilityCheck && (
            <Alert 
              severity={accessibilityCheck.wcagAAA ? 'success' : accessibilityCheck.wcagAA ? 'info' : 'warning'}
              onClose={() => setAccessibilityCheck(null)}
              sx={{ mt: 2 }}
            >
              <AlertTitle>{accessibilityCheck.recommendation}</AlertTitle>
              <Typography variant="body2">
                Contrast Ratio: {accessibilityCheck.contrastRatio}:1
              </Typography>
              {accessibilityCheck.readabilityIssues.map((issue: string) => (
                <Typography key={issue} variant="caption" display="block">
                  • {issue}
                </Typography>
              ))}
            </Alert>
          )}

          {/* AI Suggestions Display */}
          {aiSuggestions && (
            <Alert severity="info" onClose={() => setAiSuggestions(null)} sx={{ mt: 2 }}>
              <AlertTitle>AI Style Suggestions</AlertTitle>
              {aiSuggestions.suggestions?.map((s: any, i: number) => (
                <Box key={i} sx={{ mb: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => {
                      handlePropertyUpdate(s.property, s.value);
                      setAiSuggestions(null);
                    }}
                    sx={{ mr: 1 }}
                  >
                    Apply
                  </Button>
                  <Typography variant="caption">
                    <strong>{s.property}:</strong> {s.value} - {s.reason}
                  </Typography>
                </Box>
              ))}
            </Alert>
          )}

          {/* Brand Color Library */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              🎨 Brand Colors
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Primary Brand Color">
                <Box 
                  onClick={() => handlePropertyUpdate('backgroundColor', brandColors.primary)}
                  sx={{ 
                    width: 40, 
                    height: 40, 
                    bgcolor: brandColors.primary, 
                    borderRadius: 1, 
                    cursor: 'pointer',
                    border: '2px solid #fff',
                    boxShadow: 1,
                    '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.2s' }
                  }} 
                />
              </Tooltip>
              <Tooltip title="Accent Color">
                <Box 
                  onClick={() => handlePropertyUpdate('backgroundColor', brandColors.accent)}
                  sx={{ width: 40, height: 40, bgcolor: brandColors.accent, borderRadius: 1, cursor: 'pointer', border: '2px solid #fff', boxShadow: 1, '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.2s' } }} 
                />
              </Tooltip>
              <Tooltip title="Background">
                <Box 
                  onClick={() => handlePropertyUpdate('backgroundColor', brandColors.background)}
                  sx={{ width: 40, height: 40, bgcolor: brandColors.background, borderRadius: 1, cursor: 'pointer', border: '2px solid #fff', boxShadow: 1, '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.2s' } }} 
                />
              </Tooltip>
              <Tooltip title="Text Color">
                <Box 
                  onClick={() => handlePropertyUpdate('color', brandColors.text)}
                  sx={{ width: 40, height: 40, bgcolor: brandColors.text, borderRadius: 1, cursor: 'pointer', border: '2px solid #fff', boxShadow: 1, '&:hover': { transform: 'scale(1.1)', transition: 'transform 0.2s' } }} 
                />
              </Tooltip>
            </Box>
          </Box>
        </Box>
      )}

      {/* Manual Color Palette Dialog with AI fallback */}
      <ManualColorPalette
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        onApply={(palette) => {
          onUpdateElements([{
            id: getFirstElement().id,
            styles: {
              ...getFirstElement().styles,
              backgroundColor: palette.primary,
              color: palette.text
            }
          }]);
        }}
        tryAI={async () => {
          if (!aiPaletteDescription) {
            // If no description, just return null to use manual mode
            return null;
          }
          return await automation.generateColorPalette(aiPaletteDescription);
        }}
      />
      {/* ===== ZERO-WORK AUTOMATION TOOLBAR - END ===== */
