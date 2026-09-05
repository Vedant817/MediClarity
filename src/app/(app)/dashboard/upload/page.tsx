"use client"
import { useState, ChangeEvent, useEffect, useCallback } from "react";
import { Upload, File, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import Markdown from 'react-markdown'
import ChatWithAI from "@/components/ChatWithAI";
import TextToSpeechButton from "@/components/TextToSpeechButton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select"

const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'pa', label: 'Punjabi' },
    { code: 'es', label: 'Spanish' },
    { code: 'ar', label: 'Arabic' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'fr', label: 'French' },
];

export default function UploadReportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState("");
    const [statusMessage, setStatusMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<string | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [selectedLang, setSelectedLang] = useState('en');
    const [translatedSummary, setTranslatedSummary] = useState('');
    const [sourceLab, setSourceLab] = useState('');
    const [sourceCountry, setSourceCountry] = useState('');
    const [reportDate, setReportDate] = useState('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setFileUrl("");
        setUploadStatus(null);
        setOcrResult(null);
        setSummary(null);
        setTranslatedSummary('');
        setShowChat(false);
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error("No file selected", {
                description: "Please select a file to upload.",
            });
            return;
        }

        try {
            setUploading(true);
            setUploadStatus(null);

            const formData = new FormData();
            formData.append("file", file);
            if (sourceLab.trim()) formData.append("sourceLab", sourceLab.trim());
            if (sourceCountry.trim()) formData.append("sourceCountry", sourceCountry.trim());
            if (reportDate) formData.append("reportDate", reportDate);

            setStatusMessage("Uploading, reading, and structuring your report…");
            const response = await fetch("/api/reports/ingest", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const failure = await response.json().catch(() => ({}));
                throw new Error(response.status === 402 ? "Free plan limit reached. Compare plans to upload another report." : failure.error || "Report processing failed");
            }

            const data = await response.json();
            if (!data.report?.fileUrl || !data.report?.summary || !data.report?.ocr) {
                throw new Error("The server returned an incomplete report");
            }

            setFileUrl(data.report.fileUrl);
            setOcrResult(data.report.ocr);
            setSummary(data.report.summary);
            setUploadStatus("success");
            toast.success("Report processed and saved", {
                description: `${data.labResultCount ?? 0} structured lab result${data.labResultCount === 1 ? "" : "s"} saved.`,
            });
        } catch (error) {
            console.error("Error uploading file:", error);
            setUploadStatus("error");

            toast.error("Upload failed", {
                description: error instanceof Error ? error.message : "There was an error uploading your report. Please try again.",
            });
        } finally {
            setStatusMessage("");
            setUploading(false);
            setFile(null);
        }
    };

    const handleLanguageChange = useCallback(async (value: string) => {
        const lang = value;
        setSelectedLang(lang);

        if (summary) {
            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: summary, targetLang: lang }),
                });

                const data = await response.json();
                setTranslatedSummary(data.translatedText);
            } catch (error) {
                console.error('Translation error:', error);
            }
        }
    }, [summary]);

    useEffect(() => {
        if (summary && selectedLang === 'en') {
            setTranslatedSummary(summary);
        } else if (summary && selectedLang !== 'en') {
            handleLanguageChange(selectedLang);
        }
    }, [summary, selectedLang, handleLanguageChange]);

    return (
        <ScrollArea className="h-screen w-full overflow-hidden">
            <div className="container mx-auto p-4">
                <h1 className="mb-6 text-2xl font-bold">Upload Medical Reports</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Report</CardTitle>
                        <CardDescription>
                            Upload your medical reports for AI analysis and insights.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                            <Input
                                id="file-upload"
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <Upload className="h-10 w-10 text-gray-400" />
                                    <p className="text-sm font-medium">Drag and drop or click to upload</p>
                                    <p className="text-xs text-gray-500">Support for images and PDF files</p>
                                </div>
                            </label>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <Input value={sourceLab} onChange={(event) => setSourceLab(event.target.value)} maxLength={160} placeholder="Source lab (optional)" aria-label="Source lab" />
                            <Input value={sourceCountry} onChange={(event) => setSourceCountry(event.target.value)} maxLength={80} placeholder="Country, e.g. India" aria-label="Source country" />
                            <Input value={reportDate} onChange={(event) => setReportDate(event.target.value)} type="date" aria-label="Report date" />
                        </div>
                        <p className="text-xs text-gray-500">Source metadata keeps results from different labs and countries traceable. Printed reference ranges remain authoritative.</p>

                        {file && (
                            <div className="flex items-center space-x-2 rounded-md bg-gray-50 p-3">
                                <File className="h-5 w-5 text-teal-600" />
                                <span className="flex-1 truncate text-sm">{file.name}</span>
                                {uploadStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {uploadStatus === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                            </div>
                        )}
                        {uploading && (
                            <div className="flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 p-3">
                                <span className="h-3 w-3 animate-pulse rounded-full bg-teal-600" aria-hidden="true" />
                                <p className="text-xs text-teal-900">{statusMessage}</p>
                            </div>
                        )}
                        {fileUrl && (
                            <div className="space-y-2 rounded-md bg-green-50 p-3">
                                <p className="text-sm font-medium text-green-800">Upload successful!</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="w-full bg-teal-600 hover:bg-teal-700"
                        >
                            {uploading ? statusMessage : "Upload Report"}
                        </Button>
                    </CardFooter>
                    {summary && (
                        <div className="space-y-4 p-4">
                            <div className="space-y-2 rounded-md bg-yellow-50 p-3">
                                <p className="text-sm font-medium text-yellow-800">Summary:</p>
                                <pre className="whitespace-pre-wrap text-xs text-yellow-700">
                                    <Markdown>{translatedSummary || summary}</Markdown>
                                </pre>
                            </div>
                            {!showChat && (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        onClick={() => setShowChat(true)}
                                        className="w-[50%] bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                                    >
                                        Have a chat with report
                                    </Button>
                                    <div className="w-full">
                                        <TextToSpeechButton text={translatedSummary || summary} lang={selectedLang} />
                                    </div>
                                    <div className="flex w-full items-center gap-2">
                                        <Select value={selectedLang} onValueChange={handleLanguageChange} >
                                            <SelectTrigger className="w-full" aria-label="Summary language">
                                                <SelectValue placeholder="Select a language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup className="w-full items-center justify-center">
                                                    <SelectLabel>Languages</SelectLabel>
                                                    {languageOptions.map((lang) => (
                                                        <SelectItem key={lang.code} value={lang.code}>
                                                            {lang.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {showChat && summary && ocrResult && (
                        <div className="p-4">
                            <ChatWithAI summary={summary} ocr={ocrResult} />
                        </div>
                    )}
                </Card>
            </div>
        </ScrollArea>
    );
}
