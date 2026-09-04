"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  CalendarCheck,
  Clock,
  FileText,
  MessageCircle,
  Activity,
  Pill,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Report = {
  _id: string;
  summary: string;
  createdAt: string;
};

type Appointment = {
  _id: string;
  providerId: string;
  date: string;
  time?: string;
  reason: string;
  status: string;
};

type DashboardPayload = {
  recentReports: Report[];
  upcomingAppointments: Appointment[];
  metrics: {
    totalReports: number;
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
  };
  latestAbnormalLabs: Array<{
    _id: string;
    canonicalName: string;
    value: number;
    unit?: string;
    flag: "high" | "low";
    date: string;
  }>;
  activeMedicationCount: number;
  plan: "free" | "pro" | "lab";
  reportQuota: { used: number; limit: number | null };
};

function formatProviderId(providerId: string) {
  return providerId
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch("/api/user-data");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as DashboardPayload;
        setData(payload);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isSignedIn) {
      fetchDashboardData();
    }
  }, [isSignedIn]);

  const recentReportPreview = useMemo(() => {
    if (!data?.recentReports?.length) {
      return [];
    }

    return data.recentReports.slice(0, 3);
  }, [data]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Health Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome back, {user?.firstName || "there"}. Here is your latest health
          activity.
        </p>
      </header>

      <main className="space-y-6 p-6">
        {data?.plan === "free" && data.reportQuota.limit !== null && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-orange-500 bg-orange-50 px-4 py-3 text-sm text-orange-950">
            <span><strong>{data.reportQuota.used}/{data.reportQuota.limit}</strong> free report uploads used this month.</span>
            <Link className="font-semibold underline underline-offset-4" href="/#pricing">Compare plans</Link>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "--" : (data?.metrics.totalReports ?? 0)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "--" : (data?.metrics.totalAppointments ?? 0)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Upcoming Visits
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "--" : (data?.metrics.upcomingAppointments ?? 0)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Completed Visits
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {loading ? "--" : (data?.metrics.completedAppointments ?? 0)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-rose-600" />Latest abnormal labs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!loading && (data?.latestAbnormalLabs.length ?? 0) === 0 && <p className="text-sm text-gray-500">No high or low structured results yet.</p>}
              {data?.latestAbnormalLabs.map((lab) => (
                <div key={lab._id} className="flex items-center justify-between border-b pb-3 text-sm last:border-0">
                  <div><p className="font-medium">{lab.canonicalName}</p><p className="text-xs text-gray-500">{new Date(lab.date).toLocaleDateString()}</p></div>
                  <Badge variant="destructive">{lab.value} {lab.unit} · {lab.flag}</Badge>
                </div>
              ))}
              <Button asChild variant="outline" className="w-full"><Link href="/dashboard/trends">Open lab trends</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-teal-600" />Medication list</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-semibold">{loading ? "--" : (data?.activeMedicationCount ?? 0)}</p>
              <p className="text-sm text-gray-500">Active medications extracted from reports or added manually.</p>
              <Button asChild variant="outline" className="w-full"><Link href="/dashboard/meds">Review medications</Link></Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-teal-600" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.upcomingAppointments || []).length === 0 && !loading && (
                <p className="text-sm text-gray-500">
                  No upcoming appointments scheduled.
                </p>
              )}

              {(data?.upcomingAppointments || []).map((appointment) => (
                <div key={appointment._id} className="rounded-md border p-3">
                  <p className="font-medium">
                    {formatProviderId(appointment.providerId)}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(appointment.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {appointment.time ? ` at ${appointment.time}` : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    {appointment.reason}
                  </p>
                </div>
              ))}

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/appointments">
                  View appointment timeline
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReportPreview.length === 0 && !loading && (
                <p className="text-sm text-gray-500">
                  No reports available yet.
                </p>
              )}

              {recentReportPreview.map((report, index) => (
                <div key={report._id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Report {index + 1}</p>
                    <Badge variant="outline">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                    {report.summary}
                  </p>
                </div>
              ))}

              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/reports">Open all reports</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/dashboard/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Report
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/chat">
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask AI Assistant
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/appointments">Schedule Appointment</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
