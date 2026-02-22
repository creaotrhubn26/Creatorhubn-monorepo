/**
 * SVG Components Showcase
 * Demonstrates all SVG rendering capabilities in CreatorHub
 * Including progress rings, achievement badges, and flowchart utilities
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Stack,
  Divider,
  Paper,
} from '@mui/material';
import {
  EmojiEvents,
  Star,
  WorkspacePremium,
  Grade,
  LocalFireDepartment,
  School,
} from '@mui/icons-material';
import ProgressRing from './ProgressRing';
import AchievementBadge from './AchievementBadge';
import { flowchartUtils } from '@/utils/svg-render';

const SVGShowcase: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        SVG Components Showcase
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Demonstration of all SVG rendering utilities and components available in CreatorHub
      </Typography>

      <Stack spacing={4}>
        {/* Progress Rings Section */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Progress Rings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Circular progress indicators with customizable size, color, and labels
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <ProgressRing
                    percentage={75}
                    radius={50}
                    strokeWidth={8}
                    color="#4caf50"
                    showLabel={true}
                  />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Course Progress
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <ProgressRing
                    percentage={45}
                    radius={50}
                    strokeWidth={8}
                    color="#ff9800"
                    showLabel={true}
                  />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Storage Usage
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <ProgressRing
                    percentage={92}
                    radius={50}
                    strokeWidth={8}
                    color="#f44336"
                    showLabel={true}
                  />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    High Usage
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <ProgressRing
                    percentage={25}
                    radius={50}
                    strokeWidth={8}
                    color="#2196f3"
                    showLabel={true}
                    customLabel="¼"
                  />
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    Custom Label
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Different Sizes
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mt: 2 }}>
              <ProgressRing
                percentage={60}
                radius={20}
                strokeWidth={3}
                color="#9c27b0"
                showLabel={false}
              />
              <ProgressRing
                percentage={60}
                radius={30}
                strokeWidth={4}
                color="#9c27b0"
                showLabel={false}
              />
              <ProgressRing
                percentage={60}
                radius={40}
                strokeWidth={6}
                color="#9c27b0"
                showLabel={true}
              />
              <ProgressRing
                percentage={60}
                radius={60}
                strokeWidth={8}
                color="#9c27b0"
                showLabel={true}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Achievement Badges Section */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Achievement Badges
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              SVG-based badges with gradients, animations, and multiple variants
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#FFD700"
                    secondaryColor="#FFA500"
                    icon={<EmojiEvents />}
                    label="Mester"
                    tooltip="Fullført 100 kurs"
                    variant="star"
                    animated={true}
                    glow={0.8}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#C0C0C0"
                    secondaryColor="#808080"
                    icon={<Star />}
                    label="Ekspert"
                    tooltip="Fullført 50 kurs"
                    variant="star"
                    animated={true}
                    glow={0.5}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#CD7F32"
                    secondaryColor="#8B4513"
                    icon={<Grade />}
                    label="Nybegynner"
                    tooltip="Fullført 10 kurs"
                    variant="star"
                    animated={true}
                    glow={0.3}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#4caf50"
                    secondaryColor="#2e7d32"
                    icon={<School />}
                    label="Lærer"
                    tooltip="Opprettet 5 kurs"
                    variant="circle"
                    animated={true}
                    glow={0.6}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#f44336"
                    secondaryColor="#c62828"
                    icon={<LocalFireDepartment />}
                    label="På fyr"
                    tooltip="7 dagers streak"
                    variant="shield"
                    animated={true}
                    glow={0.9}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <AchievementBadge
                    size={80}
                    color="#9e9e9e"
                    secondaryColor="#616161"
                    icon={<WorkspacePremium />}
                    label="Låst"
                    tooltip="Fullført 200 kurs for å låse opp"
                    variant="star"
                    locked={true}
                    animated={false}
                    glow={0}
                  />
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Flowchart Elements Section */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Flowchart Elements
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Nodes, connections, and workflow diagram utilities
            </Typography>

            <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <svg width="100%" height="300" viewBox="0 0 800 300">
                {/* Simple workflow: Start → Process → Decision → End */}

                {/* Start node */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createNode(50, 120, 100, 60 'Start','#4caf50')}} />

                {/* Connection arrow */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createConnection(150, 150, 220, 150'#666')}} />

                {/* Process node */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createNode(220, 120, 120, 60'Process','#2196f3')}} />

                {/* Curved connection */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createCurvedConnection(340, 150, 450, 150'#666')}} />

                {/* Decision node */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createNode(450, 120, 120, 60'Decision','#ff9800')}} />

                {/* Fork paths */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createConnection(570, 135, 650, 80'#666')}} />
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createConnection(570, 165, 650, 220'#666')}} />

                {/* Success path */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createNode(650, 50, 100, 60'Success','#4caf50')}} />

                {/* Error path */}
                <g
                  dangerouslySetInnerHTML={{
                    __html: flowchartUtils.createNode(650, 190, 100, 60'Error','#f44336')}} />

                {/* Labels */}
                <text x="600" y="125" fontSize="12" fill="#666">
                  Yes
                </text>
                <text x="600" y="175" fontSize="12" fill="#666">
                  No
                </text>
              </svg>
            </Paper>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Use <code>flowchartUtils.createNode()</code> and{''}
              <code>flowchartUtils.createConnection()</code> to build custom workflow diagrams.
            </Typography>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card sx={{ bgcolor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Usage Examples
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Progress Ring
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'white' }}>
                  <code style={{ fontSize: '0.85rem' }}>
                    {`<ProgressRing
  percentage={75}
  radius={50}
  strokeWidth={8}
  color="#4caf50"
  showLabel={true}
/>`}
                  </code>
                </Paper>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Achievement Badge
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'white' }}>
                  <code style={{ fontSize: '0.85rem' }}>
                    {`<AchievementBadge
  size={80}
  color="#FFD700"
  secondaryColor="#FFA500"
  icon={<EmojiEvents />}
  label="Mester"
  tooltip="Fullført 100 kurs"
  variant="star"
  animated={true}
  glow={0.8}
/>`}
                  </code>
                </Paper>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Flowchart Node
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'white' }}>
                  <code style={{ fontSize: '0.85rem' }}>
                    {`import { flowchartUtils } from'@/utils/svg-render';

<svg width={600} height={400}>
  <g dangerouslySetInnerHTML={{
    __html: flowchartUtils.createNode(50, 50, 120, 60'Start','#4caf50')
  }} />
</svg>`}
                  </code>
                </Paper>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};

export default SVGShowcase;
