FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY pyproject.toml .
COPY healthcare_crossroads/ healthcare_crossroads/

RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE 8080

# Run the API
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "healthcare_crossroads.api:app"]
