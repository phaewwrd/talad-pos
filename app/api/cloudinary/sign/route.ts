import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { OWNER_MANAGER, requireMember } from "@/lib/permissions";

/**
 * Signed upload parameters for a direct browser → Cloudinary upload.
 * Uploads are confined to the active shop's folder.
 */
export const POST = apiRoute(async (req: NextRequest) => {
  const ctx = await requireMember({ roles: OWNER_MANAGER });
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError("FEATURE_DISABLED", { feature: "cloudinary" });
  }
  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "logo" ? "logo" : "products";

  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder: `talad-pos/${ctx.organizationId}/${kind}`,
    timestamp,
  };
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signature = createHash("sha1")
    .update(toSign + CLOUDINARY_API_SECRET)
    .digest("hex");

  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    signature,
    ...params,
  };
});
