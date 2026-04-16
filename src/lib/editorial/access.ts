export interface EditorialAccessInfo {
  email?: string;
  displayName: string;
  protectedByAccess: boolean;
}

export function getEditorialAccessInfo(request: Request): EditorialAccessInfo {
  const email = request.headers.get('cf-access-authenticated-user-email')?.trim() || undefined;
  const nameHeader = request.headers.get('cf-access-authenticated-user-name')?.trim() || undefined;

  if (email) {
    return {
      email,
      displayName: nameHeader || email,
      protectedByAccess: true,
    };
  }

  return {
    displayName: 'Lokale oder ungeschützte Sitzung',
    protectedByAccess: false,
  };
}

export function getEditorialAuthor(request: Request, fallback?: string): string | undefined {
  const accessInfo = getEditorialAccessInfo(request);
  return accessInfo.email ?? (fallback?.trim() || undefined);
}
