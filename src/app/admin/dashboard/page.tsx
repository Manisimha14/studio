
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
import { Users, Trash2, Loader2, ListX, ArrowDown, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { playSound } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function AdminDashboard() {
  const { 
    paginatedRecords, 
    allRecordsCount, 
    loading, 
    removeRecord,
    fetchMoreRecords,
    loadingMore,
    hasMore,
    fetchInitialRecords,
  } = useAttendance();
  const { toast } = useToast();
  
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    fetchInitialRecords();
  }, [fetchInitialRecords]);

  const handleDelete = useCallback(async () => {
    playSound('delete');
    if (recordToDelete !== null) {
      setIsDeleting(true);
      try {
        await removeRecord(recordToDelete);
        playSound('success');
        toast({
          title: "Record Deleted",
          description: "The attendance record has been successfully deleted.",
        });
      } catch (error) {
        playSound('error');
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
  }, [recordToDelete, removeRecord, toast]);

  return (
    <Card className="w-full max-w-6xl fade-in shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Live Attendance Records</CardTitle>
          <CardDescription>
            Showing {paginatedRecords.length} of {allRecordsCount} total records.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <Badge variant="secondary" className="text-lg">
            {allRecordsCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span>Loading initial records...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : paginatedRecords.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ListX className="h-8 w-8" />
                                <span>No attendance records found.</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow key={record.id} className="fade-in transition-colors hover:bg-muted/50">
                      <TableCell>
                        {record.photo ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Image
                                src={record.photo}
                                alt={`Snapshot of ${record.studentName}`}
                                width={64}
                                height={64}
                                className="h-16 w-16 rounded-md object-cover transition-transform hover:scale-110 cursor-pointer"
                              />
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <Image
                                src={record.photo}
                                alt={`Snapshot of ${record.studentName}`}
                                width={800}
                                height={600}
                                className="w-full rounded-lg"
                              />
                               {record.livenessChallenge && (
                                <Alert className="mt-4">
                                  <Sparkles className="h-4 w-4" />
                                  <AlertTitle>Liveness Challenge</AlertTitle>
                                  <AlertDescription>
                                    Admin, please verify if the student is performing this action: <strong>{record.livenessChallenge}</strong>
                                  </AlertDescription>
                                </Alert>
                              )}
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            No Photo
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.studentName}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">Floor: {record.floorNumber}</div>
                         <div className="text-xs text-muted-foreground">
                          {record.location.latitude.toFixed(4)},{" "}
                          {record.location.longitude.toFixed(4)}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(record.timestamp), "PPpp")}</TableCell>
                      <TableCell className="text-right">
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => { playSound('click'); setRecordToDelete(record.id); }}
                              disabled={isDeleting && recordToDelete === record.id}
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
                )}
              </TableBody>
            </Table>
        </div>
         <div className="mt-6 flex items-center justify-center">
            {hasMore && !loading && (
                <Button
                    variant="outline"
                    onClick={() => { playSound('click'); fetchMoreRecords();}}
                    disabled={loadingMore}
                >
                    {loadingMore ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <ArrowDown className="mr-2 h-4 w-4" />
                    )}
                    Load More
                </Button>
            )}
            {!hasMore && paginatedRecords.length > 0 && !loading && (
                <div className="text-sm text-muted-foreground">
                    You've reached the end of the list.
                </div>
            )}
         </div>
      </CardContent>
    </Card>
  );
}
