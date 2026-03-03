import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface DocumentationSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
  category: 'overview' | 'features' | 'architecture' | 'components' | 'api' | 'deployment' | 'support';
  level: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[]
}

interface CreatorHubNorgeDocumentationProps {
  className?: string;
  onSectionChange?: (section: DocumentationSection) => void;
  onDocumentationExport?: (data: any) => void
}

// Documentation sections
const documentationSections: DocumentationSection[] = [
  {
    id: 'overview',
    title: 'CreatorHub Norge Overview',
    description: 'Complete overview of the CreatorHub Norge platform and its capabilities',
    icon: CREATOR_HUB_ICONS.business,
    category: 'overview',
    level: 'beginner',
    estimatedTime: '5 min',
    tags: ['overview','introduction','platform'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          CreatorHub Norge - Complete Platform Documentation
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          CreatorHub Norge is a comprehensive platform designed for creative professionals in Norway, 
          providing tools for project management, client collaboration, and business growth in the 
          creative industry.
        </Typography>
        
        <Grid container spacing={3} sx={{ mt:  2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  🎯 Mission
                </Typography>
                <Typography variant="body2">
                  To empower creative professionals in Norway with cutting-edge tools and 
                  seamless collaboration features that drive business success and creative excellence.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  🌟 Vision
                </Typography>
                <Typography variant="body2">
                  To become Norway's leading platform for creative professionals, 
                  fostering innovation and collaboration in the creative industry.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Key Statistics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>500+</Typography>
              <Typography variant="body2">Active Users</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>1,200+</Typography>
              <Typography variant="body2">Projects Completed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>15+</Typography>
              <Typography variant="body2">Core Features</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>98%</Typography>
              <Typography variant="body2">User Satisfaction</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    )
},
  {
    id: 'features',
    title: 'Core Features & Capabilities',
    description: 'Detailed overview of all platform features and capabilities',
    icon: CREATOR_HUB_ICONS.star,
    category: 'features',
    level: 'beginner',
    estimatedTime: '15 min',
    tags: ['features','capabilities','functionality'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Core Features & Capabilities
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.photography sx={theming.getThemedCardSx()} />}
                title="Photography Services"
                subheader="Professional photography project management"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Complete photography workflow management including client onboarding, 
                  shoot planning, post-processing, and delivery.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Client Management" size="small" />
                  <Chip label="Shoot Planning" size="small" />
                  <Chip label="Gallery Management" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.videography sx={theming.getThemedCardSx()} />}
                title="Videography Services"
                subheader="Video production and editing workflow"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  End-to-end video production management from concept to final delivery, 
                  including storyboarding, filming, and post-production.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Storyboarding" size="small" />
                  <Chip label="Production Planning" size="small" />
                  <Chip label="Post-Production" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.music sx={theming.getThemedCardSx()} />}
                title="Music Production"
                subheader="Audio production and sound design"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Professional music production tools including recording, mixing, 
                  mastering, and collaboration features.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Recording" size="small" />
                  <Chip label="Mixing" size="small" />
                  <Chip label="Mastering" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.corporate sx={theming.getThemedCardSx()} />}
                title="Corporate Services"
                subheader="Business and corporate content creation"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Corporate content creation including presentations, marketing materials, 
                  and business documentation.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Presentations" size="small" />
                  <Chip label="Marketing" size="small" />
                  <Chip label="Documentation" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Advanced Features
        </Typography>
        
        <Accordion>
          <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI-Powered Content Enhancement</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Leverage artificial intelligence to enhance your creative content with automatic 
              color correction, noise reduction, and intelligent suggestions.
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Automatic color correction and enhancement" />
              </ListItem>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Intelligent noise reduction and sharpening" />
              </ListItem>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Smart composition suggestions" />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Real-time Collaboration</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Collaborate with clients and team members in real-time with live editing, 
              comments, and instant feedback.
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Live editing and real-time updates" />
              </ListItem>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Comment system with threaded discussions" />
              </ListItem>
              <ListItem>
                <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
                <ListItemText primary="Version control and change tracking" />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>
      </Box>
    )
},
  {
    id: 'architecture',
    title: 'System Architecture',
    description: 'Technical architecture and system design overview',
    icon: CREATOR_HUB_ICONS.architecture,
    category: 'architecture',
    level: 'advanced',
    estimatedTime: '20 min',
    tags: ['architecture','technical','system-design'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          System Architecture
        </Typography>
        
        <Typography variant="h5" sx={{ mt:  3, mb:  2, color: theming.colors.primary }}>
          Technology Stack
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader title="Frontend" sx={theming.getThemedCardSx()} />
              <CardContent sx={theming.getThemedCardSx()}>
                <List>
                  <ListItem>
                    <ListItemText primary="React 18" secondary="UI Framework" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="TypeScript" secondary="Type Safety" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Material-UI" secondary="Component Library" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Redux Toolkit" secondary="State Management" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader title="Backend" sx={theming.getThemedCardSx()} />
              <CardContent sx={theming.getThemedCardSx()}>
                <List>
                  <ListItem>
                    <ListItemText primary="Node.js" secondary="Runtime Environment" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Express.js" secondary="Web Framework" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="PostgreSQL" secondary="Database" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Redis" secondary="Caching" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader title="Infrastructure" sx={theming.getThemedCardSx()} />
              <CardContent sx={theming.getThemedCardSx()}>
                <List>
                  <ListItem>
                    <ListItemText primary="AWS" secondary="Cloud Platform" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Docker" secondary="Containerization" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Kubernetes" secondary="Orchestration" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="CDN" secondary="Content Delivery" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          System Components
        </Typography>
        
        <Timeline>
          <TimelineItem>
            <TimelineOppositeContent>
              <Typography variant="body2" color="text.secondary">
                Client Layer
              </Typography>
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color="primary" />
              <TimelineConnector />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Web Application</Typography>
              <Typography variant="body2">
                React-based frontend with Material-UI components and responsive design
              </Typography>
            </TimelineContent>
          </TimelineItem>
          
          <TimelineItem>
            <TimelineOppositeContent>
              <Typography variant="body2" color="text.secondary">
                API Layer
              </Typography>
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color="primary" />
              <TimelineConnector />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>REST API</Typography>
              <Typography variant="body2">
                Express.js API with authentication, validation, and business logic
              </Typography>
            </TimelineContent>
          </TimelineItem>
          
          <TimelineItem>
            <TimelineOppositeContent>
              <Typography variant="body2" color="text.secondary">
                Data Layer
              </Typography>
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot color="primary" />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Database</Typography>
              <Typography variant="body2">
                PostgreSQL with Redis caching for optimal performance
              </Typography>
            </TimelineContent>
          </TimelineItem>
        </Timeline>
      </Box>
    )
},
  {
    id: 'components',
    title: 'Component Library',
    description: 'Reusable components and their usage',
    icon: CREATOR_HUB_ICONS.code,
    category: 'components',
    level: 'intermediate',
    estimatedTime: '25 min',
    tags: ['components','ui','reusable'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Component Library
        </Typography>
        
        <Typography variant="h5" sx={{ mt:  3, mb:  2, color: theming.colors.primary }}>
          Core Components
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  CreatorHubIcons
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Comprehensive icon system with 28+ custom icons and Material-UI integration.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="28 Custom Icons" size="small" />
                  <Chip label="Material-UI" size="small" />
                  <Chip label="TypeScript" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Interactive Documentation
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Advanced documentation system with real-time collaboration and AI integration.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Real-time" size="small" />
                  <Chip label="AI Integration" size="small" />
                  <Chip label="Collaboration" size="small" />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Usage Examples
        </Typography>
        
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Basic Icon Usage
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            backgroundColor: 'grey.10', 
            p: 2, borderRadius:  1,
            overflow: 'auto'
      }}>
{`import { CREATOR_HUB_ICONS } from './shared/CreatorHubIcons';

// Use custom icons
<CREATOR_HUB_ICONS.photography />
<CREATOR_HUB_ICONS.videography />
<CREATOR_HUB_ICONS.music />`}
          </Typography>
        </Paper>

        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Component Integration
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            backgroundColor: 'grey.10', 
            p: 2, borderRadius:  1,
            overflow: 'auto'
      }}>
{`import CreatorHubNotes from './components/notes/CreatorHubNotes';

function App() {
  return (
    <div className="App">
      <CreatorHubNotes />
    </div>
  );
}`}
          </Typography>
        </Paper>
      </Box>
    )
},
  {
    id: 'api',
    title: 'API Documentation',
    description: 'REST API endpoints and integration guide',
    icon: CREATOR_HUB_ICONS.api,
    category: 'api',
    level: 'intermediate',
    estimatedTime: '30 min',
    tags: ['api','rest','integration'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          API Documentation
        </Typography>
        
        <Typography variant="h5" sx={{ mt:  3, mb:  2, color: theming.colors.primary }}>
          Authentication
        </Typography>
        <Alert severity="info" sx={{ mb:  2 }}>
          All API endpoints require authentication using Bearer tokens.
        </Alert>
        
        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Core Endpoints
        </Typography>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Method</TableCell>
                <TableCell>Endpoint</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Auth Required</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Chip label="GET" color="success" size="small" />
                </TableCell>
                <TableCell>/api/projects</TableCell>
                <TableCell>Get all projects</TableCell>
                <TableCell>Yes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Chip label="POST" color="primary" size="small" />
                </TableCell>
                <TableCell>/api/projects</TableCell>
                <TableCell>Create new project</TableCell>
                <TableCell>Yes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Chip label="PUT" color="warning" size="small" />
                </TableCell>
                <TableCell>/api/projects/:id</TableCell>
                <TableCell>Update project</TableCell>
                <TableCell>Yes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Chip label="DELETE" color="error" size="small" />
                </TableCell>
                <TableCell>/api/projects/:id</TableCell>
                <TableCell>Delete project</TableCell>
                <TableCell>Yes</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Example Requests
        </Typography>
        
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Create Project
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            backgroundColor: 'grey.10', 
            p: 2, borderRadius:  1,
            overflow: 'auto'
      }}>
{`POST /api/projects
Content-Type: application/json
Authorization: Bearer <token>

{
  "name":"Wedding Photography", "type":"photography","client":"John & Jane Doe","startDate":"2024-06-15","endDate" : "2024-06-15"
}`}
          </Typography>
        </Paper>
      </Box>
    )
},
  {
    id: 'deployment',
    title: 'Deployment Guide',
    description: 'Production deployment and configuration',
    icon: CREATOR_HUB_ICONS.cloudUpload,
    category: 'deployment',
    level: 'advanced',
    estimatedTime: '45 min',
    tags: ['deployment','production','configuration'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Deployment Guide
        </Typography>
        
        <Typography variant="h5" sx={{ mt:  3, mb:  2, color: theming.colors.primary }}>
          Prerequisites
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
            <ListItemText primary="Node.js 18+ and npm" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
            <ListItemText primary="PostgreSQL 14+" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
            <ListItemText primary="Redis 6+" />
          </ListItem>
          <ListItem>
            <ListItemIcon><CREATOR_HUB_ICONS.checkCircle /></ListItemIcon>
            <ListItemText primary="Docker and Docker Compose" />
          </ListItem>
        </List>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Environment Setup
        </Typography>
        
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Environment Variables
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            backgroundColor: 'grey.10', 
            p: 2, borderRadius:  1,
            overflow: 'auto'
      }}>
{`# Database
DATABASE_URL=postgresql: //user:password@localhost:5432/creatorhub
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# AWS Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-north-1
AWS_S3_BUCKET=creatorhub-storage

# Application
NODE_ENV=production
PORT=3000
CLIENT_URL=https://creatorhub.no`}
          </Typography>
        </Paper>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Docker Deployment
        </Typography>
        
        <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            docker-compose.yml
          </Typography>
          <Typography variant="body2" component="pre" sx={{ 
            backgroundColor: 'grey.10', 
            p: 2, borderRadius:  1,
            overflow: 'auto'
      }}>
{`version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: creatorhub
      POSTGRES_USER: creatorhub
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data, :, `}
          </Typography>
        </Paper>
      </Box>
    )
},
  {
    id: 'support',
    title: 'Support & Resources',
    description: 'Support resources and community guidelines',
    icon: CREATOR_HUB_ICONS.support,
    category: 'support',
    level: 'beginner',
    estimatedTime: '10 min',
    tags: ['support','help','resources'],
    content: (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Support & Resources
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.email sx={theming.getThemedCardSx()} />}
                title="Email Support"
                subheader="Direct support via email"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Get direct support from our technical team for any issues or questions.
                </Typography>
                <Button variant="contained" startIcon={<CREATOR_HUB_ICONS.email sx={theming.getThemedButtonSx()} />}>
                  support@creatorhub.no
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.documentation sx={theming.getThemedCardSx()} />}
                title="Documentation"
                subheader="Comprehensive guides and tutorials"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Access our complete documentation with guides, tutorials, and API references.
                </Typography>
                <Button variant="outlined" startIcon={<CREATOR_HUB_ICONS.documentation />}>
                  View Documentation
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.community sx={theming.getThemedCardSx()} />}
                title="Community Forum"
                subheader="Connect with other users"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Join our community forum to connect with other creators and share experiences.
                </Typography>
                <Button variant="outlined" startIcon={<CREATOR_HUB_ICONS.community />}>
                  Join Community
                </Button>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardHeader
                avatar={<CREATOR_HUB_ICONS.video sx={theming.getThemedCardSx()} />}
                title="Video Tutorials"
                subheader="Step-by-step video guides"
              />
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Watch our video tutorials to learn how to use CreatorHub Norge effectively.
                </Typography>
                <Button variant="outlined" startIcon={<CREATOR_HUB_ICONS.video />}>
                  Watch Tutorials
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" sx={{ mt:  4, mb:  2, color: theming.colors.primary }}>
          Frequently Asked Questions
        </Typography>
        
        <Accordion>
          <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>How do I get started with CreatorHub Norge?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2">
              Getting started is easy! Simply sign up for an account, complete your profile, 
              and start creating your first project. We recommend starting with our onboarding 
              tutorial to familiarize yourself with the platform.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>What types of projects can I manage?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2">
              CreatorHub Norge supports various creative projects including photography, 
              videography, music production, and corporate content creation. Each project 
              type comes with specialized tools and workflows.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Is there a mobile app available?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2">
              Yes! CreatorHub Norge is fully responsive and works seamlessly on mobile devices. 
              We also offer native mobile apps for iOS and Android for the best mobile experience.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Box>
    )
}
];

const CreatorHubNorgeDocumentation: React.FC<CreatorHubNorgeDocumentationProps> = ({
  className ='',
  onSectionChange,
  onDocumentationExport
}) => {
  // State
  const [activeSection, setActiveSection] = useState<DocumentationSection | null>(null);
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [searchQuery, setSearchQuery] = useState(', ');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Handlers
  const handleSectionSelect = useCallback((section: DocumentationSection) => {
    setActiveSection(section);
    onSectionChange?.(section);
}, [onSectionChange]);

  const handleDocumentationExport = useCallback(() => {
    const exportData = {
      sections: documentationSections,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
};
    onDocumentationExport?.(exportData);
}, [onDocumentationExport]);

  // Filtered sections
  const filteredSections = useMemo(() => {
    return documentationSections.filter(section => {
      const matchesSearch = section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           section.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           section.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;
      const matchesLevel = selectedLevel === 'all' || section.level === selectedLevel;
      
      return matchesSearch && matchesCategory && matchesLevel;
  });
}, [searchQuery, selectedCategory, selectedLevel]);

  // Statistics
  const stats = useMemo(() => {
    return {
      totalSections: documentationSections.length,
      totalEstimatedTime: documentationSections.reduce((total, section) => {
        const time = parseInt(section.estimatedTime);
        return total + (isNaN(time) ? 0 : time);
    }, 0),
      categories: [...new Set(documentationSections.map(s => s.category), ), ],
      levels: [...new Set(documentationSections.map(s => s.level))]
};
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.business sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>CreatorHub Norge Documentation</Typography>
              <Typography variant="body2" color="text.secondary">
                Complete platform documentation and guides
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={handleDocumentationExport}
            >
              Export Documentation
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.documentation sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.totalSections}</Typography>
                  <Typography variant="body2" color="text.secondary">Documentation Sections</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.timer sx={{ fontSize:  40, color: 'secondary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.totalEstimatedTime}min</Typography>
                  <Typography variant="body2" color="text.secondary">Total Reading Time</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.category sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.categories.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Categories</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.level sx={{ fontSize:  40, color: 'info.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.levels.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Difficulty Levels</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 200}}
          />
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {stats.categories.map(category => (
                <MenuItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Level</InputLabel>
            <Select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <MenuItem value="all">All Levels</MenuItem>
              {stats.levels.map(level => (
                <MenuItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Documentation Sections
            </Typography>
            <List>
              {filteredSections.map((section) => (
                <ListItem 
                  key={section.id}
                  button
                  selected={activeSection?.id === section.id}
                  onClick={() => handleSectionSelect(section)}
                >
                  <ListItemIcon>
                    <section.icon />
                  </ListItemIcon>
                  <ListItemText
                    primary={section.title}
                    secondary={
                      <Stack direction="row" spacing={1} sx={{ mt:  1 }}>
                        <Chip label={section.level} size="small" color="primary" />
                        <Chip label={section.estimatedTime} size="small" variant="outlined" />
                      </Stack>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Content */}
        <Grid item xs={12} md={8}>
          {activeSection ? (
            <Paper elevation={1} sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Breadcrumbs sx={{ mb:  2 }}>
                <Link color="inherit" href="#">
                  CreatorHub Norge
                </Link>
                <Link color="inherit" href="#">
                  Documentation
                </Link>
                <Typography color="text.primary">
                  {activeSection.title}
                </Typography>
              </Breadcrumbs>
              
              <Stack direction="row" spacing={1} sx={{ mb:  3 }}>
                <Chip label={activeSection.category} color="primary" />
                <Chip label={activeSection.level} color="secondary" />
                <Chip label={activeSection.estimatedTime} variant="outlined" />
                {activeSection.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>
              
              {activeSection.content}
            </Paper>
          ) : (
            <Paper elevation={1} sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <CREATOR_HUB_ICONS.documentation sx={{ fontSize:  64, color: 'primary.main', mb:  2 }} />
              <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                Welcome to CreatorHub Norge Documentation
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Select a documentation section from the sidebar to explore comprehensive guides, 
                tutorials, and technical documentation for the CreatorHub Norge platform.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default CreatorHubNorgeDocumentation;
