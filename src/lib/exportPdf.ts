import PDFDocument from "pdfkit";
import type { ExportData } from "./exportDocx";

const FONT_SIZE_MAP = { small: 9, medium: 11, large: 13 };
const HEADING_SIZE_MAP = { small: 10, medium: 12, large: 14 };
const TITLE_SIZE_MAP = { small: 16, medium: 20, large: 24 };

const PRIORITY_COLORS: Record<string, [number, number, number]> = {
  High: [239, 68, 68],
  Medium: [34, 197, 94],
  Low: [59, 130, 246],
};

export async function generatePdf(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const fontSize = FONT_SIZE_MAP[data.fontSize];
      const headingSize = HEADING_SIZE_MAP[data.fontSize];
      const titleSize = TITLE_SIZE_MAP[data.fontSize];

      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Title
      doc.font("Helvetica-Bold").fontSize(titleSize).fillColor("#000000").text(data.title);
      doc.moveDown(0.3);

      // Date
      doc.font("Helvetica").fontSize(fontSize).fillColor("#666666").text(data.date);

      // BP Title + Formula
      if (data.bpTitle || data.formulaName) {
        doc.moveDown(0.2);
        const parts: string[] = [];
        if (data.bpTitle) parts.push(data.bpTitle);
        if (data.formulaName) parts.push(data.formulaName);
        doc.font("Helvetica-Bold").fontSize(headingSize).fillColor("#000000").text(parts.join("  —  "));
      }

      // Separator
      doc.moveDown(0.5);
      doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y).strokeColor("#333333").lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      // Sections
      for (const section of data.sections) {
        if (section.tasks.length === 0) continue;

        // Check if we need a new page (at least 80pt needed for heading + one task)
        if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
          doc.addPage();
        }

        // Section heading
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(headingSize).fillColor("#333333").text(section.heading.toUpperCase());
        doc.moveDown(0.3);

        // Write-up text (if present)
        if (section.writeup) {
          doc.font("Helvetica-Oblique").fontSize(fontSize).fillColor("#444444").text(section.writeup, { indent: 10 });
          doc.moveDown(0.3);
        }

        // Tasks
        for (const task of section.tasks) {
          // Check page break
          if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
            doc.addPage();
          }

          const hasDone = task.showDoneLine !== false;
          const doneColWidth = 140;
          const contentWidth = hasDone ? pageWidth - doneColWidth : pageWidth;
          const titleY = doc.y;

          // Priority badge + title on same line
          let titleLine = "";
          if (task.priority && task.priority !== "None") {
            titleLine += `[${task.priority}] `;
          }
          titleLine += task.title;

          if (task.isFromPrevWeek) titleLine += "  (From prev. week)";
          if (task.isForwarded) titleLine += "  (Forwarded)";

          doc.font("Helvetica-Bold").fontSize(fontSize + 1).fillColor("#000000").text(titleLine, { indent: 10, width: contentWidth });

          // Metadata
          const metaParts: string[] = [];
          if (task.formulaBadge) metaParts.push(task.formulaBadge);
          if (task.stepLabel) metaParts.push(task.stepLabel);
          if (task.description) metaParts.push(task.description);

          if (metaParts.length > 0) {
            doc.font("Helvetica").fontSize(fontSize - 1).fillColor("#555555").text(metaParts.join("  ·  "), { indent: 20, width: contentWidth });
          }

          // Bugged indicator
          if (task.bugged) {
            doc.font("Helvetica-Bold").fontSize(fontSize - 1).fillColor("#EF4444").text("BUGGED", { indent: 20 });
          }

          // Done: on the right side, aligned with the title
          const bottomY = doc.y;
          if (hasDone) {
            const doneX = doc.page.margins.left + pageWidth - doneColWidth;
            doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#333333")
              .text("Done: __________", doneX, titleY, { width: doneColWidth });
            doc.x = doc.page.margins.left;
            doc.y = bottomY;
          }
          doc.moveDown(0.5);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
