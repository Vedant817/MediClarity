import { cloudinary } from "../../../lib/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getReportQuota, quotaExceededResponse } from "@/lib/report-quota";
import {
    MAX_UPLOAD_BODY_BYTES,
    safeUploadFileName,
    validateReportFile,
} from "@/lib/upload-security";

export const runtime = "nodejs";

interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
    [key: string]: string | number | boolean;
}

interface CloudinaryResponse {
    success: boolean;
    result?: CloudinaryUploadResult;
    error?: Error;
}

const uploadToCloudinary = (fileUri: string, fileName: string): Promise<CloudinaryResponse> => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload(fileUri, {
                invalidate: true,
                resource_type: "auto",
                filename_override: fileName,
                folder: "med_insight",
                use_filename: true,
            })
            .then((result: CloudinaryUploadResult) => {
                resolve({ success: true, result });
            })
            .catch((error: Error) => {
                reject({ success: false, error });
            });
    });
};

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const quota = await getReportQuota(userId);
        if (!quota.allowed) return quotaExceededResponse(quota);

        const contentLength = Number(req.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BODY_BYTES) {
            return NextResponse.json({ message: "Report upload is limited to 15 MB" }, { status: 413 });
        }

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ message: "No file provided" }, { status: 400 });
        }

        let fileBytes: Uint8Array;
        try {
            fileBytes = await validateReportFile(file);
        } catch (error) {
            return NextResponse.json(
                { message: error instanceof Error ? error.message : "Invalid report file" },
                { status: 400 },
            );
        }
        const mimeType = file.type;
        const encoding = "base64";
        const base64Data = Buffer.from(fileBytes).toString("base64");

        const fileUri = `data:${mimeType};${encoding},${base64Data}`;

        const res = await uploadToCloudinary(fileUri, safeUploadFileName(file.name));

        if (res.success && res.result) {
            return NextResponse.json({
                message: "success",
                imgUrl: res.result.secure_url,
                publicId: res.result.public_id
            });
        } else {
            return NextResponse.json({ message: "upload failed" }, { status: 500 });
        }
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ message: "Upload failed" }, { status: 500 });
    }
}
