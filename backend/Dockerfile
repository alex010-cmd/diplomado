FROM python:3.12-slim
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
# Este contenedor va en la VPS del BACKEND (VPC Backend, subred privada).
# Solo escucha en 8000; el acceso se limita por Security Group al Frontend.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
