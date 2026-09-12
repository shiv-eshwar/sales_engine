import { google } from "googleapis";
import { credentialsFromBase64 } from "./google.js";
import { spreadsheetUrl } from "./id.js";
import { headerRow, standardSheetsConfig } from "./template.js";

export type CreatedSpreadsheet = {
  spreadsheetId: string;
  url: string;
  sheetName: string;
  title: string;
};

export type LinkedSpreadsheet = {
  spreadsheetId: string;
  url: string;
  sheetName: string;
  title: string;
  initializedHeaders: boolean;
};

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file"
];

function clients(serviceAccountJsonBase64: string) {
  const auth = new google.auth.GoogleAuth({
    credentials: credentialsFromBase64(serviceAccountJsonBase64),
    scopes: SCOPES
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth })
  };
}

async function shareSpreadsheet(
  drive: ReturnType<typeof clients>["drive"],
  spreadsheetId: string,
  shareEmail?: string
): Promise<void> {
  if (shareEmail?.trim()) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: "user", role: "writer", emailAddress: shareEmail.trim() },
      sendNotificationEmail: false
    });
    return;
  }
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { type: "anyone", role: "writer" }
  });
}

export async function createGoogleSpreadsheet(
  serviceAccountJsonBase64: string,
  title: string,
  shareEmail?: string
): Promise<CreatedSpreadsheet> {
  const { sheets, drive } = clients(serviceAccountJsonBase64);
  const config = standardSheetsConfig("pending");
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: config.sheet_name } }]
    }
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google did not return a spreadsheet ID.");
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${config.sheet_name}!1:1`,
    valueInputOption: "RAW",
    requestBody: { values: [headerRow(config)] }
  });
  try {
    await shareSpreadsheet(drive, spreadsheetId, shareEmail);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Created the Sheet but could not share it: ${message}`);
  }
  return {
    spreadsheetId,
    url: spreadsheetUrl(spreadsheetId),
    sheetName: config.sheet_name,
    title: created.data.properties?.title ?? title
  };
}

export async function inspectGoogleSpreadsheet(
  serviceAccountJsonBase64: string,
  spreadsheetId: string,
  sheetName: string
): Promise<{ title: string; headers: string[]; sheetName: string }> {
  const { sheets } = clients(serviceAccountJsonBase64);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets?.find((item) => item.properties?.title === sheetName)
    ?? meta.data.sheets?.[0];
  const resolvedName = tab?.properties?.title ?? sheetName;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${resolvedName}!1:1`
  });
  return {
    title: meta.data.properties?.title ?? spreadsheetId,
    headers: (response.data.values?.[0] ?? []).map((value) => String(value ?? "").trim()),
    sheetName: resolvedName
  };
}

export async function writeGoogleHeaderRow(
  serviceAccountJsonBase64: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const { sheets } = clients(serviceAccountJsonBase64);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!1:1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] }
  });
}
