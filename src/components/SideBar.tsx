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
    LineChart,
    Pill,
    BookOpen,
    Stethoscope,
    KeyRound,
    Building2,
    Mic2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SideBar = () => {
    const pathname = usePathname();

    const isActive = (path: string) => {
        return path === "/dashboard" ? pathname === path : pathname === path || pathname?.startsWith(`${path}/`);
    };

    const groups = [
        { label: "Health record", links: [
            { href: "/dashboard", icon: FileText, label: "Dashboard" },
            { href: "/dashboard/upload", icon: Upload, label: "Upload reports" },
            { href: "/dashboard/reports", icon: FileText, label: "Reports & sharing" },
            { href: "/dashboard/trends", icon: LineChart, label: "Lab trends" },
        ] },
        { label: "Care", links: [
            { href: "/dashboard/meds", icon: Pill, label: "Medications" },
            { href: "/dashboard/learn", icon: BookOpen, label: "Learn" },
            { href: "/dashboard/triage", icon: Stethoscope, label: "Care direction" },
            { href: "/dashboard/appointments", icon: CalendarCheck, label: "Appointments" },
            { href: "/dashboard/chat", icon: MessageCircle, label: "Record chat" },
            { href: "/dashboard/voice", icon: Mic2, label: "Voice assistant" },
        ] },
        { label: "Account", links: [
            { href: "/dashboard/api-keys", icon: KeyRound, label: "Lab API" },
            { href: "/dashboard/lab-brand", icon: Building2, label: "Lab branding" },
            { href: "/dashboard/profile", icon: User, label: "Profile" },
            { href: "/dashboard/settings", icon: Settings, label: "Settings" },
        ] },
    ];
    const links = groups.flatMap((group) => group.links);
    const mobileLinks = links.filter((link) => ["/dashboard", "/dashboard/upload", "/dashboard/reports", "/dashboard/trends", "/dashboard/voice"].includes(link.href));

    return (
        <>
        <aside className="hidden w-64 shrink-0 border-r bg-white md:block">
            <div className="flex h-16 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2">
                    <Brain className="h-6 w-6 text-teal-600" aria-hidden="true" />
                    <span className="text-xl font-bold">MediClarity</span>
                </Link>
            </div>
            <nav className="space-y-5 p-4">
                {groups.map((group) => <div key={group.label}>
                    <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">{group.label}</p>
                    <div className="space-y-1">{group.links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            aria-current={isActive(link.href) ? "page" : undefined}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive(link.href)
                                    ? "bg-teal-50 text-teal-600"
                                    : "text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <link.icon className="h-4 w-4" aria-hidden="true" />
                            {link.label}
                        </Link>
                    ))}</div>
                </div>)}
            </nav>
        </aside>
        <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white md:hidden" aria-label="Dashboard navigation">
            {mobileLinks.map((link) => <Link key={link.href} href={link.href} aria-label={link.label} aria-current={isActive(link.href) ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] ${isActive(link.href) ? "text-teal-700" : "text-slate-500"}`}><link.icon className="h-4 w-4" aria-hidden="true" /><span className="truncate" aria-hidden="true">{link.label.split(" ")[0]}</span></Link>)}
        </nav>
        </>
    );
};

export default SideBar;
