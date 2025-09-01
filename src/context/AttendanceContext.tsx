
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  ref, 
  push, 
  onValue, 
  remove, 
  serverTimestamp, 
  query, 
  orderByChild, 
  limitToLast,
  endBefore,
  get
} from "firebase/database";

export interface AttendanceRecord {
  id: string; // Firebase push keys are strings
  studentName: string;
  timestamp: number; // Store as a server-side timestamp
  location: {
    latitude: number;
    longitude: number;
  };
  photo: string | null;
  floorNumber: string;
}

interface NewRecord {
    studentName: string;
    floorNumber: string;
    location: {
        latitude: number;
        longitude: number;
    };
    photo: string | null;
}

interface AttendanceContextType {
  paginatedRecords: AttendanceRecord[];
  allRecordsCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  fetchInitialRecords: () => void;
  fetchMoreRecords: () => void;
  addRecord: (record: NewRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(
  undefined
);

const PAGE_SIZE = 10;

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [paginatedRecords, setPaginatedRecords] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [allRecordsCount, setAllRecordsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const processSnapshot = (snapshot: any) => {
      const data = snapshot.val();
      if (!data) {
        return [];
      }
      return Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
  }

  const fetchInitialRecords = useCallback(() => {
     setLoading(true);
     const paginated = allRecords.slice(0, PAGE_SIZE);
     setPaginatedRecords(paginated);
     setHasMore(allRecords.length > PAGE_SIZE);
     setLoading(false);
  }, [allRecords]);


  const fetchMoreRecords = useCallback(() => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    const currentLength = paginatedRecords.length;
    const nextRecords = allRecords.slice(currentLength, currentLength + PAGE_SIZE);
    
    setPaginatedRecords(prev => [...prev, ...nextRecords]);
    setHasMore(allRecords.length > currentLength + PAGE_SIZE);

    setLoadingMore(false);
  }, [hasMore, loadingMore, paginatedRecords.length, allRecords]);


  useEffect(() => {
    setLoading(true);
    const attendanceRef = ref(db, 'attendance');
    const recordsQuery = query(attendanceRef, orderByChild('timestamp'));
    
    const unsubscribe = onValue(recordsQuery, (snapshot) => {
        const fullList = processSnapshot(snapshot);
        setAllRecords(fullList);
        setAllRecordsCount(fullList.length);
        
        const paginated = fullList.slice(0, paginatedRecords.length || PAGE_SIZE);
        setPaginatedRecords(paginated);
        setHasMore(fullList.length > paginated.length);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [paginatedRecords.length]);

  const addRecord = async ({ studentName, floorNumber, location, photo }: NewRecord) => {
    const attendanceRef = ref(db, 'attendance');
    const newRecordPayload = {
      studentName,
      floorNumber,
      location,
      photo,
      timestamp: serverTimestamp(),
    };
    await push(attendanceRef, newRecordPayload);
  };
  
  const removeRecord = async (id: string) => {
    const recordRef = ref(db, `attendance/${id}`);
    await remove(recordRef);
  };

  return (
    <AttendanceContext.Provider value={{ 
        paginatedRecords, 
        allRecordsCount, 
        loading, 
        addRecord, 
        removeRecord,
        fetchInitialRecords,
        fetchMoreRecords,
        loadingMore,
        hasMore
    }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }
  return context;
}
