"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import Image from "next/image";
import { useAttendance } from "@/context/AttendanceContext";

export default function AdminDashboard() {
  const { records } = useAttendance();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Live Attendance Records</CardTitle>
          <CardDescription>
            Showing all attendance records marked by students.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <Badge variant="secondary" className="text-lg">
            {records.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Floor</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Location (Lat, Long)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length > 0 ? (
              records.map((record) => (
                <TableRow key={record.id}>
                   <TableCell>
                    {record.photo ? (
                      <Image
                        src={record.photo}
                        alt={`Snapshot of ${record.studentName}`}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-md object-cover"
                      />
                    ) : (
                      "No Photo"
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {record.studentName}
                  </TableCell>
                  <TableCell>{record.floorNumber}</TableCell>
                  <TableCell>{record.timestamp}</TableCell>
                  <TableCell>
                    {record.location.latitude.toFixed(4)},{" "}
                    {record.location.longitude.toFixed(4)}
                  </TableCell>

                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No attendance records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
