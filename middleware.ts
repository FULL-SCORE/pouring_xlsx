import { NextRequest, NextResponse } from 'next/server';

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER!;
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD!;

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return unauthorized();
  }

  const [scheme, encoded] = authHeader.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return unauthorized();
  }

  const decoded = atob(encoded);
  const [user, password] = decoded.split(':');

  if (user !== BASIC_AUTH_USER || password !== BASIC_AUTH_PASSWORD) {
    return unauthorized();
  }

  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Protected Site"',
    },
  });
}

export const config = {
  matcher: [
    /*
      Next.js内部ファイルやfaviconなどは除外
    */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};