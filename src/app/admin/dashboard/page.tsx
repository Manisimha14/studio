
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
import { Users, Trash2, Loader2, ListX, ArrowDown, Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { playSound } from "@/lib/utils";
import { verifyImage, type VerifyImageOutput } from "@/ai/flows/verify-image-flow";


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
  
  const [verifyingImageId, setVerifyingImageId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerifyImageOutput | null>(null);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);

  useEffect(() => {
    fetchInitialRecords();
  }, [fetchInitialRecords]);

  const handleDelete = async () => {
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
  };

  const handleVerifyImage = async (recordId: string, photo: string | null) => {
    if (!photo) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "No photo available for this record.",
      });
      return;
    }

    setVerifyingImageId(recordId);
    setVerificationResult(null);

    try {
      const result = await verifyImage({ photoDataUri: photo });
      setVerificationResult(result);
      setIsVerificationDialogOpen(true);
    } catch (error) {
      console.error("Verification failed", error);
      toast({
        variant: "destructive",
        title: "AI Verification Failed",
        description: "The authenticity check could not be completed. Please try again.",
      });
    } finally {
      setVerifyingImageId(null);
    }
  }


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
                  <TableHead>Floor</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span>Loading initial records...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : paginatedRecords.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <ListX className="h-8 w-8" />
                                <span>No attendance records found.</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow key={record.id} className="transition-colors hover:bg-muted/50">
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
                            </DialogContent>
                          </Dialog>
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
                      <TableCell>
                         <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyImage(record.id, record.photo)}
                            disabled={verifyingImageId === record.id || !record.photo}
                          >
                            {verifyingImageId === record.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Verify
                          </Button>
                      </TableCell>
                      <TableCell className="text-right">
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => { playSound('click'); setRecordToDelete(record.id); }}
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

        <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="text-primary"/>
                AI Verification Result
              </DialogTitle>
              <DialogDescription>
                The AI has analyzed the image for authenticity.
              </DialogDescription>
            </DialogHeader>
            {verificationResult && (
              <div className="space-y-4">
                 <div className={`flex items-center gap-3 rounded-lg p-3 ${verificationResult.isAuthentic ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {verificationResult.isAuthentic ? <ShieldCheck className="h-6 w-6 text-green-600"/> : <ShieldAlert className="h-6 w-6 text-red-600"/>}
                  <div className="flex-1">
                    <p className="font-semibold">Authentic Image</p>
                    <p className="text-sm text-muted-foreground">{verificationResult.isAuthentic ? 'The image appears to be a genuine, direct photo.' : 'The image seems to be a photo of a screen or another photo.'}</p>
                  </div>
                 </div>
                 <div className={`flex items-center gap-3 rounded-lg p-3 ${!verificationResult.hasReflections ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  {!verificationResult.hasReflections ? <ShieldCheck className="h-6 w-6 text-green-600"/> : <ShieldAlert className="h-6 w-6 text-red-600"/>}
                  <div className="flex-1">
                    <p className="font-semibold">No Reflections</p>
                    <p className="text-sm text-muted-foreground">{!verificationResult.hasReflections ? 'No significant reflections were detected.' : 'Reflections were detected in the image.'}</p>
                  </div>
                 </div>
                 <div className="rounded-lg border bg-secondary/50 p-3">
                    <p className="font-semibold">AI Reasoning</p>
                    <p className="text-sm text-muted-foreground">{verificationResult.reason}</p>
                 </div>
              </div>
            )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button>Close</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
