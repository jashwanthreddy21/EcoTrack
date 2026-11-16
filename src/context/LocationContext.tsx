import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserLocationSelection } from '../types/index.ts';
import { api } from '../services/api.ts';

interface LocationContextType {
  selectedLocation: UserLocationSelection | null;
  isLocationSet: boolean;
  isLoadingLocation: boolean;
  isChangeModalOpen: boolean;
  setIsChangeModalOpen: (open: boolean) => void;
  confirmLocation: (loc: UserLocationSelection) => Promise<void>;
  clearLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'ecotrack_selected_location';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLocation, setSelectedLocation] = useState<UserLocationSelection | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const initializeLocation = async () => {
      setIsLoadingLocation(true);
      try {
        // 1. Try local storage first for instant response
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.areaName && parsed.cityName) {
              setSelectedLocation(parsed);
            }
          } catch (e) {
            console.warn('Failed to parse cached location', e);
          }
        }

        // 2. Fetch authenticated backend profile location
        const backendLoc = await api.getUserLocation();
        if (backendLoc && backendLoc.areaName) {
          setSelectedLocation(backendLoc);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(backendLoc));
        }
      } catch (err) {
        console.warn('Location initialization notice:', err);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    initializeLocation();
  }, []);

  const confirmLocation = async (loc: UserLocationSelection) => {
    setSelectedLocation(loc);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loc));
    try {
      await api.saveUserLocation(loc);
    } catch (err) {
      console.warn('Saved location locally, backend sync note:', err);
    }
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        isLocationSet: selectedLocation !== null,
        isLoadingLocation,
        isChangeModalOpen,
        setIsChangeModalOpen,
        confirmLocation,
        clearLocation
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
