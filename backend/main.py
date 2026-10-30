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

async def process_book_task(file_id: str, chunks: list):
    total = len(chunks)
    job_status[file_id] = {"status": "processing", "progress": 0, "total": total, "error": None}

    try:
        loop = asyncio.get_event_loop()
        tasks = [loop.run_in_executor(executor, generate_audio_chunk, text, f"{file_id}_{i}")
                 for i, text in enumerate(chunks)]

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

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    original_filename = file.filename
    extension = original_filename.split(".")[-1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{extension}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        text = extract_text(file_path, extension)
        chunks = split_text_into_chunks(text)

        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        with open(chunks_path, "w") as f:
            json.dump({"filename": original_filename, "chunks": chunks}, f)

        background_tasks.add_task(process_book_task, file_id, chunks)

        return {
            "file_id": file_id,
            "total_chunks": len(chunks),
            "chunks": chunks,
            "status": "processing",
            "extension": extension
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/status/{file_id}")
async def get_status(file_id: str):
    if file_id not in job_status:
        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        if not os.path.exists(chunks_path):
            raise HTTPException(status_code=404, detail="Job not found")

        job_status[file_id] = {"status": "completed", "progress": 100, "total": 0, "error": None}

    status = job_status[file_id].copy()
    extension = "unknown"
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id) and not filename.endswith(".json"):
            extension = filename.split(".")[-1].lower()
            break
    status["extension"] = extension

    chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
    if os.path.exists(chunks_path):
        with open(chunks_path, "r") as f:
            data = json.load(f)
            chunks = data["chunks"] if isinstance(data, dict) else data
        return {**status, "chunks": chunks}

    return status

@app.get("/generate-chunk/{file_id}/{chunk_index}")
async def get_chunk(file_id: str, chunk_index: int):
    chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
    if not os.path.exists(chunks_//C/Users/abhijithsai/PycharmProjects/AudioAble/backend/main.py, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        text = extract_text(file_path, extension)
        chunks = split_text_into_chunks(text)

        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        with open(chunks_path, "w") as f:
            json.dump(chunks, f)

        background_tasks.add_task(process_book_task, file_id, chunks)

        return {
            "file_id": file_id,
            "total_chunks": len(chunks),
            "chunks": chunks,
            "status": "processing"
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
