import { NextResponse } from "next/server";

function getExpectedOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto
    ? `${forwardedProto.replace(/:$/, "")}:`
    : url.protocol;
  return `${proto}//${host}`.toLowerCase();
}

export function validateSameOrigin(
  request: Request,
  options?: { requireJson?: boolean },
): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return NextResponse.json(
      { error: "Cross-site requests are not allowed" },
      { status: 403 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const expected = getExpectedOrigin(request);
    if (origin.toLowerCase() !== expected) {
      return NextResponse.json(
        { error: "Cross-origin requests are not allowed" },
        { status: 403 },
      );
    }
  }

  if (options?.requireJson) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const mediaType = contentType.split(";")[0]?.trim();
    if (mediaType !== "application/json") {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 },
      );
    }
  }

  return null;
}
