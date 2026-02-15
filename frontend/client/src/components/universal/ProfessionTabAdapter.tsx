/**
 * Profession Tab Adapter
 * Wraps existing UniversalDashboard tab content with profession-aware logic
 * NO REFACTORING NEEDED - Just drop this in!
 */

import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import useProfessionTabs from './hooks/useProfessionTabs';

// Import profession-specific tab components
import PetHotelBookingCalendar from '../pet-hotel/PetHotelBookingCalendar';
import PetProfileManager from '../pet-hotel/PetProfileManager';
import LivePetCameras from '../pet-hotel/LivePetCameras';
import DailyCareLogs from '../pet-hotel/DailyCareLogs';
import FacilityManagement from '../pet-hotel/FacilityManagement';

import YogaClassSchedule from '../yoga/YogaClassSchedule';
import MembershipManager from '../yoga/MembershipManager';
import InstructorManagement from '../yoga/InstructorManagement';
import StudioBooking from '../yoga/StudioBooking';

import TattooPortfolio from '../tattoo/TattooPortfolio';
import AppointmentBooking from '../common/AppointmentBooking';
import DesignGallery from '../tattoo/DesignGallery';
import AftercareManager from '../tattoo/AftercareManager';

import StylistPortfolio from '../hairdresser/StylistPortfolio';
import ProductSales from '../hairdresser/ProductSales';

import ClientProgramManager from '../trainer/ClientProgramManager';
import ProgressTracking from '../trainer/ProgressTracking';
import NutritionPlans from '../trainer/NutritionPlans';

import ReservationSystem from '../restaurant/ReservationSystem';
import MenuManagement from '../restaurant/MenuManagement';
import TableManagement from '../restaurant/TableManagement';

import FlowerInventory from '../florist/FlowerInventory';
import DeliverySchedule from '../florist/DeliverySchedule';

import EnrollmentManager from '../childcare/EnrollmentManager';
import DailyActivities from '../childcare/DailyActivities';
import ParentCommunication from '../childcare/ParentCommunication';
import MealPlanning from '../childcare/MealPlanning';

import PatientSessions from '../psychologist/PatientSessions';
import PatientNotes from '../psychologist/PatientNotes';
import Telehealth from '../psychologist/Telehealth';
import TreatmentPlans from '../psychologist/TreatmentPlans';

import LessonSchedule from '../driving-school/LessonSchedule';
import StudentProgress from '../driving-school/StudentProgress';
import VehicleManagement from '../driving-school/VehicleManagement';
import TheoryTests from '../driving-school/TheoryTests';

import TreatmentBooking from '../spa/TreatmentBooking';
import ClientPreferences from '../spa/ClientPreferences';
import MembershipPackages from '../spa/MembershipPackages';

import RoleRoomDashboardPanel from '../role-room/RoleRoomDashboardPanel';

interface ProfessionTabAdapterProps {
  profession: string;
  tabId: string;
  userId: string;
  [key: string]: any;
}

/**
 * Dynamically renders the correct component based on profession and tab ID
 * This allows UniversalDashboard to support ANY profession without refactoring
 */
export default function ProfessionTabAdapter({ 
  profession, 
  tabId, 
  userId,
  ...additionalProps 
}: ProfessionTabAdapterProps) {
  
  const { hasTab } = useProfessionTabs(profession);

  // Check if this tab exists for this profession
  if (!hasTab(tabId, profession)) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="info">
          <Typography variant="body2">
            Denne fanen er ikke tilgjengelig for {profession}.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Universal tabs available across all professions
  if (tabId === 'role-room') {
    return <RoleRoomDashboardPanel userId={userId} profession={profession} {...additionalProps} />;
  }

  // Component mapping - maps tab IDs to actual components
  const componentMap: Record<string, Record<string, React.ComponentType<any>>> = {
    pet_hotel: {
      'booking-calendar': PetHotelBookingCalendar'pet-profiles': PetProfileManager'live-cameras': LivePetCameras'daily-logs': DailyCareLogs'facility-management': FacilityManagement,
    },
    
    yoga_studio: {
      'class-schedule': YogaClassSchedule'memberships': MembershipManager'instructor-management': InstructorManagement'studio-booking': StudioBooking,
    },
    
    tattoo_artist: {
      'portfolio': TattooPortfolio'appointments': AppointmentBooking'design-gallery': DesignGallery'aftercare': AftercareManager,
    },
    
    hairdresser: {
      'appointments': AppointmentBooking'client-history': () => <Box>Client History Component</Box>'product-sales': ProductSales'stylist-portfolio': StylistPortfolio,
    },
    
    personal_trainer: {
      'client-programs': ClientProgramManager'progress-tracking': ProgressTracking'nutrition-plans': NutritionPlans'session-booking': AppointmentBooking,
    },
    
    restaurant: {
      'reservations': ReservationSystem'menu-management': MenuManagement'table-management': TableManagement'inventory': () => <Box>Restaurant Inventory Component</Box>,
    },
    
    florist: {
      'event-orders': AppointmentBooking'flower-inventory': FlowerInventory'delivery-schedule': DeliverySchedule'design-portfolio': () => <Box>Florist Portfolio Component</Box>,
    },
    
    childcare: {
      'enrollment': EnrollmentManager'daily-activities': DailyActivities'parent-communication': ParentCommunication'meal-planning': MealPlanning,
    },
    
    psychologist: {
      'patient-sessions': PatientSessions'patient-notes': PatientNotes'telehealth': Telehealth'treatment-plans': TreatmentPlans,
    },
    
    driving_school: {
      'lesson-schedule': LessonSchedule'student-progress': StudentProgress'vehicle-management': VehicleManagement'theory-tests': TheoryTests,
    },
    
    spa_wellness: {
      'treatment-booking': TreatmentBooking'client-preferences': ClientPreferences'product-inventory': () => <Box>Spa Product Inventory</Box>'membership-packages': MembershipPackages,
    },
  };

  // Get the component for this profession and tab
  const Component = componentMap[profession]?.[tabId];

  // If component exists, render it
  if (Component) {
    return <Component userId={userId} profession={profession} {...additionalProps} />;
  }

  // Fallback for tabs without specific components yet
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography variant="h6" color="textSecondary">
        {tabId} - Coming Soon for {profession}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        This feature will be available soon for your profession.
      </Typography>
    </Box>
  );
}

