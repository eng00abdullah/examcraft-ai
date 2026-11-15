from __future__ import annotations
import io
import json
import re
import html
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False

# Register Unicode TrueType fonts if available on the system
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

candidate_fonts = [
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("C:/Windows/Fonts/segoeui.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/freefont/FreeSans.ttf"),
    Path("/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf"),
]

for p in candidate_fonts:
    if p.exists():
        try:
            pdfmetrics.registerFont(TTFont("CustomUnicode", str(p)))
            FONT_REGULAR = "CustomUnicode"
            bd_p = p.parent / (p.stem + "bd" + p.suffix)
            if bd_p.exists():
                pdfmetrics.registerFont(TTFont("CustomUnicode-Bold", str(bd_p)))
                FONT_BOLD = "CustomUnicode-Bold"
            else:
                FONT_BOLD = "CustomUnicode"
            break
        except Exception:
            pass


def format_text_for_pdf(text: str) -> str:
    """Escapes XML entities for ReportLab Paragraph and handles Arabic reshaping if present."""
    if not text:
        return ""
    raw_str = str(text)
    if HAS_BIDI and re.search(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]", raw_str):
        try:
            reshaped = arabic_reshaper.reshape(raw_str)
            raw_str = get_display(reshaped)
        except Exception:
            pass
    # Escape XML markup characters so ReportLab Paragraph won't crash on <, >, &
    return html.escape(raw_str)


from app.schemas.runs import RunRecord
from app.domain.normalized import NormalizedProblem


def set_safe_cell(cell, val: Any) -> None:
    if isinstance(val, str) and (val.startswith("=") or val.startswith("+") or val.startswith("-") or val.startswith("@")):
        cell.data_type = "s"
        cell.value = str(val)
    else:
        cell.value = val


def sanitize_excel_cell(val: Any) -> Any:
    return val


def generate_json_export(record: RunRecord, filter_course: Optional[str] = None, filter_room: Optional[str] = None, filter_date: Optional[str] = None) -> Dict[str, Any]:
    assignments = record.assignments or []
    norm = NormalizedProblem(record.problem)

    filtered_assignments = []
    for a in assignments:
        course = norm.courses_by_id.get(a.course_id)
        slot = norm.slots_by_id.get(a.slot_id)
        if filter_course and filter_course.lower() not in (course.code.lower() if course else "") and filter_course.lower() not in (course.name.lower() if course else ""):
            continue
        if filter_room and a.room_id != filter_room:
            continue
        if filter_date and slot and slot.date != filter_date:
            continue
        filtered_assignments.append(a.model_dump())

    return {
        "schema_version": "1.0",
        "run_id": record.run_id,
        "problem_revision_id": record.revision_id,
        "problem_hash": record.problem_hash,
        "algorithm": record.algorithm,
        "status": record.status,
        "optimality_proven": record.optimality_proven,
        "is_filtered": len(filtered_assignments) != len(assignments),
        "total_assignments_count": len(assignments),
        "exported_assignments_count": len(filtered_assignments),
        "assignments": filtered_assignments,
        "problem": record.problem.model_dump(),
        "metrics": record.metrics.model_dump(),
        "validation": record.validation.model_dump() if record.validation else None,
    }


def generate_xlsx_export(record: RunRecord, filter_course: Optional[str] = None, filter_room: Optional[str] = None, filter_date: Optional[str] = None) -> io.BytesIO:
    wb = Workbook()

    # Sheet 1: Timetable
    ws_tt = wb.active
    ws_tt.title = "Timetable"

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    primary_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    border_thin = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(top=border_thin, left=border_thin, right=border_thin, bottom=border_thin)

    headers = [
        "Course Code",
        "Course Name",
        "Date",
        "Start Time",
        "End Time",
        "Duration (min)",
        "Room ID",
        "Room Name",
        "Enrolled Students",
        "Capacity",
    ]
    ws_tt.append(headers)

    for col_num in range(1, len(headers) + 1):
        cell = ws_tt.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = primary_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = cell_border

    norm = NormalizedProblem(record.problem)
    assignments = record.assignments or []

    row_idx = 2
    for a in assignments:
        course = norm.courses_by_id.get(a.course_id)
        slot = norm.slots_by_id.get(a.slot_id)
        room = norm.rooms_by_id.get(a.room_id)

        if not course or not slot or not room:
            continue

        if filter_course and filter_course.lower() not in course.code.lower() and filter_course.lower() not in course.name.lower():
            continue
        if filter_room and a.room_id != filter_room:
            continue
        if filter_date and slot.date != filter_date:
            continue

        placement = norm.create_placement(a.course_id, a.slot_id, a.room_id)
        n_stus = norm.course_student_count.get(a.course_id, 0)

        # Parse date and times
        try:
            d_val = datetime.strptime(slot.date, "%Y-%m-%d").date()
        except Exception:
            d_val = slot.date

        try:
            st_val = datetime.strptime(placement.start_time, "%H:%M").time()
        except Exception:
            st_val = placement.start_time

        try:
            et_val = datetime.strptime(placement.end_time, "%H:%M").time()
        except Exception:
            et_val = placement.end_time

        row_cells = [
            (course.code, "@"),
            (course.name, "@"),
            (d_val, "yyyy-mm-dd"),
            (st_val, "hh:mm"),
            (et_val, "hh:mm"),
            (course.duration_minutes, "0"),
            (room.id, "@"),
            (room.name, "@"),
            (n_stus, "0"),
            (room.capacity, "0"),
        ]

        fill = alt_fill if row_idx % 2 == 0 else PatternFill(fill_type=None)
        for col_num, (v, num_fmt) in enumerate(row_cells, start=1):
            c = ws_tt.cell(row=row_idx, column=col_num)
            set_safe_cell(c, v)
            c.border = cell_border
            if num_fmt and num_fmt != "@":
                c.number_format = num_fmt
            if fill.fill_type:
                c.fill = fill
            if col_num in (6, 9, 10):
                c.alignment = Alignment(horizontal="right")
            elif col_num in (3, 4, 5, 7):
                c.alignment = Alignment(horizontal="center")
            else:
                c.alignment = Alignment(horizontal="left")

        row_idx += 1

    ws_tt.freeze_panes = "A2"
    ws_tt.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(row_idx - 1, 1)}"

    # Auto-fit column widths
    for col in ws_tt.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_tt.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # Sheet 2: Run Summary
    ws_sum = wb.create_sheet(title="Run Summary")
    summary_headers = ["Property", "Value"]
    ws_sum.append(summary_headers)

    for col_num in range(1, 3):
        cell = ws_sum.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = primary_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = cell_border

    val_penalty = record.validation.penalty if record.validation else None
    breakdown = record.validation.breakdown if record.validation else {}

    summary_rows = [
        ("Run ID", record.run_id),
        ("Revision ID", record.revision_id),
        ("Problem Name", record.problem.name),
        ("Problem Hash", record.problem_hash),
        ("Algorithm", record.algorithm.upper()),
        ("Status", record.status),
        ("Optimality Proven", "Yes" if record.optimality_proven else "No"),
        ("Validation Status", "PASSED" if (record.validation and record.validation.valid) else "FAILED"),
        ("Total Penalty", val_penalty if val_penalty is not None else "N/A"),
        ("Same Day Penalty", breakdown.get("same_day_penalty", "N/A")),
        ("Short Gap Penalty", breakdown.get("short_gap_penalty", "N/A")),
        ("Spare Seats Penalty", breakdown.get("spare_seats_penalty", "N/A")),
        ("Search Compute Time (ms)", f"{record.metrics.search_compute_ms:.2f}"),
        ("Run Wall Time (ms)", f"{record.metrics.run_wall_ms:.2f}"),
        ("Nodes Generated", record.metrics.generated_nodes),
        ("Nodes Explored", record.metrics.explored_nodes),
        ("Nodes Expanded", record.metrics.expanded_nodes),
        ("Peak Frontier Size", record.metrics.peak_frontier_size),
        ("Max Depth", record.metrics.max_depth),
        ("Candidate Actions Checked", record.metrics.candidate_actions),
        ("Valid Actions", record.metrics.valid_actions),
        ("Invalid Actions (Rejected)", record.metrics.invalid_actions),
        ("Forward Pruned Actions", record.metrics.forward_pruned_actions),
        ("Created At", record.created_at),
        ("Completed At", record.completed_at or "N/A"),
    ]

    for s_idx, (prop, val) in enumerate(summary_rows, start=2):
        c1 = ws_sum.cell(row=s_idx, column=1)
        c2 = ws_sum.cell(row=s_idx, column=2)
        set_safe_cell(c1, prop)
        set_safe_cell(c2, val)
        c1.border = cell_border
        c2.border = cell_border
        c1.font = Font(name="Calibri", bold=True)

    ws_sum.column_dimensions["A"].width = 28
    ws_sum.column_dimensions["B"].width = 45

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont(FONT_REGULAR, 9)
        self.setFillColor(colors.HexColor("#64748B"))
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(792 - 36, 20, page_text)
        self.drawString(36, 20, "ExamCraft AI — Intelligent Examination Scheduling System")
        self.restoreState()


def generate_pdf_export(record: RunRecord, filter_course: Optional[str] = None, filter_room: Optional[str] = None, filter_date: Optional[str] = None) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName=FONT_BOLD,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B"),
    )
    th_style = ParagraphStyle(
        "TableHeader",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=1,
    )
    tb_style = ParagraphStyle(
        "TableBody",
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
    )
    tb_center_style = ParagraphStyle(
        "TableBodyCenter",
        parent=tb_style,
        alignment=1,
    )

    elements = []

    # Title & Metadata
    elements.append(Paragraph("ExamCraft AI — Examination Timetable", title_style))
    val_status = "VALIDATED" if (record.validation and record.validation.valid) else record.status
    penalty_text = f"Penalty: {record.validation.penalty}" if record.validation and record.validation.penalty is not None else ""
    opt_text = " (Optimal Proven)" if record.optimality_proven else ""
    meta_text = (
        f"<b>Problem:</b> {format_text_for_pdf(record.problem.name)} | <b>Algorithm:</b> {record.algorithm.upper()} | "
        f"<b>Status:</b> {val_status}{opt_text} | {penalty_text} | <b>Revision:</b> {record.revision_id[:8]}"
    )
    if filter_course or filter_room or filter_date:
        filter_parts = []
        if filter_course: filter_parts.append(f"Course '{format_text_for_pdf(filter_course)}'")
        if filter_room: filter_parts.append(f"Room '{format_text_for_pdf(filter_room)}'")
        if filter_date: filter_parts.append(f"Date '{filter_date}'")
        meta_text += f"<br/><b>Filter Active:</b> {', '.join(filter_parts)}"
    elements.append(Paragraph(meta_text, subtitle_style))
    elements.append(Spacer(1, 14))

    # Timetable data table
    norm = NormalizedProblem(record.problem)
    assignments = record.assignments or []

    data = [
        [
            Paragraph("Course Code", th_style),
            Paragraph("Course Name", th_style),
            Paragraph("Date", th_style),
            Paragraph("Time Interval", th_style),
            Paragraph("Duration", th_style),
            Paragraph("Room", th_style),
            Paragraph("Students", th_style),
        ]
    ]

    for a in assignments:
        course = norm.courses_by_id.get(a.course_id)
        slot = norm.slots_by_id.get(a.slot_id)
        room = norm.rooms_by_id.get(a.room_id)
        if not course or not slot or not room:
            continue

        if filter_course and filter_course.lower() not in course.code.lower() and filter_course.lower() not in course.name.lower():
            continue
        if filter_room and a.room_id != filter_room:
            continue
        if filter_date and slot.date != filter_date:
            continue

        placement = norm.create_placement(a.course_id, a.slot_id, a.room_id)
        n_stus = norm.course_student_count.get(a.course_id, 0)

        data.append([
            Paragraph(format_text_for_pdf(course.code), tb_style),
            Paragraph(format_text_for_pdf(course.name), tb_style),
            Paragraph(slot.date, tb_center_style),
            Paragraph(f"{placement.start_time} – {placement.end_time}", tb_center_style),
            Paragraph(f"{course.duration_minutes}m", tb_center_style),
            Paragraph(format_text_for_pdf(f"{room.name} ({room.id})"), tb_style),
            Paragraph(f"{n_stus} / {room.capacity}", tb_center_style),
        ])

    col_widths = [80, 200, 75, 100, 60, 120, 85]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    elements.append(table)
    doc.build(elements, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf
