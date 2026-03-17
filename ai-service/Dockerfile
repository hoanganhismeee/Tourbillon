# AI service — Debian-based for future AI/ML dependencies (PyTorch, transformers, etc.)
FROM python:3.12-bookworm
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
