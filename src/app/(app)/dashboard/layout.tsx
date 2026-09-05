import SideBar from "@/components/SideBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-gray-50 pb-14 md:pb-0">
            <a href="#dashboard-content" className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:not-sr-only focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-950 focus:shadow-lg">
                Skip to dashboard content
            </a>
            <SideBar />
            <div id="dashboard-content" className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
