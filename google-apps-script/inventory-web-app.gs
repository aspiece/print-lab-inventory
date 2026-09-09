const SHEET_NAME = "Inventory";
const HEADERS = [
  "Spool ID",
  "Material",
  "Color",
  "Brand",
  "Starting Weight (g)",
  "Estimated Remaining (g)",
  "Status",
  "Storage Location",
  "Loaded Printer",
  "Date Opened",
  "Notes",
  "Low Stock Threshold (g)",
];

function doGet(e) {
  try {
    const action = (e.parameter.action || "list").trim();

    if (action === "list") {
      return jsonResponse({ ok: true, data: { spools: readSpools_() } });
    }

    return jsonResponse({ ok: false, error: "Unsupported GET action." });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "").trim();

    if (action === "create") {
      createSpool_(payload.spool || {});
      return jsonResponse({ ok: true, data: { success: true } });
    }

    if (action === "update") {
      updateSpool_(String(payload.spoolId || ""), payload.spool || {});
      return jsonResponse({ ok: true, data: { success: true } });
    }

    if (action === "archive") {
      archiveSpool_(String(payload.spoolId || ""));
      return jsonResponse({ ok: true, data: { success: true } });
    }

    return jsonResponse({ ok: false, error: "Unsupported POST action." });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function readSpools_() {
  const sheet = getInventorySheet_();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).filter(hasContent_).map((row) => rowToSpool_(headers, row));
}

function createSpool_(spool) {
  const sheet = getInventorySheet_();
  const nextId = getNextSpoolId_(sheet);
  sheet.appendRow(toSheetRow_(nextId, spool));
}

function updateSpool_(spoolId, spool) {
  const sheet = getInventorySheet_();
  const rowIndex = findSpoolRowIndex_(sheet, spoolId);
  if (rowIndex === -1) {
    throw new Error("Spool not found.");
  }

  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([toSheetRow_(spoolId, spool)]);
}

function archiveSpool_(spoolId) {
  const sheet = getInventorySheet_();
  const rowIndex = findSpoolRowIndex_(sheet, spoolId);
  if (rowIndex === -1) {
    throw new Error("Spool not found.");
  }

  const values = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  values[6] = "Archived";
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
}

function getInventorySheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found.`);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else if (
    sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join("|") !==
    HEADERS.join("|")
  ) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function getNextSpoolId_(sheet) {
  if (sheet.getLastRow() <= 1) {
    return "1";
  }

  const ids = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return String((ids.length ? Math.max.apply(null, ids) : 0) + 1);
}

function findSpoolRowIndex_(sheet, spoolId) {
  if (!spoolId || sheet.getLastRow() <= 1) {
    return -1;
  }

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]).trim() === spoolId) {
      return index + 2;
    }
  }

  return -1;
}

function toSheetRow_(spoolId, spool) {
  return [
    spoolId,
    spool.material || "",
    spool.color || "",
    spool.brand || "",
    Number(spool.startingWeight || 0),
    Number(spool.estimatedRemaining || 0),
    spool.status || "In storage",
    spool.storageLocation || "",
    spool.loadedPrinter || "",
    spool.dateOpened || "",
    spool.notes || "",
    Number(spool.lowStockThreshold || 200),
  ];
}

function rowToSpool_(headers, row) {
  const record = {};
  headers.forEach(function (header, index) {
    record[header] = row[index];
  });

  return {
    spoolId: String(record["Spool ID"] || ""),
    material: String(record["Material"] || ""),
    color: String(record["Color"] || ""),
    brand: String(record["Brand"] || ""),
    startingWeight: Number(record["Starting Weight (g)"] || 0),
    estimatedRemaining: Number(record["Estimated Remaining (g)"] || 0),
    status: String(record["Status"] || "In storage"),
    storageLocation: String(record["Storage Location"] || ""),
    loadedPrinter: String(record["Loaded Printer"] || ""),
    dateOpened: String(record["Date Opened"] || ""),
    notes: String(record["Notes"] || ""),
    lowStockThreshold: Number(record["Low Stock Threshold (g)"] || 200),
  };
}

function hasContent_(row) {
  return row.some(function (value) {
    return String(value).trim() !== "";
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
