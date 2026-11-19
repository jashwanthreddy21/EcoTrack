import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaHierarchyLocation, AreaLocation, DistrictLocation } from '../types/index.ts';
import { api } from '../services/api.ts';
import { INITIAL_AREAS, TELANGANA_DISTRICTS } from '../services/seedData.ts';
import {
  filterMunicipalAreasByDistrict,
  getAreaCenterCoordinates,
  normalizeTelanganaDistrictKey
} from '../utils/ecoLogic.ts';

export interface TelanganaMunicipalAreaOption {
  id: string;
  name: string;
  zone: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  pincode: string;
  wards: string[];
  latitude: number;
  longitude: number;
  isSupported: boolean;
  collectionFrequency?: string;
  contactPhone?: string;
}

interface UseTelanganaLocationHierarchyOptions {
  selectedDistrict: string; // District name or District ID; '' means not selected yet
  enabled?: boolean;
  supportedOnly?: boolean;
  fallbackAreas?: AreaLocation[];
}

function buildFallbackDistricts(): DistrictLocation[] {
  return TELANGANA_DISTRICTS.map((name) => ({
    id: `dis-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    stateId: 'state-ts',
    name,
    active: true
  }));
}

function mapHierarchyArea(
  area: AreaHierarchyLocation,
  fallbackDistrictName: string
): TelanganaMunicipalAreaOption {
  const [fallbackLat, fallbackLng] = getAreaCenterCoordinates(area.name || fallbackDistrictName);
  return {
    id: area.id,
    name: area.name,
    zone: area.zone,
    cityId: area.cityId,
    cityName: area.cityName || `${fallbackDistrictName} Municipality`,
    districtId: area.districtId || '',
    districtName: area.districtName || fallbackDistrictName,
    pincode: area.pincode || '506001',
    wards: Array.isArray(area.wards) && area.wards.length > 0 ? area.wards : ['Ward 1'],
    latitude: typeof area.latitude === 'number' ? area.latitude : fallbackLat,
    longitude: typeof area.longitude === 'number' ? area.longitude : fallbackLng,
    isSupported: area.isSupported !== undefined ? area.isSupported : true,
    collectionFrequency: area.collectionFrequency,
    contactPhone: area.contactPhone
  };
}

function mapSeedAreaToOption(area: AreaLocation): TelanganaMunicipalAreaOption {
  const [fallbackLat, fallbackLng] = getAreaCenterCoordinates(area.name || area.district);
  return {
    id: area.id,
    name: area.name,
    zone: area.zone,
    cityId: '',
    cityName: area.city || `${area.district || 'Telangana'} Municipality`,
    districtId: '',
    districtName: area.district || '',
    pincode: area.pincode || '506001',
    wards: Array.isArray(area.wards) && area.wards.length > 0 ? area.wards : ['Ward 1'],
    latitude: typeof area.latitude === 'number' ? area.latitude : fallbackLat,
    longitude: typeof area.longitude === 'number' ? area.longitude : fallbackLng,
    isSupported: true
  };
}

/**
 * Two-step Telangana location selection hook:
 *   Step 1: Load & select a District in Telangana.
 *   Step 2: Fetch & display ONLY the relevant municipal areas for that chosen district.
 */
export function useTelanganaLocationHierarchy({
  selectedDistrict,
  enabled = true,
  supportedOnly = false,
  fallbackAreas
}: UseTelanganaLocationHierarchyOptions) {
  const [districts, setDistricts] = useState<DistrictLocation[]>(() => buildFallbackDistricts());
  const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(false);
  const [municipalAreas, setMunicipalAreas] = useState<TelanganaMunicipalAreaOption[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState<boolean>(false);
  const fetchSeqRef = useRef<number>(0);

  // Step 1: Load all 33 Telangana Districts
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setIsLoadingDistricts(true);

    api
      .getTelanganaDistricts()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setDistricts(data);
        }
      })
      .catch(() => {
        // Retain full 33-district fallback list on offline/network error
      })
      .finally(() => {
        if (active) setIsLoadingDistricts(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  // Match either district ID (e.g. 'dis-suryapet') or district name (e.g. 'Suryapet')
  const selectedDistrictObj = useMemo(() => {
    const trimmed = (selectedDistrict || '').trim();
    if (!trimmed) return undefined;
    const targetKey = normalizeTelanganaDistrictKey(trimmed);
    return (
      districts.find((d) => d.id === trimmed) ||
      districts.find((d) => normalizeTelanganaDistrictKey(d.name) === targetKey)
    );
  }, [districts, selectedDistrict]);

  // Step 2: Fetch ONLY relevant municipal areas for the chosen district
  useEffect(() => {
    if (!enabled) return;

    const trimmed = (selectedDistrict || '').trim();
    if (!trimmed) {
      fetchSeqRef.current += 1;
      setMunicipalAreas([]);
      setIsLoadingAreas(false);
      return;
    }

    let active = true;
    const requestSeq = ++fetchSeqRef.current;
    const resolvedDistrictName = selectedDistrictObj?.name || trimmed;
    const resolvedDistrictId = selectedDistrictObj?.id;

    setIsLoadingAreas(true);
    setMunicipalAreas([]);

    api
      .getMunicipalAreasByDistrict(
        {
          districtId: resolvedDistrictId,
          districtName: resolvedDistrictName
        },
        supportedOnly
      )
      .then((fetched) => {
        if (!active || requestSeq !== fetchSeqRef.current) return;
        const mapped = fetched.map((a) => mapHierarchyArea(a, resolvedDistrictName));
        setMunicipalAreas(mapped);
      })
      .catch(() => {
        if (!active || requestSeq !== fetchSeqRef.current) return;
        const pool = fallbackAreas && fallbackAreas.length > 0 ? fallbackAreas : INITIAL_AREAS;
        const matchedSeed = filterMunicipalAreasByDistrict(pool, resolvedDistrictName);
        setMunicipalAreas(matchedSeed.map(mapSeedAreaToOption));
      })
      .finally(() => {
        if (active && requestSeq === fetchSeqRef.current) {
          setIsLoadingAreas(false);
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, selectedDistrict, selectedDistrictObj?.id, selectedDistrictObj?.name, supportedOnly, fallbackAreas]);

  return {
    districts,
    selectedDistrictObj,
    municipalAreas,
    isLoadingDistricts,
    isLoadingAreas
  };
}
