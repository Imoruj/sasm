import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("UNAUTHORIZED", "Super admin access required"), { status: 401 });
    }

    const { id } = await params;

    const application = await db.application.findFirst({
      where: { id, organizationId: session.user.organizationId ?? "" },
      select: { id: true, applicationNumber: true, status: true },
    });

    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    if (application.status !== "DRAFT") {
      return NextResponse.json(
        err("FORBIDDEN", "Only draft applications can be deleted"),
        { status: 403 },
      );
    }

    await db.application.delete({ where: { id } });
    return NextResponse.json(ok({ id, applicationNumber: application.applicationNumber }));
  } catch (error) {
    console.error("[SA_DELETE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
