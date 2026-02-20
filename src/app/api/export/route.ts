import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { generateDocx, type ExportData } from "@/lib/exportDocx";
import { generatePdf } from "@/lib/exportPdf";

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { format, ...exportData } = body as { format: "docx" | "pdf" } & ExportData;

    if (!format || !["docx", "pdf"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use 'docx' or 'pdf'" }, { status: 400 });
    }

    if (!exportData.sections || !Array.isArray(exportData.sections)) {
      return NextResponse.json({ error: "Missing sections data" }, { status: 400 });
    }

    let buffer: Buffer;
    let contentType: string;
    let extension: string;

    if (format === "docx") {
      buffer = await generateDocx(exportData);
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else {
      buffer = await generatePdf(exportData);
      contentType = "application/pdf";
      extension = "pdf";
    }

    const filename = `battle-plan.${extension}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating export:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
