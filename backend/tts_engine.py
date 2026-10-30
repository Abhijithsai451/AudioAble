import subprocess
import os
import uuid
import time

PIPER_BINARY = "/app/piper/piper" # Path in the final Docker container
MODEL_PATH = "/models/en_US-lessac-medium.onnx" # Default voice model
CONFIG_PATH = "/models/en_US-lessac-medium.onnx.json"

def generate_audio_chunk(text: str, chunk_id: str):
    output_filename = f"{chunk_id}.wav"
    output_path = os.path.join("audio_chunks", output_filename)

    start_time = time.time()
    try:
        # Piper takes input from stdin
        process = subprocess.Popen(
            [
                PIPER_BINARY,
                "--model", MODEL_PATH,
                "--config", CONFIG_PATH,
                "--output_file", output_path
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        stdout, stderr = process.communicate(input=text)

        if process.returncode != 0:
            raise Exception(f"Piper error: {stderr}")

        elapsed = time.time() - start_time
        print(f"Chunk {chunk_id} generated in {elapsed:.2f}s")
        return output_filename
    except Exception as e:
        print(f"TTS Generation failed for {chunk_id}: {e}")
        raise e
