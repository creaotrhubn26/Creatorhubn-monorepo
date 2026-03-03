// Placeholder for AIAssistanceDashboard.tsx
// This component will provide a comprehensive interface for AI assistance features.
// It will display AI suggestions, conversations, code generation, and intelligent recommendations.

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Avatar,
  InputAdornment,
  Fab,
  ChipProps,
} from '@mui/material';
import {
  Psychology,
  Chat,
  Code,
  Accessibility,
  Palette,
  Lightbulb,
  Refresh,
  Download,
  Upload,
  Send,
  Add,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Warning,
  Info,
  Search,
  SmartToy,
  AutoFixHigh,
  Insights,
} from '@mui/icons-material';
import { useAIAssistant } from '../../../hooks/useAIAssistant';
import type { AISuggestionStatus } from '../../../utils/aiAssistant';

interface AIAssistanceDashboardProps {
  onSettingsClick: () => void;
  onSuggestionsClick: () => void;
  onConversationsClick: () => void;
  onCodeGenerationClick: () => void;
  onDesignSuggestionsClick: () => void;
  onWorkflowsClick: () => void; 
}

const AIAssistanceDashboard: React.FC<AIAssistanceDashboardProps> = ({
  onSettingsClick,
  onSuggestionsClick,
  onConversationsClick,
  onCodeGenerationClick,
  onDesignSuggestionsClick,
  onWorkflowsClick
}) => {
  const [activeTab, setActiveTab] = useState(0);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [codePrompt, setCodePrompt] = useState('');
  const [showCodeGenerationDialog, setShowCodeGenerationDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' | 'info',});
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    suggestions,
    conversations,
    codeGenerations,
    designSuggestions,
    workflows,
    isLoading,
    error,
    generateSuggestions,
    updateSuggestionStatus,
    createConversation,
    getConversation,
    addMessage,
    generateAIResponse,
    generateCode,
    generateDesignSuggestions,
    refreshData,
    exportData,
    importData
} = useAIAssistant();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      // Add user message
      addMessage(selectedConversation, 'user', newMessage);
      
      // Generate AI response
      await generateAIResponse(selectedConversation, newMessage);
      
      setNewMessage('');
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to send message', severity: 'error',});
  }
};

  const handleCreateConversation = () => {
    try {
      const conversation = createConversation('New Conversation', {
        projectId: 'current-project',
        currentView: 'ai-assistance'
  });
      setSelectedConversation(conversation.id);
      setSnackbar({ open: true, message: 'New conversation created', severity: 'success',});
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to create conversation', severity: 'error',});
  }
};

  const handleGenerateCode = () => {
    if (!codePrompt.trim()) return;

    try {
      generateCode(codePrompt, {
        projectType: 'react',
        framework: 'material-ui',
        language: 'typescript',
        requirements: ['responsive','accessible']
    });
      setSnackbar({ open: true, message: 'Code generated successfully', severity: 'success',});
      setShowCodeGenerationDialog(false);
      setCodePrompt('');
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate code', severity: 'error',});
  }
};

  const handleUpdateSuggestionStatus = (id: string, status: AISuggestionStatus) => {
    try {
      updateSuggestionStatus(id, status);
      setSnackbar({ open: true, message: 'Suggestion status updated', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to update suggestion status', severity: 'error' });
  }
};

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json',});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistance-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importData(data);
        setSnackbar({ open: true, message: 'Data imported successfully', severity: 'success',});
    } catch (err) {
        setSnackbar({ open: true, message: 'Failed to import data', severity: 'error',});
    }
  };
    reader.readAsText(file);
};

  const getPriorityColor = (priority: string): ChipProps['color'] => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
}
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'design': return <Palette />;
      case 'code': return <Code />;
      case 'performance': return theming.getThemedIcon('speed');
      case 'accessibility': return <Accessibility />;
      case 'seo': return theming.getThemedIcon('search');
      default: return <Lightbulb />;
}
};

  const currentConversation = selectedConversation ? getConversation(selectedConversation) : null;

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" component="h1" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <Psychology color="primary" />
          AI Assistance Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={refreshData}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('download')}
            onClick={handleExportData}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('upload')}
            component="label"
          >
            Import
            <input
              type="file"
              hidden
              accept=".json"
              onChange={handleImportData}
            />
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && !errorDismissed && (
        <Alert severity="error" sx={{ mb:  2 }} onClose={() => setErrorDismissed(true)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Suggestions" />
          <Tab label="Conversations" />
          <Tab label="Code Generation" />
          <Tab label="Design Suggestions" />
          <Tab label="Workflows" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  AI Suggestions
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {suggestions.length}
                </Typography>
                <Typography color="textSecondary">
                  {suggestions.filter(s => s.status === 'new').length} new
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Conversations
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {conversations.length}
                </Typography>
                <Typography color="textSecondary">
                  {conversations.filter(c => c.messages.length > 0).length} active
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Code Generated
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {codeGenerations.length}
                </Typography>
                <Typography color="textSecondary">
                  Last 30 days
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Design Suggestions
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {designSuggestions.length}
                </Typography>
                <Typography color="textSecondary">
                  Available
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Suggestions */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Recent Suggestions
                </Typography>
                <List dense>
                  {suggestions.slice(0, 5).map((suggestion) => (
                    <ListItem key={suggestion.id}>
                      <ListItemIcon>
                        {getTypeIcon(suggestion.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={suggestion.title}
                        secondary={suggestion.description}
                      />
                      <Chip
                        label={suggestion.priority}
                        size="small"
                        color={getPriorityColor(suggestion.priority)}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Conversations */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Recent Conversations
                </Typography>
                <List dense>
                  {conversations.slice(0, 5).map((conversation) => (
                    <ListItem key={conversation.id} disablePadding>
                      <ListItemButton onClick={() => setSelectedConversation(conversation.id)}>
                        <ListItemIcon>
                          {theming.getThemedIcon('chat')}
                        </ListItemIcon>
                        <ListItemText
                          primary={conversation.title}
                          secondary={`${conversation.messages.length} messages`}
                        />
                        <Badge
                          badgeContent={conversation.messages.filter(m => m.role === 'user').length}
                          color="primary"
                        >
                          {theming.getThemedIcon('smartToy')}
                        </Badge>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Suggestions Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  AI Suggestions
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Title</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {suggestions.map((suggestion) => (
                        <TableRow key={suggestion.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              {getTypeIcon(suggestion.type)}
                              <Typography variant="body2">{suggestion.type}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle2">{suggestion.title}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              {suggestion.description}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={suggestion.priority}
                              size="small"
                              color={getPriorityColor(suggestion.priority)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Typography variant="body2">
                                {(suggestion.confidence * 100).toFixed(0)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={suggestion.confidence * 100}
                                sx={{ width: 60}}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={suggestion.status}
                              size="small"
                              color={suggestion.status === 'implemented' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={suggestion.status}
                              onChange={(e) => handleUpdateSuggestionStatus(suggestion.id, e.target.value as AISuggestionStatus)}
                              size="small"
                              sx={{ minWidth: 120}}
                            >
                              <MenuItem value="new">New</MenuItem>
                              <MenuItem value="reviewed">Reviewed</MenuItem>
                              <MenuItem value="accepted">Accepted</MenuItem>
                              <MenuItem value="rejected">Rejected</MenuItem>
                              <MenuItem value="implemented">Implemented</MenuItem>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Conversations Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Conversations</Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={handleCreateConversation}
                    sx={theming.getThemedButtonSx()}
                  >
                    New Chat
                  </Button>
                </Box>
                <List>
                  {conversations.map((conversation) => (
                    <ListItem key={conversation.id} disablePadding>
                      <ListItemButton
                        selected={selectedConversation === conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                      >
                        <ListItemIcon>
                          {theming.getThemedIcon('chat')}
                        </ListItemIcon>
                        <ListItemText
                          primary={conversation.title}
                          secondary={`${conversation.messages.length} messages`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={8}>
            <Card sx={{ ...theming.getThemedCardSx(), height: 600, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ ...theming.getThemedCardSx(), flex: 1, overflow: 'auto' }}>
                {currentConversation ? (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {currentConversation.title}
                    </Typography>
                    <List>
                      {currentConversation.messages.map((message) => (
                        <ListItem key={message.id} alignItems="flex-start">
                          <ListItemIcon>
                            <Avatar sx={{ width:  32, height: 32}}>
                              {message.role === 'user' ? 'U' : theming.getThemedIcon('smartToy')}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box>
                                <Typography variant="body1">{message.content}</Typography>
                                {message.metadata?.suggestions && (
                                  <Box sx={{ mt:  1 }}>
                                    {(message.metadata.suggestions as Array<{ title?: string }>).map((suggestion, index) => (
                                      <Chip
                                        key={index}
                                        label={suggestion.title ?? `Suggestion ${index + 1}`}
                                        size="small"
                                        sx={{ mr: 1, mb: 1 }}
                                      />
                                    ))}
                                  </Box>
                                )}
                              </Box>
                          }
                            secondary={new Date(message.createdAt).toLocaleTimeString()}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <Chat sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
                    <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
                      Select a conversation to start chatting
                    </Typography>
                  </Box>
                )}
              </CardContent>
              {currentConversation && (
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <TextField
                      fullWidth
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                      }
                    }}
                    />
                    <Button variant="contained"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                     sx={theming.getThemedButtonSx()}>
                      <Send />
                    </Button>
                  </Box>
                </Box>
              )}
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Code Generation Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Code Generation</Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={() => setShowCodeGenerationDialog(true)}
                    sx={theming.getThemedButtonSx()}
                  >
                    Generate Code
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Prompt</TableCell>
                        <TableCell>Framework</TableCell>
                        <TableCell>Quality Score</TableCell>
                        <TableCell>Generated</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {codeGenerations.map((generation) => (
                        <TableRow key={generation.id}>
                          <TableCell>
                            <Typography variant="body2" noWrap>
                              {generation.prompt.substring(0, 50)}...
                            </Typography>
                          </TableCell>
                          <TableCell>{generation.context.framework}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Typography variant="body2">
                                {(generation.quality.score * 100).toFixed(0)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={generation.quality.score * 100}
                                sx={{ width: 60}}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            {new Date(generation.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="View Code">
                              <IconButton size="small">
                                <Code />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Copy Code">
                              <IconButton size="small">
                                {theming.getThemedIcon('download')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Design Suggestions Tab */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Design Suggestions
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Element</TableCell>
                        <TableCell>Suggestions</TableCell>
                        <TableCell>Alternatives</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {designSuggestions.map((suggestion) => (
                        <TableRow key={suggestion.id}>
                          <TableCell>{suggestion.elementId}</TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {suggestion.suggestions.length} suggestions
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {suggestion.alternatives.length} alternatives
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {new Date(suggestion.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                {theming.getThemedIcon('palette')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Apply Changes">
                              <IconButton size="small" color="primary">
                                {theming.getThemedIcon('autoFixHigh')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Workflows Tab */}
      {activeTab === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  AI Workflows
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {workflows.length} active workflows
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Steps</TableCell>
                        <TableCell>Triggers</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {workflows.map((workflow) => (
                        <TableRow key={workflow.id}>
                          <TableCell>{workflow.name}</TableCell>
                          <TableCell>{workflow.description}</TableCell>
                          <TableCell>{workflow.steps.length}</TableCell>
                          <TableCell>{workflow.triggers.length}</TableCell>
                          <TableCell>
                            <Chip
                              label={workflow.isActive ? 'Active' : 'Inactive'}
                              color={workflow.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit Workflow">
                              <IconButton size="small">
                                {theming.getThemedIcon('edit')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Workflow">
                              <IconButton size="small" color="error">
                                {theming.getThemedIcon('delete')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Code Generation Dialog */}
      <Dialog open={showCodeGenerationDialog} onClose={() => setShowCodeGenerationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate Code</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Describe what you want to generate"
            value={codePrompt}
            onChange={(e) => setCodePrompt(e.target.value)}
            sx={{ mt:  2 }}
            placeholder="e.g., Create a responsive button component with hover effects..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCodeGenerationDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerateCode} variant="contained" sx={theming.getThemedButtonSx()}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AIAssistanceDashboard;
