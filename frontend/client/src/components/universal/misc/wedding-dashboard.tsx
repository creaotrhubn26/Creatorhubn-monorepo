// @ts-nocheck
import { useTheming } from '../../../utils/theming-helper';
import React from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  Typography,
  Box,
} from '@mui/material';
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge, Button, LinearProgress as Progress } from '@mui/material';
import { Link } from "wouter";
import {
  Event,
  Favorite,
  Group,
  LocationOn,
  Schedule,
  Warning,
  AutoAwesome,
  Flag as Target,
  NotificationsActive,
  CardGiftcard,
  PhotoCamera,
  Palette,
  SettingsOutlined,
  CheckCircle,
} from '@mui/icons-material';

interface WeddingDashboardProps { 
  weddingId?: number; 
}

export default function WeddingDashboard({ weddingId }: WeddingDashboardProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds:  0 });
  
  // Wedding data loaded from API
  const wedding = { 
    date: "2025-08-1",
    venue: "Grand Oak Mansion",
    guestCount: 10,
    culture: "Norwegian",
    season: "Summer",
    location: "Oslo, Norway" 
};

  // Mock data for tasks
  const tasks = [
    { id: 1, title: "Book venue", completed: true, dueDate: "2024-12-0", priority: "high",},
    { id: 2, title: "Choose photographer", completed: false, dueDate: "2025-01-1", priority: "medium",},
    { id:  3, title: "Order invitations", completed: false, dueDate: "2025-02-0", priority: "high",}
  ];

  // Mock data for expert suggestions
  const expertSuggestions = [
    { title: "Norwegian Wedding Traditions", description: "Consider incorporating traditional Norwegian elements", priority: "medium",},
    { title: "Summer Photography Tips", description: "Best lighting conditions for summer weddings", priority: "high",}
  ];

  // Calculate countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const weddingDate = new Date(wedding.date).getTime();
      const distance = weddingDate - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setCountdown({ days, hours, minutes, seconds });
  }, 1000);
    return () => clearInterval(timer);
}, [wedding.date]);

  const completedTasks = tasks.filter(task => task.completed).length;
  const completionPercentage = (completedTasks / tasks.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="flex flex-col items-center justify-center min-h-screen">
        {/* Header */}
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                Wedding Dashboard
              </h1>
              <p className="text-gray-600">
                {wedding.venue} • {new Date(wedding.date).toLocaleDateString()}
              </p>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <NotificationsActive className="w-5 h-5 mr-2" />
              Notifications
            </Button>
          </div>
        </div>

        {/* Countdown Timer */}
        <MuiCard className="mb-8 bg-gradient-to-r from-amber-600 to-orange-600 text-gray-800 dark: text-white">
          <CardContent className="p-8" sx={theming.getThemedCardSx()}>
            <div className="flex flex-col items-center justify-center min-h-screen">
              <h2 className="text-2xl font-bold mb-6">Countdown to Your Big Day</h2>
              <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">{countdown.days}</div>
                  <div className="flex flex-col items-center justify-center min-h-screen">Days</div>
                </div>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">{countdown.hours}</div>
                  <div className="flex flex-col items-center justify-center min-h-screen">Hours</div>
                </div>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">{countdown.minutes}</div>
                  <div className="flex flex-col items-center justify-center min-h-screen">Minutes</div>
                </div>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">{countdown.seconds}</div>
                  <div className="flex flex-col items-center justify-center min-h-screen">Seconds</div>
                </div>
              </div>
            </div>
          </CardContent>
        </MuiCard>

        <div className="flex flex-col items-center justify-center min-h-screen">
          {/* Progress Overview */}
          <MuiCard className="lg:col-span-2">
            <CardHeader sx={theming.getThemedCardSx()}>
              <Typography className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                Planning Progress
              </Typography>
            </CardHeader>
            <CardContent sx={theming.getThemedCardSx()}>
              <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <span className="text-sm font-medium">Overall Completion</span>
                  <span className="text-2xl font-bold text-amber-600">{completionPercentage.toFixed(0)}%</span>
                </div>
                <Progress value={completionPercentage} className="h-5" />
              </div>
              <div className="flex flex-col items-center justify-center min-h-screen">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gradient-to-br from-amber-50/30 to-orange-50/20 backdrop-blur-lg rounded-lg">
                    <div className="flex flex-col items-center justify-center min-h-screen">
                      {task.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Schedule className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                        <p className="text-sm text-gray-500">Due: {task.dueDate}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </MuiCard>

          {/* Quick Stats */}
          <div className="flex flex-col items-center justify-center min-h-screen">
            <MuiCard>
              <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">
                    <Group className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{wedding.guestCount}</p>
                    <p className="text-sm text-gray-600">Guests</p>
                  </div>
                </div>
              </CardContent>
            </MuiCard>
            <MuiCard>
              <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">
                    <LocationOn className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{wedding.venue}</p>
                    <p className="text-sm text-gray-600">{wedding.location}</p>
                  </div>
                </div>
              </CardContent>
            </MuiCard>
            <MuiCard>
              <CardContent className="p-4" sx={theming.getThemedCardSx()}>
                <div className="flex flex-col items-center justify-center min-h-screen">
                  <div className="flex flex-col items-center justify-center min-h-screen">
                    <Favorite className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{wedding.culture}</p>
                    <p className="text-sm text-gray-600">{wedding.season} Wedding</p>
                  </div>
                </div>
              </CardContent>
            </MuiCard>
          </div>
        </div>

        {/* Expert Recommendations */}
        <MuiCard className="mb-8">
          <CardHeader sx={theming.getThemedCardSx()}>
            <Typography className="flex items-center gap-2">
              <AutoAwesome className="w-5 h-5 text-amber-600" />
              Ekspert Anbefalinger
            </Typography>
          </CardHeader>
          <CardContent sx={theming.getThemedCardSx()}>
            <div className="flex flex-col items-center justify-center min-h-screen">
              {expertSuggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border rounded-lg hover: shadow-md transition-shadow">
                  <div className="flex flex-col items-center justify-center min-h-screen">
                    <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                    <Badge variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'default' : 'secondary'} className="text-sm">
                      {suggestion.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                  <Button size="small" variant="outlined" className="w-full">
                    Bruk Anbefaling
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </MuiCard>

        {/* Quick Actions */}
        <MuiCard>
          <CardHeader sx={theming.getThemedCardSx()}>
            <Typography>Quick Actions</Typography>
          </CardHeader>
          <CardContent sx={theming.getThemedCardSx()}>
            <div className="flex flex-col items-center justify-center min-h-screen">
              <Link href="/guest-management">
                <Button className="w-full h-20 flex flex-col items-center justify-center gap-2" variant="outlined">
                  <Group className="w-6 h-6" />
                  <span>Guest List</span>
                </Button>
              </Link>
              <Link href="/inspiration-board">
                <Button className="w-full h-20 flex flex-col items-center justify-center gap-2" variant="outlined">
                  <Palette className="w-6 h-6" />
                  <span>Inspiration</span>
                </Button>
              </Link>
              <Link href="/wedding-timeline">
                <Button className="w-full h-20 flex flex-col items-center justify-center gap-2" variant="outlined">
                  <Event className="w-6 h-6" />
                  <span>Timeline</span>
                </Button>
              </Link>
              <Link href="/wedding-planner">
                <Button className="w-full h-20 flex flex-col items-center justify-center gap-2" variant="outlined">
                  <AutoAwesome className="w-6 h-6" />
                  <span>Intelligent Planner</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </MuiCard>
      </div>
    </div>
  );
}