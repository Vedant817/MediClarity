"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Braces, CalendarIcon, Copy, Download, FileText, Share2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import Markdown from 'react-markdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Lab = { _id: string; canonicalName: string; test: string; value: number; unit?: string; refMin?: number; refMax?: number; flag: "normal" | "high" | "low" | "unknown"; sourceLab?: string }
type EducationCard = { _id: string; title: string; summary: string }

type Report = {
    _id: string
    fileUrl: string
    summary: string
    createdAt: string
    labs?: Lab[]
    education?: EducationCard[]
}

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([])
    const [selectedReport, setSelectedReport] = useState<Report | null>(null)
    const { userId } = useAuth()
    const [loading, setLoading] = useState(true)
    const [shareEmail, setShareEmail] = useState("")
    const [shareUrl, setShareUrl] = useState("")
    const [actionError, setActionError] = useState("")

    const openReport = async (report: Report) => {
        setSelectedReport(report)
        setShareUrl("")
        setActionError("")
        const response = await fetch(`/api/reports/${encodeURIComponent(report._id)}`)
        if (response.ok) setSelectedReport((await response.json()).report)
    }

    const createShare = async () => {
        if (!selectedReport) return
        setActionError("")
        const response = await fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId: selectedReport._id, email: shareEmail, expiresInDays: 7 }),
        })
        const data = await response.json()
        if (!response.ok) { setActionError(data.error || "Share link could not be created"); return }
        setShareUrl(data.url)
    }

    const downloadFhir = async () => {
        if (!selectedReport) return
        const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport._id)}/fhir`)
        if (!response.ok) { setActionError("FHIR export could not be created"); return }
        const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/fhir+json" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = `mediclarity-${selectedReport._id}.fhir.json`; anchor.click(); URL.revokeObjectURL(url)
    }

    const downloadDoctorPacket = async () => {
        if (!selectedReport) return
        const { jsPDF } = await import("jspdf")
        const pdf = new jsPDF({ unit: "pt", format: "a4" })
        const width = 500
        let y = 54
        pdf.setFontSize(20); pdf.text("MediClarity doctor packet", 46, y); y += 26
        pdf.setFontSize(9); pdf.setTextColor(80); pdf.text(`Report date: ${new Date(selectedReport.createdAt).toLocaleDateString()}`, 46, y); y += 28
        pdf.setTextColor(0); pdf.setFontSize(13); pdf.text("Abnormal structured results", 46, y); y += 18
        const abnormal = selectedReport.labs?.filter((lab) => lab.flag === "high" || lab.flag === "low") ?? []
        pdf.setFontSize(9)
        for (const lab of abnormal) { pdf.text(`${lab.canonicalName}: ${lab.value} ${lab.unit || ""} (${lab.flag})`, 52, y); y += 14 }
        if (abnormal.length === 0) { pdf.text("No abnormal structured rows available.", 52, y); y += 16 }
        y += 10; pdf.setFontSize(13); pdf.text("Plain-language summary", 46, y); y += 18
        pdf.setFontSize(9)
        for (const line of pdf.splitTextToSize(selectedReport.summary.replace(/[#*_`]/g, ""), width)) { if (y > 760) { pdf.addPage(); y = 48 } pdf.text(line, 46, y); y += 12 }
        y += 14; if (y > 700) { pdf.addPage(); y = 48 }
        pdf.setFontSize(13); pdf.text("Questions to ask", 46, y); y += 18; pdf.setFontSize(9)
        ;["Which results need follow-up?", "Should any test be repeated, and when?", "Do medicines or recent illness affect these results?"].forEach((question) => { pdf.text(`• ${question}`, 52, y); y += 14 })
        y += 18; pdf.setTextColor(120); pdf.text("For information only, not medical advice or diagnosis. Verify all rows against the source report.", 46, y, { maxWidth: width })
        pdf.save(`mediclarity-doctor-packet-${selectedReport._id}.pdf`)
    }

    useEffect(() => {
        const fetchReports = async () => {
            if (!userId) return

            const res = await fetch("/api/reports/getReports", {
                method: "POST",
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
                                    onClick={() => void openReport(report)}
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
            <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null) }}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold mb-2">📝 Report Details</DialogTitle>
                    </DialogHeader>
                    {selectedReport && (
                        <div className="flex flex-col space-y-4 text-sm">
                            
                            <a
                                href={selectedReport.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:underline font-bold text-lg"
                            >
                                View Full Report Here
                            </a>
                            <div className="max-h-[500px] overflow-y-auto prose prose-sm sm:prose-base text-gray-800">
                                <Markdown>{selectedReport.summary}</Markdown>
                            </div>
                            {selectedReport.education && selectedReport.education.length > 0 && <div className="grid gap-2 md:grid-cols-3">{selectedReport.education.map((card) => <div key={card._id} className="border p-3"><p className="font-semibold">{card.title}</p><p className="mt-1 text-xs text-gray-600">{card.summary}</p></div>)}</div>}
                            <div className="grid gap-2 border-t pt-4 md:grid-cols-[1fr_auto_auto_auto]">
                                <Input value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="Doctor or family email (optional)" type="email" />
                                <Button variant="outline" onClick={createShare}><Share2 className="mr-2 h-4 w-4" />Share 7 days</Button>
                                <Button variant="outline" onClick={downloadDoctorPacket}><Download className="mr-2 h-4 w-4" />Doctor PDF</Button>
                                <Button variant="outline" onClick={downloadFhir}><Braces className="mr-2 h-4 w-4" />FHIR</Button>
                            </div>
                            {shareUrl && <div className="flex items-center gap-2 border border-teal-200 bg-teal-50 p-3"><code className="min-w-0 flex-1 truncate text-xs">{shareUrl}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(shareUrl)}><Copy className="h-4 w-4" /></Button><a className="text-xs font-semibold text-teal-700" href={`https://wa.me/?text=${encodeURIComponent(`Medical report: ${shareUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a></div>}
                            {actionError && <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>}
                            <div className="text-red-600 font-semibold">For information only, not medical advice or diagnosis. Verify structured rows against the original report and consult a qualified clinician.</div>
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
