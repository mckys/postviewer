export interface StoredProfile {
  email: string;
  password: string;
  nickname?: string;
}

const PROFILES_KEY = 'stored_profiles';

export function getStoredProfiles(): StoredProfile[] {
  try {
    const stored = localStorage.getItem(PROFILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading stored profiles:', error);
    return [];
  }
}

export function saveProfile(profile: StoredProfile): void {
  try {
    const profiles = getStoredProfiles();
    // Check if profile already exists (by email)
    const existingIndex = profiles.findIndex(p => p.email === profile.email);

    if (existingIndex >= 0) {
      // Update existing profile
      profiles[existingIndex] = profile;
    } else {
      // Add new profile
      profiles.push(profile);
    }

    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('Error saving profile:', error);
  }
}

export function removeProfile(email: string): void {
  try {
    const profiles = getStoredProfiles();
    const filtered = profiles.filter(p => p.email !== email);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing profile:', error);
  }
}

export function getCurrentProfileEmail(): string | null {
  try {
    return localStorage.getItem('current_profile_email');
  } catch (error) {
    console.error('Error reading current profile:', error);
    return null;
  }
}

export function setCurrentProfileEmail(email: string): void {
  try {
    localStorage.setItem('current_profile_email', email);
  } catch (error) {
    console.error('Error setting current profile:', error);
  }
}
