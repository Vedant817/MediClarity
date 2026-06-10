const HTTPS_PROTOCOL = "https:";

export function isAllowedCloudinaryDocumentUrl(documentUrl: unknown, userId: string) {
    if (typeof documentUrl !== "string") {
        return false;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
        return false;
    }

    try {
        const parsedUrl = new URL(documentUrl);
        const expectedHost = `res.cloudinary.com`;
        const encodedUserFolder = `/mediclarity/${encodeURIComponent(userId)}/`;
        const plainUserFolder = `/mediclarity/${userId}/`;

        return parsedUrl.protocol === HTTPS_PROTOCOL
            && parsedUrl.hostname === expectedHost
            && parsedUrl.pathname.includes(`/${cloudName}/`)
            && (parsedUrl.pathname.includes(encodedUserFolder) || parsedUrl.pathname.includes(plainUserFolder));
    } catch {
        return false;
    }
}
