// Photos are served by our own route, which checks the viewer is a signed-in
// member who can see that profile. The file name changes on every upload, so
// browsers can cache each photo for good.
export function avatarSrc(profileId: string, path?: string | null): string | null {
  if (!path) return null;
  const file = path.split("/")[1];
  return file ? `/avatar/${profileId}/${file}` : null;
}
