import sys
import datetime
import openpyxl

def verify_xlsx_file(file_path: str):
    print(f"Inspecting Excel workbook: {file_path}")
    with open(file_path, "rb") as f:
        wb = openpyxl.load_workbook(f)
    ws = wb.active
    assert ws is not None, "Workbook must contain an active worksheet"

    # Detect header row dynamically
    header_row = None
    headers = []
    for r in range(1, 15):
        vals = [cell.value for cell in ws[r]]
        if "Date" in vals:
            header_row = r
            headers = vals
            break

    assert header_row is not None, f"Header row with 'Date' not found in first 15 rows of worksheet: {[cell.value for cell in ws[1]]}"
    print(f"Detected headers on row {header_row}: {headers}")
    assert "Start Time" in headers, "Header must include 'Start Time'"
    assert "End Time" in headers, "Header must include 'End Time'"

    date_col = headers.index("Date") + 1
    start_col = headers.index("Start Time") + 1
    end_col = headers.index("End Time") + 1

    rows_checked = 0
    for r in range(header_row + 1, ws.max_row + 1):
        date_cell = ws.cell(row=r, column=date_col)
        start_cell = ws.cell(row=r, column=start_col)
        end_cell = ws.cell(row=r, column=end_col)

        if date_cell.value is None:
            continue

        rows_checked += 1
        print(f"Row {r}: Date={date_cell.value!r} (type={type(date_cell.value).__name__}, num_format={date_cell.number_format}), "
              f"Start={start_cell.value!r} (type={type(start_cell.value).__name__}, num_format={start_cell.number_format}), "
              f"End={end_cell.value!r} (type={type(end_cell.value).__name__}, num_format={end_cell.number_format})")

        # 1. Date must be native date or datetime, NOT a raw string
        assert isinstance(date_cell.value, (datetime.date, datetime.datetime)), (
            f"Row {r} Date cell must be datetime.date or datetime.datetime, got {type(date_cell.value)}: {date_cell.value!r}"
        )
        assert date_cell.number_format == 'yyyy-mm-dd', (
            f"Row {r} Date cell number format must be 'yyyy-mm-dd', got {date_cell.number_format!r}"
        )

        # 2. Start Time must be native datetime.time, NOT a raw string
        assert isinstance(start_cell.value, datetime.time), (
            f"Row {r} Start Time cell must be datetime.time, got {type(start_cell.value)}: {start_cell.value!r}"
        )
        assert start_cell.number_format == 'hh:mm', (
            f"Row {r} Start Time cell number format must be 'hh:mm', got {start_cell.number_format!r}"
        )

        # 3. End Time must be native datetime.time, NOT a raw string
        assert isinstance(end_cell.value, datetime.time), (
            f"Row {r} End Time cell must be datetime.time, got {type(end_cell.value)}: {end_cell.value!r}"
        )
        assert end_cell.number_format == 'hh:mm', (
            f"Row {r} End Time cell number format must be 'hh:mm', got {end_cell.number_format!r}"
        )

    assert rows_checked > 0, "At least one exam row must be verified"
    print(f"Successfully verified {rows_checked} exam rows: All native date/time types with correct number formats!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python verify_xlsx_types.py <path_to_xlsx>")
        sys.exit(1)
    verify_xlsx_file(sys.argv[1])
