import SideBar from "@/components/SideBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <SideBar />
            {children}
        </div>
    );
}