
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
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, ArrowRight, Trash2, Loader2, ListX } from "lucide-react";
import Image from "next/image";
import { useState, useMemo, useEffect } from "react";
import { useAttendance } from "@/context/AttendanceContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';


const RECORDS_PER_PAGE = 5;

export default function AdminDashboard() {
  const { records, loading, removeRecord } = useAttendance();
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset to page 1 if records change
  useEffect(() => {
    setCurrentPage(1);
  }, [records.length]);

  const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);

  const currentRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    return records.slice(startIndex, startIndex + RECORDS_PER_PAGE);
  }, [records, currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleDelete = async () => {
    if (recordToDelete !== null) {
      setIsDeleting(true);
      try {
        await removeRecord(recordToDelete);
        toast({
          title: "Record Deleted",
          description: "The attendance record has been successfully deleted.",
        });
        // If it was the last record on the page, and not page 1, go back.
        if (currentRecords.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
      } catch (error) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete the record. Please try again."
        });
      } finally {
        setIsDeleting(false);
        setRecordToDelete(null);
      }
    }
  };


  return (
    <Card className="w-full max-w-4xl">
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
        <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span>Waiting for attendance records...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : records.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ListX className="h-8 w-8" />
                                <span>No attendance records found.</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : currentRecords.length > 0 ? (
                  currentRecords.map((record) => (
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
                      <TableCell>{format(new Date(record.timestamp), "PPpp")}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {record.location.latitude.toFixed(4)},{" "}
                          {record.location.longitude.toFixed(4)}
                        </div>

                      </TableCell>
                      <TableCell className="text-right">
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setRecordToDelete(record.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the attendance record.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setRecordToDelete(null)}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                       No records on this page.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </div>
         <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
