"""
File Parser Module
==================
Encapsulates all requirements file parsing utilities (CSV, XLSX).
Converts raw file bytes into normalized lists of requirement dictionaries
with standardized 'id' and 'text' keys, regardless of source header naming.
"""
import os
import csv
import zipfile
import xml.etree.ElementTree as ET


def find_best_header(headers: list, target_list: list) -> str:
    """Finds the best matching header name from a list of candidates using exact then substring matching."""
    # Try to find exact matches first
    for target in target_list:
        for h in headers:
            if h.lower().strip() == target:
                return h
    # Substring matching, ignoring obvious incorrect overlap
    for target in target_list:
        for h in headers:
            h_lower = h.lower().strip()
            if target in h_lower:
                # Avoid matching 'fault id' for requirement 'id'
                if target == "id" and "fault" in h_lower:
                    continue
                return h
    return None

def read_csv_file(file_content: bytes) -> list:
    """Parses csv bytes into list of dictionaries with header safety mapping."""
    text = file_content.decode("utf-8", errors="ignore").splitlines()
    reader = csv.DictReader(text)
    headers = reader.fieldnames if reader.fieldnames else []
    
    # Clean headers
    headers = [h.strip() for h in headers if h]
    
    id_header = find_best_header(headers, ["id", "req_id", "requirement_id", "req id", "requirement id", "name"])
    text_header = find_best_header(headers, ["content", "requirement", "text", "description", "req_text", "req text", "requirement text", "desc"])
    
    # Fallbacks if not found
    if not id_header and headers:
        for h in headers:
            h_lower = h.lower()
            if "id" in h_lower and "fault" not in h_lower:
                id_header = h
                break
        if not id_header:
            id_header = headers[0]
            
    if not text_header and headers:
        for h in headers:
            h_lower = h.lower()
            if any(x in h_lower for x in ["req", "text", "content", "desc"]):
                text_header = h
                break
        if not text_header:
            for h in headers:
                if h != id_header:
                    text_header = h
                    break

    rows = []
    for row in reader:
        if not any(row.values()):
            continue
        req_id = row.get(id_header, "").strip() if id_header and row.get(id_header) else f"REQ-{len(rows)+1}"
        req_text = row.get(text_header, "").strip() if text_header and row.get(text_header) else ""
        
        normalized_row = {
            "id": req_id,
            "text": req_text
        }
        
        for k, v in row.items():
            if k and v:
                k_clean = k.strip()
                if k_clean != id_header and k_clean != text_header:
                    normalized_row[k_clean] = v.strip()
                    
        rows.append(normalized_row)
    return rows

def read_xlsx_file(file_content: bytes) -> list:
    """Parses .xlsx sheet rows using Python standard libraries (zipfile & xml) with header safety mapping."""
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name
        
    rows = []
    try:
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            # 1. Parse shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in zip_ref.namelist():
                ss_content = zip_ref.read('xl/sharedStrings.xml')
                root = ET.fromstring(ss_content)
                # Namespace mapping
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('ns:si', ns):
                    t = si.find('ns:t', ns)
                    if t is not None:
                        shared_strings.append(t.text)
                    else:
                        # Rich text handling
                        text_parts = [r.find('ns:t', ns).text for r in si.findall('ns:r', ns) if r.find('ns:t', ns) is not None]
                        shared_strings.append("".join(text_parts))

            # 2. Parse sheet target from workbook.xml and workbook.xml.rels
            sheet_target = 'worksheets/sheet1.xml' # default fallback
            namelist = zip_ref.namelist()
            if 'xl/workbook.xml' in namelist and 'xl/_rels/workbook.xml.rels' in namelist:
                try:
                    wb_content = zip_ref.read('xl/workbook.xml')
                    wb_root = ET.fromstring(wb_content)
                    ns_wb = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                    sheets_el = wb_root.find('ns:sheets', ns_wb)
                    if sheets_el is not None:
                        sheet_el = sheets_el.find('ns:sheet', ns_wb)
                        if sheet_el is not None:
                            # Use relationship ID to find target filename
                            r_id = sheet_el.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                            if r_id:
                                rels_content = zip_ref.read('xl/_rels/workbook.xml.rels')
                                rels_root = ET.fromstring(rels_content)
                                ns_rels = {'ns': 'http://schemas.openxmlformats.org/package/2006/relationships'}
                                for rel in rels_root.findall('ns:Relationship', ns_rels):
                                    if rel.get('Id') == r_id:
                                        sheet_target = rel.get('Target')
                                        break
                except Exception as e:
                    print(f"Error parsing workbook sheets, falling back to worksheets/sheet1.xml: {e}")

            sheet_path = 'xl/' + sheet_target
            if sheet_path not in namelist:
                sheet_path = 'xl/worksheets/sheet1.xml'

            sheet_content = zip_ref.read(sheet_path)
            root = ET.fromstring(sheet_content)
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            raw_rows = []
            for row_el in root.findall('.//ns:row', ns):
                row_cells = {}
                for c in row_el.findall('ns:c', ns):
                    r_attr = c.get('r') # e.g. A1, B2
                    col_letter = ''.join([char for char in r_attr if char.isalpha()])
                    t_attr = c.get('t') # e.g. 's' for shared string
                    v = c.find('ns:v', ns)
                    val = ""
                    if v is not None:
                        val = v.text
                        if t_attr == 's':
                            val = shared_strings[int(val)]
                    row_cells[col_letter] = val
                raw_rows.append(row_cells)
                
            if raw_rows:
                # Use first row as headers
                header_row = raw_rows[0]
                headers = {col: val.strip() for col, val in header_row.items() if val}
                header_names = list(headers.values())
                
                id_header = find_best_header(header_names, ["id", "req_id", "requirement_id", "req id", "requirement id", "name"])
                text_header = find_best_header(header_names, ["content", "requirement", "text", "description", "req_text", "req text", "requirement text", "desc"])
                
                # Fallback mapping if not found
                if not id_header and header_names:
                    for h in header_names:
                        if "id" in h.lower() and "fault" not in h.lower():
                            id_header = h
                            break
                    if not id_header:
                        id_header = header_names[0]
                        
                if not text_header and header_names:
                    for h in header_names:
                        if any(x in h.lower() for x in ["req", "text", "content", "desc"]):
                            text_header = h
                            break
                    if not text_header:
                        for h in header_names:
                            if h != id_header:
                                text_header = h
                                break
                                
                # Map column letters to normalized key names
                col_mapping = {}
                for col, name in headers.items():
                    if name == id_header:
                        col_mapping[col] = "id"
                    elif name == text_header:
                        col_mapping[col] = "text"
                    else:
                        col_mapping[col] = name
                
                for r in raw_rows[1:]:
                    if not any(r.values()):
                        continue
                    normalized_row = {}
                    for col, val in r.items():
                        if col not in col_mapping:
                            continue
                        key = col_mapping[col]
                        normalized_row[key] = val.strip() if val else ""
                    
                    if "id" not in normalized_row or not normalized_row["id"]:
                        normalized_row["id"] = f"REQ-{len(rows)+1}"
                    if "text" not in normalized_row:
                        normalized_row["text"] = ""
                        
                    # Copy remaining metadata
                    for col, val in r.items():
                        if col in headers:
                            name = headers[col]
                            if name != id_header and name != text_header and val:
                                normalized_row[name] = val.strip()
                                
                    if "text" in normalized_row:
                        rows.append(normalized_row)
    finally:
        try:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
            
    return rows

def parse_requirements_file(file_content: bytes, filename: str) -> list:
    """Routes file content to the appropriate parser based on file extension."""
    if filename.endswith(".csv"):
        return read_csv_file(file_content)
    elif filename.endswith(".xlsx"):
        return read_xlsx_file(file_content)
    return []
