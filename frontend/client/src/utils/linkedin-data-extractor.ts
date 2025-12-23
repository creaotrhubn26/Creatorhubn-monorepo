/**
 * LinkedIn Data Extractor
 * Converts LinkedIn profile data to Resume Builder format
 */

export interface LinkedInProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePicture?: string;
  headline?: string;
  summary?: string;
  location?: string;
  industry?: string;
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: string[];
  languages?: string[];
  certifications?: LinkedInCertification[];
  lastSynced: number;
}

export interface LinkedInExperience {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
}

export interface LinkedInEducation {
  id: string;
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedInCertification {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface ResumeData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    location?: string;
    profilePicture?: string;
    summary?: string;
    headline?: string;
  };
  workExperience: Array<{
    company: string;
    position: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    isCurrent: boolean;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  skills: string[];
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate?: string;
    expirationDate?: string;
    credentialId?: string;
    credentialUrl?: string;
  }>;
}

/**
 * Extract personal information from LinkedIn profile
 */
export function extractPersonalInfo(profile: LinkedInProfileData): ResumeData['personalInfo'] {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    location: profile.location,
    profilePicture: profile.profilePicture,
    summary: profile.summary,
    headline: profile.headline
  };
}

/**
 * Extract work experience from LinkedIn profile
 */
export function extractWorkExperience(profile: LinkedInProfileData): ResumeData['workExperience'] {
  if (!profile.experience || profile.experience.length === 0) {
    return [];
  }

  return profile.experience.map(exp => ({
    company: exp.company,
    position: exp.title,
    location: exp.location,
    startDate: exp.startDate,
    endDate: exp.endDate,
    description: exp.description,
    isCurrent: exp.isCurrent
  }));
}

/**
 * Extract education from LinkedIn profile
 */
export function extractEducation(profile: LinkedInProfileData): ResumeData['education'] {
  if (!profile.education || profile.education.length === 0) {
    return [];
  }

  return profile.education.map(edu => ({
    school: edu.school,
    degree: edu.degree,
    fieldOfStudy: edu.fieldOfStudy,
    startDate: edu.startDate,
    endDate: edu.endDate,
    description: edu.description
  }));
}

/**
 * Extract skills from LinkedIn profile
 */
export function extractSkills(profile: LinkedInProfileData): string[] {
  return profile.skills || [];
}

/**
 * Extract certifications from LinkedIn profile
 */
export function extractCertifications(profile: LinkedInProfileData): ResumeData['certifications'] {
  if (!profile.certifications || profile.certifications.length === 0) {
    return [];
  }

  return profile.certifications.map(cert => ({
    name: cert.name,
    issuer: cert.issuingOrganization,
    issueDate: cert.issueDate,
    expirationDate: cert.expirationDate,
    credentialId: cert.credentialId,
    credentialUrl: cert.credentialUrl
  }));
}

/**
 * Convert LinkedIn profile to Resume Builder format
 */
export function linkedInToResumeData(profile: LinkedInProfileData): ResumeData {
  return {
    personalInfo: extractPersonalInfo(profile),
    workExperience: extractWorkExperience(profile),
    education: extractEducation(profile),
    skills: extractSkills(profile),
    certifications: extractCertifications(profile)
  };
}

/**
 * Merge LinkedIn data with existing resume data
 * Existing data takes priority, LinkedIn fills in gaps
 */
export function mergeLinkedInData(
  existingResume: any,
  linkedInData: ResumeData
): any {
  const merged = { ...existingResume };

  // Merge personal info (LinkedIn fills gaps)
  if (!merged.personalInfo) {
    merged.personalInfo = {};
  }
  merged.personalInfo = {
    ...linkedInData.personalInfo,
    ...merged.personalInfo // Existing data takes priority
  };

  // Merge work experience (append new, avoid duplicates)
  if (!merged.workExperience) {
    merged.workExperience = [];
  }
  
  const existingCompanies = new Set(
    merged.workExperience.map((exp: any) => exp.company?.toLowerCase())
  );
  
  const newExperience = linkedInData.workExperience.filter(
    exp => !existingCompanies.has(exp.company?.toLowerCase())
  );
  
  merged.workExperience = [...merged.workExperience, ...newExperience];

  // Merge education (append new, avoid duplicates)
  if (!merged.education) {
    merged.education = [];
  }
  
  const existingSchools = new Set(
    merged.education.map((edu: any) => edu.school?.toLowerCase())
  );
  
  const newEducation = linkedInData.education.filter(
    edu => !existingSchools.has(edu.school?.toLowerCase())
  );
  
  merged.education = [...merged.education, ...newEducation];

  // Merge skills (combine unique skills)
  if (!merged.skills) {
    merged.skills = [];
  }
  
  const existingSkills = new Set(
    merged.skills.map((skill: string) => skill.toLowerCase())
  );
  
  const newSkills = linkedInData.skills.filter(
    skill => !existingSkills.has(skill.toLowerCase())
  );
  
  merged.skills = [...merged.skills, ...newSkills];

  // Merge certifications (append new, avoid duplicates)
  if (!merged.certifications) {
    merged.certifications = [];
  }
  
  const existingCerts = new Set(
    merged.certifications.map((cert: any) => cert.name?.toLowerCase())
  );
  
  const newCerts = linkedInData.certifications.filter(
    cert => !existingCerts.has(cert.name?.toLowerCase())
  );
  
  merged.certifications = [...merged.certifications, ...newCerts];

  return merged;
}

/**
 * Format date from LinkedIn format to display format
 */
export function formatLinkedInDate(dateString?: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('no-NO', { 
      year: 'numeric', 
      month: 'long' 
    });
  } catch {
    return dateString;
  }
}

/**
 * Check if LinkedIn profile has been synced recently
 */
export function isProfileStale(profile: LinkedInProfileData, maxAgeHours: number = 24): boolean {
  const ageMs = Date.now() - profile.lastSynced;
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

