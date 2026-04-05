import React from 'react';
import { useTeamSettings } from '../contexts/TeamSettingsContext';

interface TeamLogoProps {
  className?: string;
  teamNumber?: number;
  logoUrl?: string | null;
}

const TeamLogo: React.FC<TeamLogoProps> = ({ className, teamNumber: teamNumberProp, logoUrl: logoUrlProp }) => {
  const { settings } = useTeamSettings();
  const teamNumber = teamNumberProp ?? settings.teamNumber;
  const logoUrl = logoUrlProp !== undefined ? logoUrlProp : settings.logoUrl;

  if (logoUrl) {
    return <img src={logoUrl} alt="Team logo" className={className} style={{ objectFit: 'contain' }} />;
  }

  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="10" fill="currentColor" />
      <circle cx="12" cy="12" r="5" fill="white" />
      <circle cx="12" cy="88" r="5" fill="white" />
      <circle cx="88" cy="88" r="5" fill="white" />
      <rect x="25" y="8" width="55" height="30" rx="4" fill="white" fillOpacity="0.1" />
      <rect x="58" y="8" width="14" height="24" fill="white" />
      <circle cx="50" cy="48" r="16" fill="white" />
      <circle cx="50" cy="48" r="6" fill="black" />
      <circle cx="56" cy="48" r="2" fill="black" />
      <text x="50" y="82" fontFamily="monospace" fontWeight="900" fontSize="19" fill="white" textAnchor="middle" letterSpacing="-1">{teamNumber}</text>
    </svg>
  );
};

export default TeamLogo;
