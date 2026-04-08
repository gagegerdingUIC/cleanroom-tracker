/**
 * Parser for KLA-Tencor P7 stylus profiler data files.
 *
 * Supports two file formats:
 *
 * **2D (single trace):** Tab-separated header followed by columnar data.
 *   Header fields: Data, Recipe, Site Name, Points, X-Resolution, X-Coord, Y-Coord
 *   Data columns: Index, Raw, Intermediate, Normal, Roughness, Waviness
 *
 * **3D (multiple traces):** Same header plus Number of Traces & Y-Resolution.
 *   Multiple data sections (e.g. "Normal\tData", "Raw\tData"), each containing
 *   N rows × T columns where T = Number of Traces.
 */

export interface P7Header {
  dataName: string;
  recipe: string;
  siteName: string;
  numPoints: number;
  xResolution: number; // µm per point along scan
  xCoord: number; // profiler stage X (µm)
  yCoord: number; // profiler stage Y (µm)
  columnNames: string[];
  /** 3D only: number of traces (0 for 2D files) */
  numTraces: number;
  /** 3D only: spacing between traces in µm */
  yResolution: number;
}

export interface P7Profile {
  header: P7Header;
  /** Position along scan in µm: (index) * xResolution */
  xPositions: Float64Array;
  /** Data columns keyed by name (e.g. "Raw", "Normal") */
  columns: Record<string, Float64Array>;
}

/** A single trace extracted from a 3D scan. */
export interface P7Trace {
  /** 0-based trace index */
  traceIndex: number;
  /** Y position of this trace in µm (stage coordinates) */
  yPosition: number;
  /** Height data (Å) */
  data: Float64Array;
}

/** Result of parsing a 3D P7 file. */
export interface P7Profile3D {
  header: P7Header;
  /** X positions shared by all traces */
  xPositions: Float64Array;
  /** Y positions for each trace (length = numTraces) */
  yPositions: Float64Array;
  /**
   * Data sections keyed by name (e.g. "Normal", "Raw").
   * Each section contains an array of traces (one per column in the file).
   */
  sections: Record<string, P7Trace[]>;
  /** Names of available data sections */
  sectionNames: string[];
}

const HEADER_KEYS: Record<string, keyof P7Header> = {
  Data: "dataName",
  Recipe: "recipe",
  "Site Name": "siteName",
  Points: "numPoints",
  "Number of Points": "numPoints",
  "X-Resolution": "xResolution",
  "X-Coord": "xCoord",
  "Y-Coord": "yCoord",
  "Number of Traces": "numTraces",
  "Y-Resolution": "yResolution",
};

const NUMERIC_FIELDS = new Set<keyof P7Header>([
  "numPoints",
  "xResolution",
  "xCoord",
  "yCoord",
  "numTraces",
  "yResolution",
]);

/** Detect whether a P7 file is 3D (has multiple traces). */
export function isP7File3D(text: string): boolean {
  // Quick check: look for "Number of Traces" in the first ~20 lines
  const lines = text.split(/\r?\n/, 20);
  return lines.some((l) => l.startsWith("Number of Traces"));
}

// ---------------------------------------------------------------------------
// 2D parser
// ---------------------------------------------------------------------------

export function parseP7File(text: string): P7Profile {
  const lines = text.split(/\r?\n/);

  const header: P7Header = {
    dataName: "",
    recipe: "",
    siteName: "",
    numPoints: 0,
    xResolution: 0,
    xCoord: 0,
    yCoord: 0,
    columnNames: [],
    numTraces: 0,
    yResolution: 0,
  };

  let dataStartLine = -1;

  // Parse header lines and find column header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Check for header key-value pairs
    const tabIdx = line.indexOf("\t");
    if (tabIdx > 0) {
      const key = line.substring(0, tabIdx).trim();
      const val = line.substring(tabIdx + 1).trim();

      if (key in HEADER_KEYS) {
        const field = HEADER_KEYS[key];
        if (NUMERIC_FIELDS.has(field)) {
          (header as unknown as Record<string, unknown>)[field] = parseFloat(val);
        } else {
          (header as unknown as Record<string, unknown>)[field] = val;
        }
        continue;
      }
    }

    // Detect column header line: starts with whitespace/tab, contains known column names
    const trimmed = line.trim();
    if (
      trimmed.includes("Raw") &&
      trimmed.includes("Normal") &&
      line.match(/^\s/)
    ) {
      header.columnNames = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
      dataStartLine = i + 1;
      break;
    }
  }

  if (dataStartLine < 0) {
    throw new Error("Could not find column header line in P7 data file");
  }

  // Count data lines
  const numPoints =
    header.numPoints ||
    lines.slice(dataStartLine).filter((l) => l.trim() && /^\d/.test(l.trim()))
      .length;

  // Allocate typed arrays
  const xPositions = new Float64Array(numPoints);
  const columns: Record<string, Float64Array> = {};
  for (const name of header.columnNames) {
    columns[name] = new Float64Array(numPoints);
  }

  // Parse data rows
  let pointIdx = 0;
  for (let i = dataStartLine; i < lines.length && pointIdx < numPoints; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    // First field is the 1-based index, remaining are column values
    const values = parts.slice(1).map(Number);

    xPositions[pointIdx] = pointIdx * header.xResolution;

    for (let c = 0; c < header.columnNames.length && c < values.length; c++) {
      columns[header.columnNames[c]][pointIdx] = values[c];
    }

    pointIdx++;
  }

  // Trim if we got fewer points than expected
  if (pointIdx < numPoints) {
    const trimmedX = xPositions.slice(0, pointIdx);
    const trimmedCols: Record<string, Float64Array> = {};
    for (const name of header.columnNames) {
      trimmedCols[name] = columns[name].slice(0, pointIdx);
    }
    header.numPoints = pointIdx;
    return { header, xPositions: trimmedX, columns: trimmedCols };
  }

  header.numPoints = numPoints;
  return { header, xPositions, columns };
}

// ---------------------------------------------------------------------------
// 3D parser
// ---------------------------------------------------------------------------

/**
 * Parse a 3D P7 file containing multiple traces across data sections.
 *
 * The file contains one or more data sections (e.g. "Normal\tData", "Raw\tData").
 * Each section has rows of: index, trace1_val, trace2_val, ..., traceN_val.
 */
export function parseP7File3D(text: string): P7Profile3D {
  const lines = text.split(/\r?\n/);

  const header: P7Header = {
    dataName: "",
    recipe: "",
    siteName: "",
    numPoints: 0,
    xResolution: 0,
    xCoord: 0,
    yCoord: 0,
    columnNames: [],
    numTraces: 0,
    yResolution: 0,
  };

  // Phase 1: parse header key-value pairs (stop at first blank line after headers)
  let headerEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (headerEnd > 0) break; // blank line after we've seen header fields
      continue;
    }

    const tabIdx = line.indexOf("\t");
    if (tabIdx > 0) {
      const key = line.substring(0, tabIdx).trim();
      const val = line.substring(tabIdx + 1).trim();

      if (key in HEADER_KEYS) {
        const field = HEADER_KEYS[key];
        if (NUMERIC_FIELDS.has(field)) {
          (header as unknown as Record<string, unknown>)[field] = parseFloat(val);
        } else {
          (header as unknown as Record<string, unknown>)[field] = val;
        }
        headerEnd = i;
      }
    }
  }

  const numTraces = header.numTraces || 1;
  const numPoints = header.numPoints;
  if (numPoints <= 0) {
    throw new Error("Invalid or missing Number of Points in 3D P7 file");
  }

  // Compute shared X positions
  const xPositions = new Float64Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    xPositions[i] = i * header.xResolution;
  }

  // Compute Y positions for each trace
  const yPositions = new Float64Array(numTraces);
  for (let t = 0; t < numTraces; t++) {
    yPositions[t] = header.yCoord + t * header.yResolution;
  }

  // Phase 2: find and parse data sections
  // Section headers look like: "Normal\tData" or "Raw\tData"
  const sections: Record<string, P7Trace[]> = {};
  const sectionNames: string[] = [];

  let i = headerEnd + 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if this is a section header: "SectionName\tData"
    const tabIdx = line.indexOf("\t");
    if (tabIdx > 0) {
      const maybeName = line.substring(0, tabIdx).trim();
      const maybeData = line.substring(tabIdx + 1).trim();

      if (maybeData === "Data" && !/^\d/.test(maybeName)) {
        // This is a section header
        const sectionName = maybeName;
        sectionNames.push(sectionName);

        // Allocate trace arrays for this section
        const traces: P7Trace[] = [];
        for (let t = 0; t < numTraces; t++) {
          traces.push({
            traceIndex: t,
            yPosition: yPositions[t],
            data: new Float64Array(numPoints),
          });
        }

        // Parse data rows for this section
        let pointIdx = 0;
        i++;
        while (i < lines.length && pointIdx < numPoints) {
          const dataLine = lines[i].trim();
          if (!dataLine) {
            i++;
            continue;
          }

          // Check if we hit the next section header
          const dTabIdx = dataLine.indexOf("\t");
          if (dTabIdx > 0) {
            const firstPart = dataLine.substring(0, dTabIdx).trim();
            // If the first part is NOT a number, this is a new section header
            if (!/^-?\d/.test(firstPart)) break;
          }

          const parts = dataLine.split(/\s+/);
          if (parts.length < 2) {
            i++;
            continue;
          }

          // First field is the 1-based index, remaining are trace values
          const values = parts.slice(1).map(Number);
          for (let t = 0; t < numTraces && t < values.length; t++) {
            traces[t].data[pointIdx] = values[t];
          }

          pointIdx++;
          i++;
        }

        // Trim if fewer points than expected
        if (pointIdx < numPoints) {
          for (const trace of traces) {
            trace.data = trace.data.slice(0, pointIdx);
          }
        }

        sections[sectionName] = traces;
        continue; // don't increment i, the while loop above already positioned us
      }
    }

    i++;
  }

  // Populate columnNames with section names for compatibility
  header.columnNames = [...sectionNames];

  return { header, xPositions, yPositions, sections, sectionNames };
}

// ---------------------------------------------------------------------------
// 3D → 2D conversion helpers
// ---------------------------------------------------------------------------

/**
 * Extract a single trace from a 3D profile as a standard P7Profile.
 */
export function extractTrace(
  profile3D: P7Profile3D,
  sectionName: string,
  traceIndex: number,
): P7Profile {
  const section = profile3D.sections[sectionName];
  if (!section || traceIndex < 0 || traceIndex >= section.length) {
    throw new Error(
      `Invalid section "${sectionName}" or trace index ${traceIndex}`,
    );
  }

  const trace = section[traceIndex];
  const columns: Record<string, Float64Array> = {
    [sectionName]: trace.data,
  };

  return {
    header: {
      ...profile3D.header,
      columnNames: [sectionName],
      yCoord: trace.yPosition,
    },
    xPositions: profile3D.xPositions.slice(0, trace.data.length),
    columns,
  };
}

/**
 * Average all traces in a section to produce a single P7Profile.
 * Reduces noise by √N for N traces.
 */
export function averageTraces(
  profile3D: P7Profile3D,
  sectionName: string,
): P7Profile {
  const section = profile3D.sections[sectionName];
  if (!section || section.length === 0) {
    throw new Error(`Invalid or empty section "${sectionName}"`);
  }

  const numPoints = section[0].data.length;
  const numTraces = section.length;
  const averaged = new Float64Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    let sum = 0;
    for (let t = 0; t < numTraces; t++) {
      sum += section[t].data[i];
    }
    averaged[i] = sum / numTraces;
  }

  const columns: Record<string, Float64Array> = {
    [sectionName]: averaged,
  };

  return {
    header: {
      ...profile3D.header,
      columnNames: [sectionName],
    },
    xPositions: profile3D.xPositions.slice(0, numPoints),
    columns,
  };
}
