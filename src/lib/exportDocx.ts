import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  TabStopPosition,
  TabStopType,
} from "docx";

export interface ExportSection {
  heading: string;
  tasks: ExportTask[];
  writeup?: string;
}

export interface ExportTask {
  title: string;
  priority?: string;
  formulaBadge?: string;
  stepLabel?: string;
  description?: string;
  isForwarded?: boolean;
  isFromPrevWeek?: boolean;
  bugged?: boolean;
  showDoneLine?: boolean;
}

export interface ExportData {
  title: string;
  date: string;
  bpTitle?: string;
  formulaName?: string;
  fontSize: "small" | "medium" | "large";
  sections: ExportSection[];
}

const FONT_SIZE_MAP = { small: 20, medium: 24, large: 28 }; // half-points
const HEADING_SIZE_MAP = { small: 22, medium: 26, large: 30 };
const TITLE_SIZE_MAP = { small: 32, medium: 40, large: 48 };

const PRIORITY_COLORS: Record<string, string> = {
  High: "EF4444",
  Medium: "22C55E",
  Low: "3B82F6",
};

export async function generateDocx(data: ExportData): Promise<Buffer> {
  const fontSize = FONT_SIZE_MAP[data.fontSize];
  const headingSize = HEADING_SIZE_MAP[data.fontSize];
  const titleSize = TITLE_SIZE_MAP[data.fontSize];

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.title,
          bold: true,
          size: titleSize,
          font: "Calibri",
        }),
      ],
      spacing: { after: 80 },
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.date,
          size: fontSize,
          font: "Calibri",
          color: "666666",
        }),
      ],
      spacing: { after: 40 },
    })
  );

  // BP Title + Formula
  if (data.bpTitle || data.formulaName) {
    const runs: TextRun[] = [];
    if (data.bpTitle) {
      runs.push(
        new TextRun({
          text: data.bpTitle,
          size: headingSize,
          font: "Calibri",
          bold: true,
        })
      );
    }
    if (data.formulaName) {
      if (data.bpTitle) {
        runs.push(new TextRun({ text: "  ", size: fontSize, font: "Calibri" }));
      }
      runs.push(
        new TextRun({
          text: data.formulaName,
          size: fontSize,
          font: "Calibri",
          color: "666666",
          italics: true,
        })
      );
    }
    children.push(new Paragraph({ children: runs, spacing: { after: 200 } }));
  }

  // Separator line
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "333333",
        },
      },
      spacing: { after: 200 },
    })
  );

  // Sections
  for (const section of data.sections) {
    if (section.tasks.length === 0) continue;

    // Section heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.heading.toUpperCase(),
            bold: true,
            size: headingSize,
            font: "Calibri",
            color: "333333",
          }),
        ],
        spacing: { before: 300, after: 120 },
      })
    );

    // Write-up text (if present)
    if (section.writeup) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.writeup,
              size: fontSize,
              font: "Calibri",
              color: "444444",
              italics: true,
            }),
          ],
          spacing: { after: 120 },
          indent: { left: 120 },
        })
      );
    }

    // Tasks
    for (const task of section.tasks) {
      const titleRuns: TextRun[] = [];

      // Priority badge
      if (task.priority && task.priority !== "None") {
        titleRuns.push(
          new TextRun({
            text: `[${task.priority}] `,
            size: fontSize,
            font: "Calibri",
            bold: true,
            color: PRIORITY_COLORS[task.priority] || "333333",
          })
        );
      }

      // Task title
      titleRuns.push(
        new TextRun({
          text: task.title,
          size: fontSize + 2,
          font: "Calibri",
          bold: true,
        })
      );

      // Forwarded labels
      if (task.isFromPrevWeek) {
        titleRuns.push(
          new TextRun({
            text: "  (From prev. week)",
            size: fontSize - 2,
            font: "Calibri",
            color: "999999",
            italics: true,
          })
        );
      }
      if (task.isForwarded) {
        titleRuns.push(
          new TextRun({
            text: "  (Forwarded)",
            size: fontSize - 2,
            font: "Calibri",
            color: "999999",
            italics: true,
          })
        );
      }

      // Done: on the right side of the title line via tab stop
      if (task.showDoneLine !== false) {
        titleRuns.push(
          new TextRun({ text: "\t", size: fontSize, font: "Calibri" })
        );
        titleRuns.push(
          new TextRun({
            text: "Done: __________",
            size: fontSize,
            font: "Calibri",
            color: "333333",
          })
        );
      }

      children.push(
        new Paragraph({
          children: titleRuns,
          spacing: { before: 160, after: 40 },
          tabStops: task.showDoneLine !== false
            ? [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }]
            : [],
        })
      );

      // Metadata line (formula badge, step label, description)
      const metaParts: string[] = [];
      if (task.formulaBadge) metaParts.push(task.formulaBadge);
      if (task.stepLabel) metaParts.push(task.stepLabel);
      if (task.description) metaParts.push(task.description);

      if (metaParts.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: metaParts.join("  ·  "),
                size: fontSize - 2,
                font: "Calibri",
                color: "555555",
              }),
            ],
            spacing: { after: 40 },
            indent: { left: 240 },
          })
        );
      }

      // Bugged indicator
      if (task.bugged) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BUGGED",
                size: fontSize - 2,
                font: "Calibri",
                bold: true,
                color: "EF4444",
              }),
            ],
            spacing: { after: 40 },
            indent: { left: 240 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
