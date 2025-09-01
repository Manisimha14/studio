
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
  limitToLast,
  onChildAdded,
  startAt,
  get,
  equalTo,
} from "firebase/database";

export interface AttendanceRecord {
  id: string;
  studentName: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
  photo: string | null;
  floorNumber: string;
  deviceId: string;
}

interface NewRecord {
    studentName: string;
    floorNumber: string;
    location: {
        latitude: number;
        longitude: number;
    };
    photo: string;
    deviceId: string;
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
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  const processRecords = (snapshot: any) => {
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
     
     get(attendanceRef).then((snapshot) => {
        setAllRecordsCount(snapshot.size);
     });

     const recordsQuery = query(attendanceRef, orderByChild('timestamp'), limitToLast(PAGE_SIZE));
     onValue(recordsQuery, (snapshot) => {
         const records = processRecords(snapshot);
         if (records.length > 0) {
            setLastTimestamp(records[records.length-1].timestamp);
         }
         setPaginatedRecords(records);
         setHasMore(records.length === PAGE_SIZE);
         setLoading(false);
     }, { onlyOnce: true });
  }, []);

  const fetchMoreRecords = useCallback(() => {
    if (!hasMore || loadingMore || !lastTimestamp) return;
    
    setLoadingMore(true);
    const attendanceRef = ref(db, 'attendance');
    const recordsQuery = query(
      attendanceRef, 
      orderByChild('timestamp'),
      endBefore(lastTimestamp),
      limitToLast(PAGE_SIZE)
    );

    onValue(recordsQuery, (snapshot) => {
      const newRecords = processRecords(snapshot);
      if (newRecords.length > 0) {
          setLastTimestamp(newRecords[newRecords.length-1].timestamp);
          setPaginatedRecords(prev => [...prev, ...newRecords]);
          setHasMore(newRecords.length === PAGE_SIZE);
      } else {
          setHasMore(false);
      }
      setLoadingMore(false);
    }, { onlyOnce: true });

  }, [hasMore, loadingMore, lastTimestamp]);


  useEffect(() => {
    const attendanceRef = ref(db, 'attendance');
    const recentRecordsQuery = query(attendanceRef, orderByChild('timestamp'), startAt(Date.now()));
    
    const unsubscribe = onChildAdded(recentRecordsQuery, (snapshot) => {
        const newRecord = { id: snapshot.key, ...snapshot.val() };
        
        setPaginatedRecords(prevRecords => {
            if(prevRecords.some(r => r.id === newRecord.id)) {
                return prevRecords;
            }
            const updatedRecords = [newRecord, ...prevRecords];
            return updatedRecords.sort((a, b) => b.timestamp - a.timestamp);
        });
        setAllRecordsCount(prevCount => prevCount + 1);
    });

    return () => unsubscribe();
  }, []);

  const addRecord = async ({ studentName, floorNumber, location, photo, deviceId }: NewRecord) => {
    const attendanceRef = ref(db, 'attendance');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    const snapshot = await get(attendanceRef);

    if (snapshot.exists()) {
        const records = snapshot.val();
        for (const key in records) {
            const record = records[key];
            if (record.studentName.toLowerCase() === studentName.toLowerCase() && record.timestamp >= startOfToday) {
                 if (record.deviceId !== deviceId) {
                    throw new Error("Attendance already marked from a different device today.");
                 } else {
                    throw new Error("You have already marked your attendance today from this device.");
                 }
            }
        }
    }

    const newRecordPayload = {
      studentName,
      floorNumber,
      location,
      photo,
      deviceId,
      timestamp: serverTimestamp(),
    };
    await push(attendanceRef, newRecordPayload);
  };
  
  const removeRecord = async (id: string) => {
    const recordRef = ref(db, `attendance/${id}`);
    await remove(recordRef);
    setPaginatedRecords(prev => prev.filter(r => r.id !== id));
    setAllRecordsCount(prev => prev - 1);
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
