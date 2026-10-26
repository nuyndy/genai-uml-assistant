
export function imageExtension(imageUrl: string): string {
  const cleanUrl = imageUrl.split("?")[0].split("#")[0];
  const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);

  if (match) {
    return match[1].toLowerCase();
  }

  if (imageUrl.startsWith("data:image/")) {
    const dataMatch = imageUrl.match(/^data:image\/([a-zA-Z0-9.+-]+)/i);
    if (dataMatch) {
      return dataMatch[1].toLowerCase().replace("jpeg", "jpg");
    }
  }

  return "png";
}
