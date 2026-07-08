import { getAccessToken } from './googleAuth';

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface SheetProperties {
  sheetId: number;
  title: string;
}

export const googleWorkspace = {
  async listSpreadsheets(): Promise<DriveFile[]> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated with Google Workspace");

    const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to list spreadsheets: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    return data.files || [];
  },

  async getSpreadsheetDetails(spreadsheetId: string): Promise<{ title: string, sheets: SheetProperties[] }> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated with Google Workspace");

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to get spreadsheet details: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    return {
      title: data.properties.title,
      sheets: data.sheets.map((s: any) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title
      }))
    };
  },

  async getSheetData(spreadsheetId: string, sheetTitle: string): Promise<{ headers: string[], rows: any[][] }> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated with Google Workspace");

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to read sheet data: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    const values = data.values || [];
    
    if (values.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = values[0];
    const rows = values.slice(1);

    return { headers, rows };
  }
};
