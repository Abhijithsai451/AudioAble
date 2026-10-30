import os
import uuid
import shutil
import json
import re
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from backend.parser import extract_text
from backend.tts_engine import generate_audio_chunk

def split_text_into_chunks(text):
    """Splits text into chunks of approximately 1000 characters, respecting paragraph boundaries."""
    chunks = []
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for p in paragraphs:
        if len(current_chunk) + len(p) < 1000:
            current_chunk += p + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = p + "\n\n"

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
AUDIO_DIR = "audio_chunks"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

job_status = {}
executor = ThreadPoolExecutor(max_workers=os.cpu_count() or 4)

async def process_book_task(file_id: str, file_path: str, extension: str, original_filename: str):
    try:
        # Move extraction and chunking to the background
        text = extract_text(file_path, extension)
        chunks = split_text_into_chunks(text)
        total = len(chunks)

        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        with open(chunks_path, "w") as f:
            json.dump({"filename": original_filename, "chunks": chunks}, f)

        job_status[file_id] = {"status": "processing", "progress": 0, "total": total, "error": None}

        loop = asyncio.get_event_loop()
        tasks = [loop.run_in_executor(executor, generate_audio_chunk, text_chunk, f"{file_id}_{i}")
                 for i, text_chunk in enumerate(chunks)]

        for count, future in enumerate(asyncio.as_completed(tasks)):
            await future
            job_status[file_id]["progress"] = count + 1

        job_status[file_id]["status"] = "completed"
    except Exception as e:
        job_status[file_id] = {"status": "failed", "progress": 0, "total": 0, "error": str(e)}

@app.get("/library")
async def list_books():
    books = []
    for filename in os.listdir(UPLOAD_DIR):
        if filename.endswith("_chunks.json"):
            file_id = filename.replace("_chunks.json", "")
            original_name = "Unknown Book"
            try:
                with open(os.path.join(UPLOAD_DIR, filename), "r") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "filename" in data:
                        original_name = data["filename"]
            except:
                pass

            books.append({
                "file_id": file_id,
                "name": original_name,
                "status": job_status.get(file_id, {}).get("status", "unknown")
            })
    return books

@app.delete("/delete/{file_id}")
async def delete_book(file_id: str):
    """Delete a book and all its associated audio chunks."""
    try:
        # 1. Delete the chunks metadata file
        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        if os.path.exists(chunks_path):
            os.remove(chunks_path)

        # 2. Delete the original uploaded file (find it by ID)
        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id) and not filename.endswith(".json"):
                os.remove(os.path.join(UPLOAD_DIR, filename))

        # 3. Delete all generated audio chunks
        for filename in os.listdir(AUDIO_DIR):
            if filename.startswith(file_id):
                os.remove(os.path.join(AUDIO_DIR, filename))

        # 4. Remove from active memory
        if file_id in job_status:
            del job_status[file_id]

        return {"message": "Book deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting book: {str(e)}")

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    original_filename = file.filename
    extension = original_filename.split(".")[-1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{extension}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Everything else happens in the background
    background_tasks.add_task(process_book_task, file_id, file_path, extension, original_filename)

    return {
        "file_id": file_id,
        "status": "processing"
    }

@app.get("/status/{file_id}")
async def get_status(file_id: str):
    if file_id not in job_status:
        # Recovery: check if the book exists on disk
        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        if not os.path.exists(chunks_path):
            raise HTTPException(status_code=404, detail="Job not found")

        # If it exists on disk but not in memory, it was a previous session
        job_status[file_id] = {"status": "completed", "progress": 100, "total": 0, "error": None}

    # Try to find the extension of the original file
    extension = "pdf" # default
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id) and not filename.endswith(".json"):
            extension = filename.split(".")[-1]
            break

    status = job_status.get(file_id)
    return {**status, "extension": extension}
