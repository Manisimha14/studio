
"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, push, onValue, remove, serverTimestamp } from "firebase/database";

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
  records: AttendanceRecord[];
  loading: boolean;
  addRecord: (record: NewRecord) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(
  undefined
);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const attendanceRef = ref(db, 'attendance');
    
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      setLoading(true);
      const data = snapshot.val();
      if (data) {
        const loadedRecords: AttendanceRecord[] = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => b.timestamp - a.timestamp); 
        setRecords(loadedRecords);
      } else {
        setRecords([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
    <AttendanceContext.Provider value={{ records, loading, addRecord, removeRecord }}>
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
