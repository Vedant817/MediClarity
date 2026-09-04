import SideBar from "@/components/SideBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-gray-50 pb-14 md:pb-0">
            <SideBar />
            {children}
        </div>
    );
}
