import fitz # PyMuPDF
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import mobi

def extract_text_from_pdf(file_path):
    text = ""
    with fitz.open(file_path) as doc:
        for page in doc:
            text += page.get_text() + "\n"
    return text

def extract_text_from_epub(file_path):
    book = epub.read_epub(file_path)
    text = ""
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), 'html.parser')
            text += soup.get_text() + "\n"
    return text

def extract_text_from_mobi(file_path):
    # The mobi library provides a simple way to extract text
    with open(file_path, 'rb') as f:
        # mobi.extract() returns a tuple (title, author, content)
        # Content is usually a string
        _, _, content = mobi.extract(f)
        return content

def extract_text(file_path, extension):
    if extension == 'pdf':
        return extract_text_from_pdf(file_path)
    elif extension == 'epub':
        return extract_text_from_epub(file_path)
    elif extension in ['mobi', 'azw3']:
        return extract_text_from_mobi(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {extension}")
