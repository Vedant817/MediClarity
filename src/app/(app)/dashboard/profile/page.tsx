"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  FileText,
  LineChart,
  Mail,
  Phone,
  Pill,
  Upload,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RecentReport = {
  _id: string;
  summary: string;
  createdAt: string;
};

type ProfileAppointment = {
  _id: string;
  providerId: string;
  date: string;
  time?: string;
  reason: string;
  status: string;
};

type AbnormalLab = {
  _id: string;
  canonicalName: string;
  value: number;
  unit?: string;
  flag: "high" | "low";
  date: string;
};

type ProfileData = {
  recentReports: RecentReport[];
  upcomingAppointments: ProfileAppointment[];
  metrics: {
    totalReports: number;
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
  };
  latestAbnormalLabs: AbnormalLab[];
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

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export default function ProfilePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const response = await fetch("/api/user-data");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ProfileData;
        setData(payload);
      } catch (error) {
        console.error("Failed to fetch profile data:", error);
      }
    };

    if (isSignedIn) {
      fetchProfileData();
    }
  }, [isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center">
        Loading...
      </div>
    );
  }

  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress || "Not provided";
  const primaryPhone = user?.primaryPhoneNumber?.phoneNumber || "Not provided";

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-gray-500">
          Review your account details and care activity.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-teal-600" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{user?.fullName || "Not provided"}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-500" />
              <span>{primaryEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>{primaryPhone}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="outline">
                Member since{" "}
                {new Date(user?.createdAt || Date.now()).getFullYear()}
              </Badge>
              <Badge variant="default" className="capitalize">
                {data?.plan ?? "free"} plan
              </Badge>
              {data && data.reportQuota.limit !== null && (
                <span className="text-xs text-gray-500">
                  {data.reportQuota.used}/{data.reportQuota.limit} free uploads used
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Care Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                Reports
              </div>
              <span className="font-semibold">
                {data?.metrics.totalReports ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarCheck className="h-4 w-4" />
                Appointments
              </div>
              <span className="font-semibold">
                {data?.metrics.totalAppointments ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Upcoming</span>
              <span>{data?.metrics.upcomingAppointments ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Attended</span>
              <span>{data?.metrics.completedAppointments ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Pill className="h-4 w-4" />
                Active medicines
              </div>
              <span className="font-semibold">
                {data?.activeMedicationCount ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Activity className="h-4 w-4" />
                Abnormal labs
              </div>
              <span className="font-semibold">
                {data?.latestAbnormalLabs.length ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Past Reports & Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recentReports.length ?? 0) === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  No reports yet. Upload your first lab report to get started.
                </p>
                <SectionLink href="/dashboard/upload">
                  <Upload className="h-4 w-4" aria-hidden="true" /> Upload a report
                </SectionLink>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data?.recentReports.map((report) => (
                  <li key={report._id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">
                      Report · {formatDate(report.createdAt)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {report.summary}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {(data?.recentReports.length ?? 0) > 0 && (
              <SectionLink href="/dashboard/reports">Open all reports</SectionLink>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-teal-600" />
              Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.upcomingAppointments.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500">
                No upcoming visits. Book your next appointment in one click.
              </p>
            ) : (
              <ul className="space-y-3">
                {data?.upcomingAppointments.map((appointment) => (
                  <li key={appointment._id} className="text-sm">
                    <p className="font-medium">
                      {formatProviderId(appointment.providerId)}
                    </p>
                    <p className="text-gray-500">
                      {formatDate(appointment.date)}
                      {appointment.time ? ` · ${appointment.time}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <SectionLink href="/dashboard/appointments">Manage appointments</SectionLink>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-teal-600" />
              Medical History Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Latest abnormal labs
              </p>
              {(data?.latestAbnormalLabs.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-gray-500">None recorded.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {data?.latestAbnormalLabs.map((lab) => (
                    <li key={lab._id} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{lab.canonicalName}</span>
                      <Badge
                        variant="outline"
                        className={
                          lab.flag === "high"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                        }
                      >
                        {lab.flag} · {lab.value}
                        {lab.unit ? ` ${lab.unit}` : ""}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <SectionLink href="/dashboard/trends">Open lab trends</SectionLink>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Medicines on record
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data?.activeMedicationCount ?? 0}
              </p>
              <p className="text-sm text-gray-500">active right now</p>
              <SectionLink href="/dashboard/meds">Review medicines</SectionLink>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Visits completed
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data?.metrics.completedAppointments ?? 0}
              </p>
              <p className="text-sm text-gray-500">attended appointments</p>
              <SectionLink href="/dashboard/appointments">View timeline</SectionLink>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
