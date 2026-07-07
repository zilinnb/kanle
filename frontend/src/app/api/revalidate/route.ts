import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { secret } = await request.json();
  const expected = process.env.REVALIDATE_SECRET || "kanle-revalidate";
  if (secret !== expected) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  revalidatePath("/archives", "layout");
  return NextResponse.json({ revalidated: true, now: Date.now() });
}
