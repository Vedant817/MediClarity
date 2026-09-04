"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CalendarCheck, FileText, Mail, Phone, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProfileData = {
  metrics: {
    totalReports: number;
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
  };
};

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
            <div className="pt-2">
              <Badge variant="outline">
                Member since{" "}
                {new Date(user?.createdAt || Date.now()).getFullYear()}
              </Badge>
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
              <span className="text-gray-600">Completed</span>
              <span>{data?.metrics.completedAppointments ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
