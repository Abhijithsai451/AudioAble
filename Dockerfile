# Base image - moving to bookworm (Debian 12) for updated and more stable mirrors
FROM python:3.10-bookworm

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    g++ \
    ffmpeg \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Piper binary
# We download the pre-compiled piper binary from the official releases
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then PIPER_ARCH="amd64"; elif [ "$ARCH" = "aarch64" ]; then PIPER_ARCH="arm64"; else PIPER_ARCH="amd64"; fi && \
    wget -q https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_${PIPER_ARCH}.tar.gz \
    && tar -xzf piper_${PIPER_ARCH}.tar.gz -C /app \
    && chmod +x /app/piper/piper \
    && rm -rf piper_${PIPER_ARCH}.tar.gz

# Set environment variable so Piper can find its shared libraries
ENV LD_LIBRARY_PATH="/app/piper"

# Create models directory and download a default voice
RUN mkdir -p /models \
    && wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx -O /models/en_US-lessac-medium.onnx \
    && wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json -O /models/en_US-lessac-medium.onnx.json

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./backend /app/backend

# Create upload and audio directories
RUN mkdir -p /app/uploads /app/audio_chunks

# Expose port
EXPOSE 8000

# Start the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
