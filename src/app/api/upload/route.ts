import { cloudinary } from "../../../lib/cloudinary";
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
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ message: "No file provided" }, { status: 400 });
        }

        const fileBuffer = await file.arrayBuffer();
        const mimeType = file.type;
        const encoding = "base64";
        const base64Data = Buffer.from(fileBuffer).toString("base64");

        const fileUri = `data:${mimeType};${encoding},${base64Data}`;

        const res = await uploadToCloudinary(fileUri, file.name);

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