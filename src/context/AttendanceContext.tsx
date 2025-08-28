"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState, useEffect } from "react";

export interface AttendanceRecord {
  id: string;
  studentName: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  photo: string | null;
  floorNumber: string;
}

interface StoredRecords {
  timestamp: number;
  records: AttendanceRecord[];
}

interface AttendanceContextType {
  records: AttendanceRecord[];
  addRecord: (record: Omit<AttendanceRecord, "id">) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(
  undefined
);

const STORAGE_KEY = 'attendanceRecords';
const EXPIRATION_TIME = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const storedData: StoredRecords = JSON.parse(item);
        const now = new Date().getTime();

        if (now - storedData.timestamp < EXPIRATION_TIME) {
          setRecords(storedData.records);
        } else {
          // Data has expired, clear it
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to read from localStorage", error);
    }
  }, []);

  const addRecord = (record: Omit<AttendanceRecord, "id">) => {
    const newRecord = {
      ...record,
      id: new Date().toISOString() + Math.random(),
    };
    
    setRecords((prevRecords) => {
        const updatedRecords = [newRecord, ...prevRecords];
        try {
            const dataToStore: StoredRecords = {
                timestamp: new Date().getTime(),
                records: updatedRecords,
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (error) {
            console.error("Failed to write to localStorage", error);
        }
        return updatedRecords;
    });
  };

  return (
    <AttendanceContext.Provider value={{ records, addRecord }}>
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
