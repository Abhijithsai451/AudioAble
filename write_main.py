import os

content = """
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
            job_//C/Users/abhijithsai/PycharmProjects/AudioAble/backend/main.py, "wb") as buffer:
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
"""
with open("/sessions/keen-sleepy-goldberg/mnt/AudioAble/backend/main.py", "w") as f:
    f.write(content)
