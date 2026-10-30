import os
import uuid
import shutil
import json
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

UPLOAD_DIR = os.path.abspath("uploads")
AUDIO_DIR = os.path.abspath("audio_chunks")
MAP_FILE = os.path.join(UPLOAD_DIR, "library_map.json")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

def load_map():
    if os.path.exists(MAP_FILE):
        try:
            with open(MAP_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_map(mapping):
    try:
        with open(MAP_FILE, "w") as f:
            json.dump(mapping, f)
        print(f"Successfully saved library map to {MAP_FILE}")
    except Exception as e:
        print(f"Error saving library map: {e}")

app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

job_status = {}
executor = ThreadPoolExecutor(max_workers=os.cpu_count() or 4)

def split_text_into_chunks(text, chunk_size=500):
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

async def process_book_task(file_id: str, chunks: list):
    total = len(chunks)
    job_status[file_id] = {"status": "processing", "progress": 0, "total": total, "error": None}

    try:
        loop = asyncio.get_event_loop()
        tasks = [loop.run_in_executor(executor, generate_audio_chunk, text, f"{file_id}_{i}")
                 for i, text in enumerate(chunks)]

        for count, future in enumerate(asyncio.as_completed(tasks)):
            await future
            if file_id in job_status:
                progress = int(((count + 1) / total) * 100)
                job_status[file_id]["progress"] = progress

        if file_id in job_status:
            job_status[file_id]["status"] = "completed"
    except Exception as e:
        job_status[file_id]["status"] = "error"
        job_status[file_id]["error"] = str(e)

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    original_name = file.filename
    extension = file.filename.split(".")[-1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{extension}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        mapping = load_map()
        mapping[file_id] = original_name
        save_map(mapping)

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

@app.get("/status/{file_id}")
async def get_status(file_id: str):
    status = job_status.get(file_id)
    if not status:
        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        if os.path.exists(chunks_path):
            with open(chunks_path, "r") as f:
                chunks = json.load(f)
            return {
                "status": "unknown",
                "progress": 0,
                "total": len(chunks),
                "chunks": chunks
            }
        raise HTTPException(status_code=404, detail="File not found")

    chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
    if os.path.exists(chunks_path):
        with open(chunks_path, "r") as f:
            status["chunks"] = json.load(f)

    return status

@app.get("/library")
async def list_library():
    library = []
    mapping = load_map()
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(".") or filename.endswith(".json"):
            continue

        file_id = filename.split(".")[0]
        original_name = mapping.get(file_id, filename)
        status = job_status.get(file_id, {}).get("status", "uploaded")

        library.append({
            "file_id": file_id,
            "name": original_name,
            "status": status
        })
    return library

@app.delete("/delete/{file_id}")
async def delete_file(file_id: str):
    try:
        mapping = load_map()
        if file_id in mapping:
            del mapping[file_id]
            save_map(mapping)

        for filename in os.listdir(UPLOAD_DIR):
            if filename.startswith(file_id):
                os.remove(os.path.join(UPLOAD_DIR, filename))

        for filename in os.listdir(AUDIO_DIR):
            if filename.startswith(file_id):
                os.remove(os.path.join(AUDIO_DIR, filename))

        if file_id in job_status:
            del job_status[file_id]

        return {"message": "Deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/generate-chunk/{file_id}/{chunk_index}")
async def generate_chunk(file_id: str, chunk_index: int):
    filename = f"{file_id}_{chunk_index}.wav"
    file_path = os.path.join(AUDIO_DIR, filename)

    if os.path.exists(file_path):
        return FileResponse(file_path)

    try:
        chunks_path = os.path.join(UPLOAD_DIR, f"{file_id}_chunks.json")
        with open(chunks_path, "r") as f:
            chunks = json.load(f)

        if chunk_index < 0 or chunk_index >= len(chunks):
            raise HTTPException(status_code=404, detail="Chunk not found")

        generate_audio_chunk(chunks[chunk_index], f"{file_id}_{chunk_index}")
        return FileResponse(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
