
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
  const [allRecordsCount, setAllRecordsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastKey, setLastKey] = useState<number | null>(null);

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

  const fetchInitialRecords = useCallback(async () => {
    setLoading(true);
    const attendanceRef = ref(db, 'attendance');
    const initialQuery = query(attendanceRef, orderByChild('timestamp'), limitToLast(PAGE_SIZE));

    try {
        const snapshot = await get(initialQuery);
        const loadedRecords = processSnapshot(snapshot);
        
        setPaginatedRecords(loadedRecords);
        if (loadedRecords.length > 0) {
            setLastKey(loadedRecords[loadedRecords.length - 1].timestamp);
        }
        setHasMore(loadedRecords.length === PAGE_SIZE);
    } catch (error) {
        console.error("Error fetching initial records: ", error);
    } finally {
        setLoading(false);
    }
  }, []);

  const fetchMoreRecords = useCallback(async () => {
    if (!hasMore || loadingMore || !lastKey) return;
    
    setLoadingMore(true);
    const attendanceRef = ref(db, 'attendance');
    const moreQuery = query(
      attendanceRef, 
      orderByChild('timestamp'), 
      endBefore(lastKey), 
      limitToLast(PAGE_SIZE)
    );

    try {
        const snapshot = await get(moreQuery);
        const newRecords = processSnapshot(snapshot);

        if (newRecords.length > 0) {
            setLastKey(newRecords[newRecords.length - 1].timestamp);
            setPaginatedRecords(prev => [...prev, ...newRecords]);
        }
        setHasMore(newRecords.length === PAGE_SIZE);
    } catch (error) {
        console.error("Error fetching more records: ", error);
    } finally {
        setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastKey]);


  useEffect(() => {
    // Listener for the total count of records
    const attendanceRef = ref(db, 'attendance');
    const unsubscribeCount = onValue(attendanceRef, (snapshot) => {
       setAllRecordsCount(snapshot.size);
    });

    fetchInitialRecords();

    // Listener for real-time additions (prepends to the list)
    const newRecordsQuery = query(attendanceRef, orderByChild('timestamp'), limitToLast(1));
    const unsubscribeNew = onValue(newRecordsQuery, (snapshot) => {
        const newRecord = processSnapshot(snapshot);
        if (newRecord.length > 0 && !paginatedRecords.some(r => r.id === newRecord[0].id)) {
            // This is a naive way to handle real-time updates with pagination.
            // For a production app, a more sophisticated approach would be needed.
            // For now, we prepend if it's not already there.
            setPaginatedRecords(prev => [newRecord[0], ...prev.filter(p => p.id !== newRecord[0].id)]);
        }
    });

    return () => {
        unsubscribeCount();
        unsubscribeNew();
    };
  }, [fetchInitialRecords]);

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
    // Optimistically update UI
    setPaginatedRecords(prev => prev.filter(r => r.id !== id));
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
