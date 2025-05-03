"use client";
import React from "react";
import {
    Brain,
    FileText,
    Upload,
    MessageCircle,
    User,
    Settings,
    CalendarCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SideBar = () => {
    const pathname = usePathname();

    const isActive = (path: string) => {
        return pathname === path || pathname?.startsWith(`${path}/`);
    };

    const links = [
        { href: "/dashboard", icon: FileText, label: "Dashboard" },
        { href: "/dashboard/upload", icon: Upload, label: "Upload Reports" },
        { href: "/dashboard/reports", icon: FileText, label: "My Reports" },
        { href: "/dashboard/appointments", icon: CalendarCheck, label: "Appointments" },
        { href: "/dashboard/chat", icon: MessageCircle, label: "AI Chat" },
        { href: "/dashboard/profile", icon: User, label: "Profile" },
        { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    ];

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
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive(link.href)
                                    ? "bg-teal-50 text-teal-600"
                                    : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <link.icon className="h-4 w-4" />
                            {link.label}
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default SideBar;