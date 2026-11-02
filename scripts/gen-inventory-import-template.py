"""Generate public/templates/Inventory_Import_Template.xlsx for /catalog/inventory-import.

Preferred format: two sheets Catalog + Variant (matches inventoryExcelParser catalog_variant mode).
Legacy single-sheet Inventory workbooks are still accepted by the API.

Usage: python3 scripts/gen-inventory-import-template.py [extra output path ...]
"""

import shutil
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'templates' / 'Inventory_Import_Template.xlsx'

HEADER_FILL = PatternFill('solid', fgColor='1F4E78')
REQUIRED_FILL = PatternFill('solid', fgColor='C00000')
SAMPLE_FILL = PatternFill('solid', fgColor='FFF2CC')
WHITE_BOLD = Font(bold=True, color='FFFFFF')

# (header, required, width, text_fmt, description, format, example)
CATALOG_COLUMNS = [
    ('SKU', True, 18, True, 'Catalog / product SKU (parent). Unique per organisation.', 'Text.', 'IPHONE-DUO'),
    ('Product Name', True, 36, False, 'Base product name (not a sellable variant title).', 'Text.', 'iPhone Duo'),
    ('Description', False, 40, False, 'Long description.', 'Text.', 'Flagship dual-SIM phone'),
    ('Category', False, 18, False, 'Resolved to classification ID (created if missing).', 'Text.', 'Phones'),
    ('Sub-Category', False, 18, False, 'Resolved to classification ID (created if missing).', 'Text.', 'Smartphones'),
    ('Brand', False, 16, False, 'Resolved to brand ID (created if missing).', 'Text.', 'Apple'),
    ('UOM', False, 10, False, 'Unit of measure — resolved to ID.', 'Text.', 'PCS'),
    ('Pack Size', False, 12, True, 'Pack size — resolved to ID.', 'Text.', '1'),
    ('Tax %', False, 10, False, 'VAT rate; tax code created/matched.', '20 or 0.2 = 20%.', '20'),
    ('Currency', False, 10, False, 'Product currency.', 'ISO code.', 'GBP'),
    ('Status', False, 12, False, 'Blank = Active.', 'Active / Inactive / Discontinued.', 'Active'),
    ('Remarks', False, 28, False, 'Internal notes.', 'Text.', 'Sample catalog row'),
]

VARIANT_COLUMNS = [
    ('Catalog SKU', True, 16, True, 'Must match a Catalog sheet SKU (or an existing product).', 'Text.', 'IPHONE-DUO'),
    ('Variant SKU', True, 20, True, 'Sellable SKU (unique).', 'Text.', 'IPHONE-DUO-256-BLK'),
    ('Variant Name', False, 28, False, 'Defaults to options or variant SKU.', 'Text.', '256GB Black'),
    ('Option1 Name', False, 14, False, 'e.g. Storage', 'Text.', 'Storage'),
    ('Option1 Value', False, 14, False, 'e.g. 256GB', 'Text.', '256GB'),
    ('Option2 Name', False, 14, False, 'e.g. Colour', 'Text.', 'Colour'),
    ('Option2 Value', False, 14, False, 'e.g. Black', 'Text.', 'Black'),
    ('Barcode', False, 16, True, 'Primary barcode.', 'Digits as text.', '2000000001012'),
    ('Cost Price', False, 12, False, 'Unit cost.', 'Number.', '420'),
    ('Selling Price', False, 12, False, 'Unit sell price.', 'Number.', '799'),
    ('Opening Quantity', False, 12, False, 'Stock on hand (needs Warehouse).', 'Whole number.', '12'),
    ('Warehouse', False, 28, False, 'Matched by name; created if missing.', 'Warehouse name.', 'Main Warehouse'),
    ('Bin', False, 12, True, 'Bin code/name → bins.id (created if missing).', 'Text.', 'A-01'),
    ('Rack', False, 12, True, 'Rack label stored on the bin.', 'Text.', 'R1'),
    ('Reorder Level', False, 12, False, 'Reorder point.', 'Whole number.', '4'),
    ('Reorder Quantity', False, 12, False, 'Reorder qty.', 'Whole number.', '10'),
    ('Status', False, 12, False, 'Blank = Active.', 'Active / Inactive / Discontinued.', 'Active'),
]

CATALOG_SAMPLES = [
    ['IPHONE-DUO', 'iPhone Duo', 'SAMPLE — delete before importing', 'Phones', 'Smartphones', 'Apple', 'PCS', '1', 20, 'GBP', 'Active', 'Sample catalog'],
    ['PIXEL-PRO', 'Pixel Pro', 'SAMPLE — delete before importing', 'Phones', 'Smartphones', 'Google', 'PCS', '1', 20, 'GBP', 'Active', 'Sample catalog'],
    ['CASE-CLEAR', 'Clear Case', 'SAMPLE — accessories', 'Accessories', 'Cases', 'Generic', 'PCS', '1', 20, 'GBP', 'Active', ''],
]

VARIANT_SAMPLES = [
    ['IPHONE-DUO', 'IPHONE-DUO-256-BLK', '256GB Black', 'Storage', '256GB', 'Colour', 'Black', '2000000001012', 420, 799, 12, 'Main Warehouse', 'A-01', 'R1', 4, 10, 'Active'],
    ['IPHONE-DUO', 'IPHONE-DUO-256-SLV', '256GB Silver', 'Storage', '256GB', 'Colour', 'Silver', '2000000001029', 420, 799, 8, 'Main Warehouse', 'A-02', 'R1', 4, 10, 'Active'],
    ['IPHONE-DUO', 'IPHONE-DUO-512-BLK', '512GB Black', 'Storage', '512GB', 'Colour', 'Black', '2000000001036', 480, 899, 5, 'Main Warehouse', 'A-03', 'R2', 2, 6, 'Active'],
    ['PIXEL-PRO', 'PIXEL-PRO-128-OBS', '128GB Obsidian', 'Storage', '128GB', 'Colour', 'Obsidian', '2000000002019', 310, 649, 15, 'Main Warehouse', 'B-01', 'R3', 5, 12, 'Active'],
    ['CASE-CLEAR', 'CASE-CLEAR-01', 'Clear Case Standard', '', '', '', '', '2000000003016', 1.2, 9.99, 40, 'Main Warehouse', 'C-01', 'R4', 10, 40, 'Active'],
]


def style_header(ws, columns):
    for col, (header, required, width, text_fmt, desc, allowed, _) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = WHITE_BOLD
        cell.fill = REQUIRED_FILL if required else HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='center')
        note = f"{'REQUIRED' if required else 'Optional'}. {desc}\nFormat: {allowed}"
        cell.comment = Comment(note, 'Zaam ERP', width=320, height=140)
        ws.column_dimensions[cell.column_letter].width = width
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = 'B2'


def write_samples(ws, columns, samples):
    for r, values in enumerate(samples, start=2):
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=r, column=col, value=None if value == '' else value)
            cell.fill = SAMPLE_FILL
            if columns[col - 1][3]:
                cell.number_format = '@'
    for col, spec in enumerate(columns, start=1):
        if spec[3]:
            letter = ws.cell(row=1, column=col).column_letter
            for r in range(len(samples) + 2, 501):
                ws[f'{letter}{r}'].number_format = '@'


def add_status_validation(ws, columns):
    headers = [c[0] for c in columns]
    if 'Status' not in headers:
        return
    letter = ws.cell(row=1, column=headers.index('Status') + 1).column_letter
    dv = DataValidation(type='list', formula1='"Active,Inactive,Discontinued"', allow_blank=True)
    dv.add(f'{letter}2:{letter}1000')
    ws.add_data_validation(dv)


def build() -> Workbook:
    wb = Workbook()

    catalog = wb.active
    catalog.title = 'Catalog'
    style_header(catalog, CATALOG_COLUMNS)
    write_samples(catalog, CATALOG_COLUMNS, CATALOG_SAMPLES)
    add_status_validation(catalog, CATALOG_COLUMNS)

    variant = wb.create_sheet('Variant')
    style_header(variant, VARIANT_COLUMNS)
    write_samples(variant, VARIANT_COLUMNS, VARIANT_SAMPLES)
    add_status_validation(variant, VARIANT_COLUMNS)

    ins = wb.create_sheet('Instructions')
    lines = [
        ['Zaam two-sheet inventory import (Catalog + Variant)'],
        [],
        ['How to use'],
        ['1. Fill the Catalog sheet first (one row per base product). Required: SKU and Product Name.'],
        ['2. Fill the Variant sheet with sellable SKUs. Catalog SKU must match a Catalog row (or an existing product).'],
        ['3. Delete the yellow SAMPLE rows before importing.'],
        ['4. In ERP go to Catalog > Inventory Import, Preview (shows Catalog count + Variant count separately), then Import.'],
        ['5. Category / Brand / UOM / Pack Size are resolved by name to classification IDs; missing ones are created and assigned.'],
        ['6. Bin is resolved by code/name to bins.id (created if missing). Rack is stored on that bin. Stock needs Warehouse filled.'],
        ['7. Duplicate SKUs: Skip existing (default) or Update existing.'],
        ['8. Dates are UK day/month: dd/mm/yyyy. Column order does not matter; headers are matched case-insensitively.'],
        ['9. Legacy single-sheet "Inventory" workbooks are still accepted, but Catalog + Variant is preferred.'],
        [],
        ['Catalog columns'],
        ['Column', 'Required', 'What it does', 'Allowed values / format', 'Example'],
    ]
    for line in lines:
        ins.append(line)
    cat_header_row = len(lines)
    for header, required, _, _, desc, allowed, example in CATALOG_COLUMNS:
        ins.append([header, 'Yes' if required else 'No', desc, allowed, example])

    ins.append([])
    ins.append(['Variant columns'])
    ins.append(['Column', 'Required', 'What it does', 'Allowed values / format', 'Example'])
    var_header_row = cat_header_row + 1 + len(CATALOG_COLUMNS) + 3
    for header, required, _, _, desc, allowed, example in VARIANT_COLUMNS:
        ins.append([header, 'Yes' if required else 'No', desc, allowed, example])

    ins['A1'].font = Font(bold=True, size=14)
    ins['A3'].font = Font(bold=True)
    for row_idx in (cat_header_row, var_header_row):
        for cell in ins[row_idx]:
            cell.font = WHITE_BOLD
            cell.fill = HEADER_FILL
    for letter, width in zip('ABCDE', (22, 10, 60, 40, 28)):
        ins.column_dimensions[letter].width = width
    return wb


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build().save(OUT)
    print(f'Wrote {OUT}')
    for extra in sys.argv[1:]:
        shutil.copyfile(OUT, extra)
        print(f'Copied to {extra}')


if __name__ == '__main__':
    main()
