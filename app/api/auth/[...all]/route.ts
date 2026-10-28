import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isBlockedAuthPath } from "@/lib/backoffice/blocked-auth-paths";

const handlers = toNextJsHandler(auth);

const blocked = (request: Request) =>
  isBlockedAuthPath(new URL(request.url).pathname);
const forbidden = () =>
  NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });

export async function GET(request: Request) {
  return blocked(request) ? forbidden() : handlers.GET(request);
}

export async function POST(request: Request) {
  return blocked(request) ? forbidden() : handlers.POST(request);
}
