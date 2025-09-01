
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

interface AttendanceContextType {
  records: AttendanceRecord[];
  addRecord: (record: Omit<AttendanceRecord, "id" | "timestamp">) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(
  undefined
);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const attendanceRef = ref(db, 'attendance');
    
    // Listen for real-time updates
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedRecords: AttendanceRecord[] = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key],
          }))
          .sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent
        setRecords(loadedRecords);
      } else {
        setRecords([]);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const addRecord = async (record: Omit<AttendanceRecord, "id" | "timestamp">) => {
    const attendanceRef = ref(db, 'attendance');
    const newRecord = {
      ...record,
      timestamp: serverTimestamp(),
    };
    await push(attendanceRef, newRecord);
  };
  
  const removeRecord = async (id: string) => {
    const recordRef = ref(db, `attendance/${id}`);
    await remove(recordRef);
  };

  return (
    <AttendanceContext.Provider value={{ records, addRecord, removeRecord }}>
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
