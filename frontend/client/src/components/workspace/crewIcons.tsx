/**
 * wsIcons — mapper ikonnavn (fra @shared/crew-roles og faner) til MUI-
 * strekikoner, så board-kolonner, oppgave-tagger, tidslinje-faser og
 * aktivitets-feeden bruker samme ikonspråk som resten av workspacen (i stedet
 * for emoji).
 */
import React from 'react';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import Videocam from '@mui/icons-material/Videocam';
import Groups from '@mui/icons-material/Groups';
import Movie from '@mui/icons-material/Movie';
import Piano from '@mui/icons-material/Piano';
import Mic from '@mui/icons-material/Mic';
import MusicNote from '@mui/icons-material/MusicNote';
import Tune from '@mui/icons-material/Tune';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import Inventory2 from '@mui/icons-material/Inventory2';
import LocalShipping from '@mui/icons-material/LocalShipping';
import Call from '@mui/icons-material/Call';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import Spa from '@mui/icons-material/Spa';
import ContentCut from '@mui/icons-material/ContentCut';
import SettingsVoice from '@mui/icons-material/SettingsVoice';
import Handyman from '@mui/icons-material/Handyman';
import Person from '@mui/icons-material/Person';
// Aktivitet / faser / review
import Star from '@mui/icons-material/Star';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import CloudDone from '@mui/icons-material/CloudDone';
import PlayArrow from '@mui/icons-material/PlayArrow';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import Bolt from '@mui/icons-material/Bolt';
import AccessTime from '@mui/icons-material/AccessTime';
import Favorite from '@mui/icons-material/Favorite';
import Church from '@mui/icons-material/Church';
import WbTwilight from '@mui/icons-material/WbTwilight';
import Celebration from '@mui/icons-material/Celebration';
import Image from '@mui/icons-material/Image';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Close from '@mui/icons-material/Close';
import Headphones from '@mui/icons-material/Headphones';
import SelfImprovement from '@mui/icons-material/SelfImprovement';
import Computer from '@mui/icons-material/Computer';
import Storage from '@mui/icons-material/Storage';
import Save from '@mui/icons-material/Save';
import Check from '@mui/icons-material/Check';
import WarningAmber from '@mui/icons-material/WarningAmber';
import LinkIcon from '@mui/icons-material/Link';
import Draw from '@mui/icons-material/Draw';
import Place from '@mui/icons-material/Place';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import Equalizer from '@mui/icons-material/Equalizer';
import CreditCard from '@mui/icons-material/CreditCard';
import Download from '@mui/icons-material/Download';
import Security from '@mui/icons-material/Security';
import SmartToy from '@mui/icons-material/SmartToy';
import Folder from '@mui/icons-material/Folder';
import WbSunny from '@mui/icons-material/WbSunny';
import Favorite2 from '@mui/icons-material/FavoriteBorder';
import Newspaper from '@mui/icons-material/Newspaper';
import Article from '@mui/icons-material/Article';

const WS_ICONS: Record<string, React.ElementType> = {
  // Crew-roller
  PhotoCamera, Videocam, Groups, Movie, Piano, Mic, MusicNote, Tune,
  ReceiptLong, Inventory2, LocalShipping, Call, CalendarMonth, Spa,
  ContentCut, SettingsVoice, Handyman, Person,
  // Aktivitet / faser / review / studio / DIT
  Star, DeleteOutline, FlagOutlined, CloudDone, PlayArrow, AutoAwesome,
  ChatBubbleOutline, Bolt, AccessTime, Favorite, Church, WbTwilight,
  Celebration, Image, HourglassEmpty, CheckCircleOutline, EditOutlined, Close,
  Headphones, SelfImprovement, Computer, Storage, Save, Check, WarningAmber,
  Link: LinkIcon, Draw, Place, RocketLaunch, Equalizer, CreditCard, Download,
  Security, SmartToy, Folder, WbSunny, FavoriteBorder: Favorite2,
  Newspaper, Article,
};

/** Ikon som element ut fra MUI-ikonnavn. Ukjent navn → nøytralt fallback. */
export function wsIcon(name?: string | null, sx: any = { fontSize: 15 }): React.ReactNode {
  const Icon = (name && WS_ICONS[name]) || Bolt;
  return <Icon sx={sx} />;
}

/** Crew-rolle-ikon (fallback Person). */
export function crewIcon(name?: string | null, sx: any = { fontSize: 15 }): React.ReactNode {
  const Icon = (name && WS_ICONS[name]) || Person;
  return <Icon sx={sx} />;
}
