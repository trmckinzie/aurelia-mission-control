import { NextResponse } from "next/server";
import { withLocalGuard } from "@/lib/api-helpers";
import { checkAllProviders } from "@/lib/providers/registry";

export const GET = withLocalGuard(async () => {
  const providers = await checkAllProviders();
  return NextResponse.json({ providers });
});
