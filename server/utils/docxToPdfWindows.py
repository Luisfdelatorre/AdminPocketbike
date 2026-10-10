import sys
import os

try:
    import win32com.client
except ImportError:
    sys.stderr.write("win32com module not available\n")
    sys.exit(1)

if len(sys.argv) < 3:
    sys.stderr.write("Usage: python docxToPdfWindows.py <input.docx> <output.pdf>\n")
    sys.exit(1)

src = os.path.abspath(sys.argv[1])
dst = os.path.abspath(sys.argv[2])

if not os.path.exists(src):
    sys.stderr.write(f"Source file not found: {src}\n")
    sys.exit(1)

word = win32com.client.Dispatch("Word.Application")
word.Visible = False
word.DisplayAlerts = 0
try:
    doc = word.Documents.Open(src, ReadOnly=True)
    doc.SaveAs(dst, FileFormat=17) # 17 = wdFormatPDF
    doc.Close(False)
    sys.exit(0)
except Exception as e:
    sys.stderr.write(f"Conversion error: {e}\n")
    sys.exit(1)
finally:
    try:
        word.Quit()
    except Exception:
        pass
