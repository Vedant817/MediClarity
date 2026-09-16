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
    Loader2,
    type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sidebar link with instant pending feedback. useLinkStatus flips to
 * `pending` the moment the link is clicked (before the destination
 * finishes loading), so navigation never feels dead. The status hook must
 * live in a descendant of <Link>, so visuals sit on the inner element.
 */
const SidebarNavLinkContent = ({ active, icon: Icon, label }: {
    active: boolean;
    icon: LucideIcon;
    label: string;
}) => {
    const { pending } = useLinkStatus();
    return (
        <span
            aria-disabled={pending || undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-opacity ${active
                    ? "bg-teal-50 text-teal-600"
                    : "text-gray-600 hover:bg-gray-100"
                }${pending ? " opacity-60" : ""}`
            }
        >
            {pending
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Icon className="h-4 w-4" aria-hidden="true" />}
            {label}
        </span>
    );
};

const SidebarNavLink = ({ href, active, icon, label }: {
    href: string;
    active: boolean;
    icon: LucideIcon;
    label: string;
}) => {
    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className="block rounded-md focus-visible:outline-2 focus-visible:outline-teal-600"
        >
            <SidebarNavLinkContent active={active} icon={icon} label={label} />
        </Link>
    );
};

const MobileNavLinkContent = ({ active, icon: Icon, label }: {
    active: boolean;
    icon: LucideIcon;
    label: string;
}) => {
    const { pending } = useLinkStatus();
    return (
        <span
            className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] transition-opacity ${active ? "text-teal-700" : "text-slate-500"}${pending ? " opacity-60" : ""}`}
        >
            {pending
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Icon className="h-4 w-4" aria-hidden="true" />}
            <span className="truncate" aria-hidden="true">{label.split(" ")[0]}</span>
        </span>
    );
};

const MobileNavLink = ({ href, active, icon, label }: {
    href: string;
    active: boolean;
    icon: LucideIcon;
    label: string;
}) => {
    return (
        <Link
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="block min-w-0 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
            <MobileNavLinkContent active={active} icon={icon} label={label} />
        </Link>
    );
};

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
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-white md:flex">
            <div className="flex h-16 shrink-0 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2">
                    <Brain className="h-6 w-6 text-teal-600" aria-hidden="true" />
                    <span className="text-xl font-bold">MediClarity</span>
                </Link>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto p-4">
                {groups.map((group) => <div key={group.label}>
                    <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">{group.label}</p>
                    <div className="space-y-1">{group.links.map((link) => (
                        <SidebarNavLink
                            key={link.href}
                            href={link.href}
                            active={isActive(link.href)}
                            icon={link.icon}
                            label={link.label}
                        />
                    ))}</div>
                </div>)}
            </nav>
        </aside>
        <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white md:hidden" aria-label="Dashboard navigation">
            {mobileLinks.map((link) => <MobileNavLink key={link.href} href={link.href} active={isActive(link.href)} icon={link.icon} label={link.label} />)}
        </nav>
        </>
    );
};

export default SideBar;
