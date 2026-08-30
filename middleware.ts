import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
export function middleware(req:NextRequest){
 const res=NextResponse.next();
 res.headers.set('x-content-type-options','nosniff');
 res.headers.set('x-frame-options','SAMEORIGIN');
 res.headers.set('referrer-policy','strict-origin-when-cross-origin');
 return res;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
