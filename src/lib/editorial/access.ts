export interface EditorialAccessInfo {
  email?: string;
  displayName: string;
  protectedByAccess: boolean;
  isLocalRequest: boolean;
  editorialSessionActive: boolean;
  accessSignal: string;
}

const ACCESS_HEADER_NAMES = [
  'cf-access-authenticated-user-email',
  'cf-access-authenticated-user-name',
  'cf-access-authenticated-user-uuid',
  'cf-access-jwt-assertion',
] as const;

export function isLocalEditorialHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/u.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/u.test(hostname)
  );
}

function findAccessSignal(request: Request): string | undefined {
  for (const headerName of ACCESS_HEADER_NAMES) {
    const value = request.headers.get(headerName)?.trim();

    if (value) {
      return headerName;
    }
  }

  return undefined;
}

export function getEditorialAccessInfo(request: Request, url?: URL): EditorialAccessInfo {
  const email = request.headers.get('cf-access-authenticated-user-email')?.trim() || undefined;
  const nameHeader = request.headers.get('cf-access-authenticated-user-name')?.trim() || undefined;
  const accessSignal = findAccessSignal(request);
  const isLocalRequest = url ? isLocalEditorialHost(url.hostname) : false;
  const protectedByAccess = Boolean(accessSignal);
  const editorialSessionActive = protectedByAccess || isLocalRequest;

  if (email || protectedByAccess) {
    return {
      email,
      displayName: nameHeader || email || 'Cloudflare-Access-Sitzung',
      protectedByAccess,
      isLocalRequest,
      editorialSessionActive,
      accessSignal: accessSignal ?? 'cf-access-authenticated-user-email',
    };
  }

  return {
    displayName: isLocalRequest ? 'Lokale Sitzung' : 'Ungeschützte Sitzung',
    protectedByAccess: false,
    isLocalRequest,
    editorialSessionActive,
    accessSignal: isLocalRequest ? 'localhost/private-host' : 'kein Access-Header',
  };
}

export function hasEditorialSession(request: Request, url: URL): boolean {
  return getEditorialAccessInfo(request, url).editorialSessionActive;
}

export function getEditorialAuthor(request: Request, fallback?: string): string | undefined {
  const accessInfo = getEditorialAccessInfo(request);
  return accessInfo.email ?? (fallback?.trim() || undefined);
}
