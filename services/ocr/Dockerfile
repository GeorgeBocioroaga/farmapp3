FROM paddlepaddle/paddle:2.6.2
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --no-deps paddleocr==2.7.0.3
COPY app.py ./
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
