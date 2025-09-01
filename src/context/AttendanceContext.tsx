
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  ref, 
  onValue, 
  push,
  remove, 
  serverTimestamp, 
  query, 
  orderByChild,
  endBefore,
  limitToLast
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
     const attendanceRef = ref(db, 'attendance');
     const recordsQuery = query(attendanceRef, orderByChild('timestamp'));
     onValue(recordsQuery, (snapshot) => {
         const fullList = processSnapshot(snapshot);
         setAllRecordsCount(fullList.length);
         const paginated = fullList.slice(0, PAGE_SIZE);
         setPaginatedRecords(paginated);
         setHasMore(fullList.length > PAGE_SIZE);
         setLoading(false);
     }, { onlyOnce: true });
  }, []);

  const fetchMoreRecords = useCallback(() => {
    if (!hasMore || loadingMore || paginatedRecords.length === 0) return;
    
    setLoadingMore(true);
    const lastRecord = paginatedRecords[paginatedRecords.length - 1];
    const attendanceRef = ref(db, 'attendance');
    // We query all records again and slice, which is inefficient.
    // A better implementation would use endBefore() and limitToLast() for true pagination.
    const recordsQuery = query(
      attendanceRef, 
      orderByChild('timestamp')
    );

    onValue(recordsQuery, (snapshot) => {
      const fullList = processSnapshot(snapshot);
      const lastRecordIndex = fullList.findIndex(r => r.id === lastRecord.id);
      
      if (lastRecordIndex !== -1) {
        const nextRecords = fullList.slice(lastRecordIndex + 1, lastRecordIndex + 1 + PAGE_SIZE);
        if (nextRecords.length > 0) {
            setPaginatedRecords(prev => [...prev, ...nextRecords]);
            setHasMore(fullList.length > paginatedRecords.length + nextRecords.length);
        } else {
            setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
      setLoadingMore(false);
    }, { onlyOnce: true });

  }, [hasMore, loadingMore, paginatedRecords]);


  useEffect(() => {
    setLoading(true);
    const attendanceRef = ref(db, 'attendance');
    const recordsQuery = query(attendanceRef, orderByChild('timestamp'));
    
    const unsubscribe = onValue(recordsQuery, (snapshot) => {
        const fullList = processSnapshot(snapshot);
        setAllRecordsCount(fullList.length);
        
        // This keeps the currently viewed items in sync, adding new items to the top.
        const currentLength = paginatedRecords.length > 0 ? paginatedRecords.length : PAGE_SIZE;
        const updatedPaginatedList = fullList.slice(0, currentLength);
        
        setPaginatedRecords(updatedPaginatedList);
        setHasMore(fullList.length > updatedPaginatedList.length);
        if (loading) setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
