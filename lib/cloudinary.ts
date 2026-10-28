/** Insert a Cloudinary transformation (auto format/quality, width) into a secure_url. */
export function cloudinaryUrl(url: string | null | undefined, width = 400) {
  if (!url) return null;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/"))
    return url;
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto,c_fill,w_${width},h_${width}/`,
  );
}
