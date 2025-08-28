"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

export interface AttendanceRecord {
  id: string;
  studentName: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  photo: string | null;
}

interface AttendanceContextType {
  records: AttendanceRecord[];
  addRecord: (record: Omit<AttendanceRecord, "id">) => void;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(
  undefined
);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const addRecord = (record: Omit<AttendanceRecord, "id">) => {
    const newRecord = {
      ...record,
      id: new Date().toISOString() + Math.random(),
    };
    setRecords((prevRecords) => [newRecord, ...prevRecords]);
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
