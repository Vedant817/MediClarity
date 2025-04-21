"use client"
import React from 'react'
import { Brain, FileText, Upload, MessageCircle, User, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SideBar = () => {
    const pathname = usePathname();
    
    const isActive = (path: string) => {
        return pathname === path || pathname?.startsWith(`${path}/`);
    };

    return (
        <div className="w-64 border-r bg-white">
            <div className="flex h-16 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2">
                    <Brain className="h-6 w-6 text-teal-600" />
                    <span className="text-xl font-bold">MediClarity</span>
                </Link>
            </div>
            <nav className="p-4">
                <div className="space-y-1">
                    <Link
                        href="/dashboard"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard") && pathname === "/dashboard"
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <FileText className="h-4 w-4" />
                        Dashboard
                    </Link>
                    <Link
                        href="/dashboard/upload"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard/upload")
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <Upload className="h-4 w-4" />
                        Upload Reports
                    </Link>
                    <Link
                        href="/dashboard/reports"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard/reports")
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <FileText className="h-4 w-4" />
                        My Reports
                    </Link>
                    <Link
                        href="/dashboard/chat"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard/chat")
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <MessageCircle className="h-4 w-4" />
                        AI Chat
                    </Link>
                    <Link
                        href="/dashboard/profile"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard/profile")
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <User className="h-4 w-4" />
                        Profile
                    </Link>
                    <Link
                        href="/dashboard/settings"
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive("/dashboard/settings")
                                ? "bg-teal-50 text-teal-600"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                </div>
            </nav>
        </div>
    )
}

export default SideBar