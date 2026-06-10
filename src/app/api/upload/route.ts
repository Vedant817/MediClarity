import { cloudinary } from "../../../lib/cloudinary";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

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

const allowedMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
]);

const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

const uploadToCloudinary = (fileUri: string, fileName: string, userId: string): Promise<CloudinaryResponse> => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload(fileUri, {
                invalidate: true,
                resource_type: "auto",
                filename_override: fileName,
                folder: `mediclarity/${userId}`,
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

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ message: "No file provided" }, { status: 400 });
        }

        if (!allowedMimeTypes.has(file.type)) {
            return NextResponse.json({ message: "Unsupported file type" }, { status: 415 });
        }

        if (file.size > maxUploadBytes) {
            return NextResponse.json({ message: "File is too large" }, { status: 413 });
        }

        const fileBuffer = await file.arrayBuffer();
        const mimeType = file.type;
        const encoding = "base64";
        const base64Data = Buffer.from(fileBuffer).toString("base64");

        const fileUri = `data:${mimeType};${encoding},${base64Data}`;

        const res = await uploadToCloudinary(fileUri, file.name, userId);

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
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: "error", error: errorMessage }, { status: 500 });
    }
}
