"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarIcon, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import Markdown from 'react-markdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Report = {
    _id: string
    fileUrl: string
    summary: string
    createdAt: string
}

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [selectedReport, setSelectedReport] = useState<Report | null>(null)
    const { userId } = useAuth()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReports = async () => {
            if (!userId) return

            const res = await fetch("/api/reports/getReports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            })

            const data = await res.json()
            setReports(data.reports || [])
            setLoading(false)
        }

        fetchReports();
    }, [userId])

    return (
        <>
            <ScrollArea className="h-screen w-full overflow-hidden">
                <div className="container mx-auto p-4">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-bold tracking-tight">Previous Reports</h1>
                        <Badge variant="outline" className="px-3 py-1">
                            {reports.length} Reports
                        </Badge>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            <ReportSkeleton />
                            <ReportSkeleton />
                            <ReportSkeleton />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reports.map((report, index) => (
                                <div
                                    key={report._id}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedReport(report)}
                                >
                                    <Card className="transition-all hover:shadow-md">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center text-lg">
                                                <FileText className="mr-2 h-5 w-5 text-muted-foreground" />
                                                Report {index + 1}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="pb-2">
                                            <div className="text-sm text-muted-foreground line-clamp-2">
                                                <Markdown>{report.summary}</Markdown>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="text-xs text-muted-foreground pt-0 flex items-center">
                                            <CalendarIcon className="mr-1 h-3 w-3" />
                                            {new Date(report.createdAt).toLocaleString()}
                                        </CardFooter>
                                    </Card>
                                </div>
                            ))}
                            {reports.length === 0 && !loading && (
                                <Card className="p-8 text-center">
                                    <p className="text-muted-foreground mb-2">No reports found</p>
                                    <p className="text-sm text-muted-foreground">Upload your first report to get started</p>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
            <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
                <DialogContent className="min-w-[900px]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold mb-2">📝 Report Details</DialogTitle>
                    </DialogHeader>
                    {selectedReport && (
                        <div className="flex flex-col space-y-4 text-sm">
                            
                            <a
                                href={selectedReport.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                View Full Report
                            </a>
                            <div className="max-h-[500px] overflow-y-auto prose prose-sm sm:prose-base text-gray-800">
                                <Markdown>{selectedReport.summary}</Markdown>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

function ReportSkeleton() {
    return (
        <Card className="w-full">
            <CardHeader className="pb-2">
                <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="pb-2">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
            </CardContent>
            <CardFooter className="pt-0">
                <Skeleton className="h-3 w-32" />
            </CardFooter>
        </Card>
    )
}