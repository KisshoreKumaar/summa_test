import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function signOut(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}

export async function POST(request: NextRequest) {
  return signOut(request);
}

// Middleware redirects deactivated accounts here, which arrives as a GET.
export async function GET(request: NextRequest) {
  return signOut(request);
}
