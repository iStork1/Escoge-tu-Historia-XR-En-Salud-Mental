import sys
from pathlib import Path
from docx import Document

def md_to_docx(md_path: Path, docx_path: Path):
    text = md_path.read_text(encoding='utf-8')
    doc = Document()
    for line in text.splitlines():
        if line.startswith('# '):
            doc.add_heading(line[2:].strip(), level=1)
        elif line.startswith('## '):
            doc.add_heading(line[3:].strip(), level=2)
        elif line.startswith('+ '):
            doc.add_paragraph(line[2:].strip(), style='List Bullet')
        elif line.startswith('- '):
            doc.add_paragraph(line[2:].strip(), style='List Bullet')
        elif line.startswith('```'):
            # naive code block handling: add as plain paragraph
            doc.add_paragraph(line)
        else:
            doc.add_paragraph(line)
    doc.save(str(docx_path))

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python scripts/generate_docx_from_md.py <input.md> <output.docx>')
        sys.exit(1)
    md = Path(sys.argv[1])
    out = Path(sys.argv[2])
    if not md.exists():
        print('Input MD not found:', md)
        sys.exit(2)
    md_to_docx(md, out)
    print('Saved DOCX to:', out)
