/**
 * Everything about how the spreadsheet looks: tabs, columns, colours, formulas and charts.
 * Pure data builders, no network — see sheets.ts for the API calls.
 */
import type { Expense } from './types';

export const SHEET_TITLE = 'BudgetTracker Expenses';
export const TX = 'Transactions';
export const SUMMARY = 'Summary';
export const TX_SHEET_ID = 0;
export const SUMMARY_SHEET_ID = 1;

export const TX_HEADERS = ['Date', 'Time', 'Amount', 'Currency', 'Category', 'Type', 'Note', 'Source', 'ID'];
export const ID_COLUMN = 'I';
const TX_WIDTHS = [110, 70, 110, 90, 160, 110, 260, 110, 120];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Rows reserved on the Summary tab for categories / types. */
export const MAX_CATEGORY_ROWS = 40;
export const MAX_TYPE_ROWS = 10;

// Summary tab geometry (1-based sheet rows).
const HEADER_ROW = 7;
const TOTAL_ROW = 8;
const FIRST_CAT_ROW = 9;
const LAST_CAT_ROW = FIRST_CAT_ROW + MAX_CATEGORY_ROWS - 1;
const YEAR_CELL = '$B$3';
const CURRENCY_CELL = '$B$4';

type Color = { red: number; green: number; blue: number };
const hex = (h: string): Color => ({
  red: parseInt(h.slice(1, 3), 16) / 255,
  green: parseInt(h.slice(3, 5), 16) / 255,
  blue: parseInt(h.slice(5, 7), 16) / 255,
});
const INK = hex('#1F2937');
const BRAND = hex('#0F766E');
const BRAND_SOFT = hex('#CCFBF1');
const BAND = hex('#F3F8F7');
const WHITE = hex('#FFFFFF');
const MUTED = hex('#6B7280');
const MONEY = { type: 'NUMBER', pattern: '#,##0.00' };

const pad = (n: number) => String(n).padStart(2, '0');

/** One spreadsheet row per expense, in the phone's local time. */
export function expenseToRow(e: Expense): (string | number)[] {
  const d = new Date(e.createdAt);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return [date, time, e.amount, e.currency, e.category, e.type, e.note, e.source, e.id];
}

const col = (i: number) => String.fromCharCode(65 + i);

function range(sheetId: number, r0: number, r1: number | undefined, c0: number, c1: number | undefined) {
  return {
    sheetId,
    startRowIndex: r0,
    ...(r1 === undefined ? {} : { endRowIndex: r1 }),
    startColumnIndex: c0,
    ...(c1 === undefined ? {} : { endColumnIndex: c1 }),
  };
}

function format(r: ReturnType<typeof range>, userEnteredFormat: Record<string, unknown>) {
  const fields = Object.keys(userEnteredFormat)
    .map((k) => `userEnteredFormat.${k}`)
    .join(',');
  return { repeatCell: { range: r, cell: { userEnteredFormat }, fields } };
}

function width(sheetId: number, index: number, pixelSize: number, count = 1) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + count },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  };
}

/** Body for `spreadsheets.create`. en_US locale keeps formula syntax and date parsing predictable. */
export function createSpreadsheetBody() {
  return {
    properties: {
      title: SHEET_TITLE,
      locale: 'en_US',
      defaultFormat: { textFormat: { fontFamily: 'Inter', fontSize: 10, foregroundColor: INK } },
    },
    sheets: [
      {
        properties: {
          sheetId: TX_SHEET_ID,
          title: TX,
          index: 0,
          gridProperties: { frozenRowCount: 1, columnCount: TX_HEADERS.length, rowCount: 1000 },
          tabColor: BRAND,
        },
      },
      {
        properties: {
          sheetId: SUMMARY_SHEET_ID,
          title: SUMMARY,
          index: 1,
          gridProperties: { frozenRowCount: HEADER_ROW, frozenColumnCount: 1, hideGridlines: true, columnCount: 18, rowCount: 80 },
          tabColor: hex('#F59E0B'),
        },
      },
    ],
  };
}

function monthSum(categoryRef: string | null, monthIndex: number | null): string {
  const from = monthIndex === null ? `DATE(${YEAR_CELL},1,1)` : `DATE(${YEAR_CELL},${monthIndex + 1},1)`;
  const to = monthIndex === null ? `DATE(${YEAR_CELL}+1,1,1)` : `DATE(${YEAR_CELL},${monthIndex + 2},1)`;
  const byCategory = categoryRef ? `,${TX}!$E:$E,${categoryRef}` : '';
  return `SUMIFS(${TX}!$C:$C,${TX}!$D:$D,${CURRENCY_CELL},${TX}!$A:$A,">="&${from},${TX}!$A:$A,"<"&${to}${byCategory})`;
}

/** Cell values (text + formulas) for the Summary tab, as `values.batchUpdate` data. */
export function summaryValues(currency: string) {
  const header = ['Category', ...MONTHS, 'Total'];
  const total = ['Total', ...MONTHS.map((_, m) => `=${monthSum(null, m)}`), `=${monthSum(null, null)}`];
  const categoryRows: string[][] = [];
  for (let i = 0; i < MAX_CATEGORY_ROWS; i++) {
    const row = FIRST_CAT_ROW + i;
    const ref = `$A${row}`;
    categoryRows.push([
      // The first cell spills the list of categories actually used; the rest stay empty.
      i === 0 ? `=IFERROR(SORT(UNIQUE(FILTER(${TX}!E2:E,${TX}!E2:E<>""))),"")` : '',
      ...MONTHS.map((_, m) => `=IF(${ref}="","",${monthSum(ref, m)})`),
      `=IF(${ref}="","",${monthSum(ref, null)})`,
    ]);
  }
  // Only the first category cell may hold a value, otherwise the spill is blocked.
  const categoryData = [
    { range: `${SUMMARY}!A${FIRST_CAT_ROW}`, values: [[categoryRows[0][0]]] },
    { range: `${SUMMARY}!B${FIRST_CAT_ROW}:N${LAST_CAT_ROW}`, values: categoryRows.map((r) => r.slice(1)) },
  ];

  const typeRows: string[][] = [];
  for (let i = 0; i < MAX_TYPE_ROWS; i++) {
    const row = FIRST_CAT_ROW + i;
    typeRows.push([
      `=IF($P${row}="","",SUMIFS(${TX}!$C:$C,${TX}!$D:$D,${CURRENCY_CELL},${TX}!$F:$F,$P${row},${TX}!$A:$A,">="&DATE(${YEAR_CELL},1,1),${TX}!$A:$A,"<"&DATE(${YEAR_CELL}+1,1,1)))`,
    ]);
  }

  return [
    { range: `${SUMMARY}!A1`, values: [['Expenses summary']] },
    { range: `${SUMMARY}!A3:B4`, values: [['Year', '=YEAR(TODAY())'], ['Currency', currency]] },
    {
      range: `${SUMMARY}!D3:E4`,
      values: [
        ['Spent this year', `=${monthSum(null, null)}`],
        [
          'Spent this month',
          `=SUMIFS(${TX}!$C:$C,${TX}!$D:$D,${CURRENCY_CELL},${TX}!$A:$A,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),${TX}!$A:$A,"<"&DATE(YEAR(TODAY()),MONTH(TODAY())+1,1))`,
        ],
      ],
    },
    { range: `${SUMMARY}!G3:H4`, values: [['Transactions', `=COUNTA(${TX}!I2:I)`], ['Change the year or currency in column B', '']] },
    { range: `${SUMMARY}!A${HEADER_ROW}:N${TOTAL_ROW}`, values: [header, total] },
    ...categoryData,
    { range: `${SUMMARY}!P${HEADER_ROW}:Q${HEADER_ROW}`, values: [['Type', 'Total']] },
    { range: `${SUMMARY}!P${FIRST_CAT_ROW}`, values: [[`=IFERROR(SORT(UNIQUE(FILTER(${TX}!F2:F,${TX}!F2:F<>""))),"")`]] },
    { range: `${SUMMARY}!Q${FIRST_CAT_ROW}:Q${FIRST_CAT_ROW + MAX_TYPE_ROWS - 1}`, values: typeRows },
  ];
}

function chartSource(r0: number, r1: number, c0: number, c1: number) {
  return { sourceRange: { sources: [range(SUMMARY_SHEET_ID, r0, r1, c0, c1)] } };
}

/** Formatting, banding, filter and charts — the `spreadsheets.batchUpdate` requests. */
export function formattingRequests() {
  const S = SUMMARY_SHEET_ID;
  const T = TX_SHEET_ID;
  const headerStyle = {
    backgroundColor: BRAND,
    textFormat: { bold: true, foregroundColor: WHITE, fontSize: 10 },
    verticalAlignment: 'MIDDLE',
    padding: { left: 8, right: 8, top: 6, bottom: 6 },
  };
  const chartsRow = LAST_CAT_ROW + 2;

  return [
    // ── Transactions ──────────────────────────────────────────────
    {
      updateCells: {
        range: range(T, 0, 1, 0, TX_HEADERS.length),
        rows: [{ values: TX_HEADERS.map((h) => ({ userEnteredValue: { stringValue: h } })) }],
        fields: 'userEnteredValue',
      },
    },
    format(range(T, 0, 1, 0, TX_HEADERS.length), headerStyle),
    ...TX_WIDTHS.map((w, i) => width(T, i, w)),
    format(range(T, 1, undefined, 0, 1), { numberFormat: { type: 'DATE', pattern: 'ddd d mmm yyyy' }, horizontalAlignment: 'LEFT' }),
    format(range(T, 1, undefined, 1, 2), { numberFormat: { type: 'TIME', pattern: 'hh:mm' }, textFormat: { foregroundColor: MUTED } }),
    format(range(T, 1, undefined, 2, 3), { numberFormat: MONEY, textFormat: { bold: true } }),
    format(range(T, 1, undefined, 7, 9), { textFormat: { foregroundColor: MUTED, fontSize: 9 } }),
    {
      addBanding: {
        bandedRange: {
          bandedRangeId: 1,
          range: range(T, 0, undefined, 0, TX_HEADERS.length),
          rowProperties: { headerColor: BRAND, firstBandColor: WHITE, secondBandColor: BAND },
        },
      },
    },
    { setBasicFilter: { filter: { range: range(T, 0, undefined, 0, TX_HEADERS.length) } } },
    {
      updateDimensionProperties: {
        range: { sheetId: T, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: T, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 34 },
        fields: 'pixelSize',
      },
    },

    // ── Summary ───────────────────────────────────────────────────
    width(S, 0, 170),
    width(S, 1, 82, 12),
    width(S, 13, 100),
    width(S, 14, 30),
    width(S, 15, 130),
    width(S, 16, 100),
    format(range(S, 0, 1, 0, 8), { textFormat: { bold: true, fontSize: 20, foregroundColor: BRAND } }),
    // Controls and headline numbers.
    format(range(S, 2, 4, 0, 1), { textFormat: { foregroundColor: MUTED } }),
    format(range(S, 2, 4, 1, 2), { backgroundColor: BRAND_SOFT, textFormat: { bold: true }, horizontalAlignment: 'CENTER' }),
    format(range(S, 2, 4, 3, 4), { textFormat: { foregroundColor: MUTED } }),
    format(range(S, 2, 4, 4, 5), { numberFormat: MONEY, textFormat: { bold: true, fontSize: 12 } }),
    format(range(S, 2, 3, 6, 7), { textFormat: { foregroundColor: MUTED } }),
    format(range(S, 2, 3, 7, 8), { textFormat: { bold: true, fontSize: 12 }, horizontalAlignment: 'LEFT' }),
    format(range(S, 3, 4, 6, 7), { textFormat: { italic: true, foregroundColor: MUTED, fontSize: 9 } }),
    // Category x month table.
    format(range(S, HEADER_ROW - 1, HEADER_ROW, 0, 14), headerStyle),
    format(range(S, HEADER_ROW - 1, HEADER_ROW, 1, 14), { horizontalAlignment: 'RIGHT' }),
    format(range(S, TOTAL_ROW - 1, TOTAL_ROW, 0, 14), { backgroundColor: BRAND_SOFT, textFormat: { bold: true } }),
    format(range(S, TOTAL_ROW - 1, LAST_CAT_ROW, 1, 14), { numberFormat: MONEY }),
    format(range(S, FIRST_CAT_ROW - 1, LAST_CAT_ROW, 13, 14), { textFormat: { bold: true } }),
    {
      addBanding: {
        bandedRange: {
          bandedRangeId: 2,
          range: range(S, FIRST_CAT_ROW - 1, LAST_CAT_ROW, 0, 14),
          rowProperties: { firstBandColor: WHITE, secondBandColor: BAND },
        },
      },
    },
    // Type table.
    format(range(S, HEADER_ROW - 1, HEADER_ROW, 15, 17), headerStyle),
    format(range(S, HEADER_ROW - 1, HEADER_ROW, 16, 17), { horizontalAlignment: 'RIGHT' }),
    format(range(S, FIRST_CAT_ROW - 1, FIRST_CAT_ROW - 1 + MAX_TYPE_ROWS, 16, 17), { numberFormat: MONEY, textFormat: { bold: true } }),
    // Heat-map the monthly cells so big months stand out.
    {
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [range(S, FIRST_CAT_ROW - 1, LAST_CAT_ROW, 1, 13)],
          gradientRule: {
            minpoint: { color: WHITE, type: 'NUMBER', value: '0' },
            maxpoint: { color: hex('#5EEAD4'), type: 'MAX' },
          },
        },
      },
    },
    // Charts sit under the table.
    {
      addChart: {
        chart: {
          spec: {
            title: 'Spending per month',
            basicChart: {
              chartType: 'COLUMN',
              legendPosition: 'NO_LEGEND',
              headerCount: 0,
              domains: [{ domain: chartSource(HEADER_ROW - 1, HEADER_ROW, 1, 13) }],
              series: [{ series: chartSource(TOTAL_ROW - 1, TOTAL_ROW, 1, 13), targetAxis: 'LEFT_AXIS', color: BRAND }],
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId: S, rowIndex: chartsRow, columnIndex: 0 },
              widthPixels: 640,
              heightPixels: 320,
            },
          },
        },
      },
    },
    {
      addChart: {
        chart: {
          spec: {
            title: 'By category (selected year)',
            pieChart: {
              legendPosition: 'RIGHT_LEGEND',
              pieHole: 0.5,
              domain: chartSource(FIRST_CAT_ROW - 1, LAST_CAT_ROW, 0, 1),
              series: chartSource(FIRST_CAT_ROW - 1, LAST_CAT_ROW, 13, 14),
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId: S, rowIndex: chartsRow, columnIndex: 8 },
              widthPixels: 520,
              heightPixels: 320,
            },
          },
        },
      },
    },
  ];
}
