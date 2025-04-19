"use client";
import { useUser, UserButton } from "@clerk/nextjs";
import { Upload, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();

    if (!isLoaded) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    const handleUploadClick = () => {
        router.push("/dashboard/upload");
    };

    const handleViewReportsClick = () => {
        router.push("/dashboard/reports");
    };

    const handleStartChatClick = () => {
        router.push("/dashboard/chat");
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <div className="flex-1">
                <header className="flex h-16 items-center justify-between border-b bg-white px-6">
                    <h1 className="text-lg font-medium">Dashboard</h1>
                    <div className="flex items-center gap-4">
                        <UserButton afterSignOutUrl="/login" />
                    </div>
                </header>

                <main className="p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold">Welcome, {user?.firstName || "User"}!</h2>
                        <p className="text-gray-500">Here&apos;s an overview of your medical insights</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-lg border bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-medium">Upload a Report</h3>
                            <p className="mb-4 text-sm text-gray-500">
                                Upload a medical report to get instant AI analysis and insights
                            </p>
                            <Button 
                                className="w-full bg-teal-600 hover:bg-teal-700"
                                onClick={handleUploadClick}
                            >
                                <Upload className="mr-2 h-4 w-4" /> Upload Report
                            </Button>
                        </div>

                        <div className="rounded-lg border bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-medium">Recent Reports</h3>
                            <div className="space-y-3">
                                <p className="text-sm text-gray-500">No reports yet</p>
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={handleViewReportsClick}
                                >
                                    View All Reports
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-medium">AI Assistant</h3>
                            <p className="mb-4 text-sm text-gray-500">
                                Get answers to your health questions using our AI assistant
                            </p>
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={handleStartChatClick}
                            >
                                <MessageCircle className="mr-2 h-4 w-4" /> Start Chat
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}