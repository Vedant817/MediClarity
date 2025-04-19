"use client"
import { useState, ChangeEvent } from "react";
import { Upload, File, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import Markdown from 'react-markdown'

export default function UploadReportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [ocrResult, setOcrResult] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setFileUrl("");
        setUploadStatus(null);
        setOcrResult(null);
    };

    const simulateProgress = () => {
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 95) {
                    clearInterval(interval);
                    return 95;
                }
                return prev + 5;
            });
        }, 100);
        return interval;
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
            const progressInterval = simulateProgress();

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();

            if (data.message === "success") {
                setFileUrl(data.imgUrl);
                setUploadProgress(100);
                setUploadStatus("success");

                toast.success("Upload successful", {
                    description: "Your report has been uploaded successfully."
                });

                const ocrResponse = await fetch("/api/ocr", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ documentUrl: data.imgUrl }),
                });

                const ocrData = await ocrResponse.json();
                console.log(ocrData.extractedText);

                if (ocrData) {
                    const fullText = ocrData.extractedText.map(page => page.text).join("\n\n");

                    setOcrResult(fullText);

                    toast.success("OCR extraction successful", {
                        description: "Text has been successfully extracted from the document.",
                    });
                } else {
                    toast.error("OCR failed", {
                        description: "Could not extract text from the uploaded file.",
                    });
                }

            } else {
                throw new Error("Upload failed");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
            setUploadStatus("error");

            toast.error("Upload failed", {
                description: "There was an error uploading your report. Please try again.",
            });
        } finally {
            setUploading(false);
        }
    };

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
                                accept="image/*,.pdf"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <Upload className="h-10 w-10 text-gray-400" />
                                    <p className="text-sm font-medium">Drag and drop or click to upload</p>
                                    <p className="text-xs text-gray-500">Support for images and PDF files</p>
                                </div>
                            </label>
                        </div>

                        {file && (
                            <div className="flex items-center space-x-2 rounded-md bg-gray-50 p-3">
                                <File className="h-5 w-5 text-teal-600" />
                                <span className="flex-1 truncate text-sm">{file.name}</span>
                                {uploadStatus === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {uploadStatus === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                            </div>
                        )}

                        {uploading && (
                            <div className="space-y-2">
                                <Progress value={uploadProgress} className="h-2 w-full" />
                                <p className="text-xs text-gray-500">Uploading... {uploadProgress}%</p>
                            </div>
                        )}

                        {fileUrl && (
                            <div className="space-y-2 rounded-md bg-green-50 p-3">
                                <p className="text-sm font-medium text-green-800">Upload successful!</p>
                            </div>
                        )}

                        {ocrResult && (
                            <div className="space-y-2 rounded-md bg-blue-50 p-3">
                                <p className="text-sm font-medium text-blue-800">Extracted Text (OCR):</p>
                                <pre className="whitespace-pre-wrap text-xs text-blue-700">
                                    <Markdown>{ocrResult}</Markdown>
                                </pre>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="w-full bg-teal-600 hover:bg-teal-700"
                        >
                            {uploading ? "Uploading..." : "Upload Report"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </ScrollArea>
    );
}
