FROM python:3.10-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
  PIP_NO_CACHE_DIR=1 \
  GFPGAN_CACHE_DIR=/opt/render/project/.cache/gfpgan \
  GFPGAN_MAX_INPUT_EDGE=1600 \
  GFPGAN_UPSCALE=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --upgrade pip setuptools wheel \
  && python -m pip install -r requirements.txt

# Copy the app PLUS its sibling modules (cube_lut, lut_library, hsl_retouch,
# portrait_retouch, subject_retouch, freq_sep_save) — app.py imports these at
# module load, so copying app.py alone crashes the container on startup with
# ModuleNotFoundError: No module named 'cube_lut'.
COPY *.py ./

EXPOSE 10000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "10000", "--workers", "1", "--timeout-keep-alive", "75"]
