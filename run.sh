#!/bin/sh
set -e

# Configuration
VENV_DIR=".venv"
PORT=5000
PID_FILE="pid.txt"
LOG_DIRECTORY="logs"
MAIN_PID_FILE="main_pid.txt"


# Function to check if the process is actually running
is_process_running() {
    local pid=$1
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        # Also verify it's our Flask app
        if ps -p "$pid" -o command= | grep -q "python main.py"; then  # Changed to app.py
            return 1  # Process is running
        fi
    fi
    return 0  # Process is not running
}

# Function to check if Flask is responding
is_flask_responding() {
    if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
        return 0  # Flask is responding
    fi
    return 1  # Flask is not responding
}

# Setup virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found. Creating one..."
    uv venv -p 3.9 "$VENV_DIR"
    echo "Virtual environment created successfully."
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
. "$VENV_DIR/bin/activate"

# Install/upgrade requirements
uv pip install --upgrade -r requirements.txt --quiet

# Check if we need to start the app
need_to_start=1

# Check if there's an existing process
if [ -f "$PID_FILE" ]; then
    EXISTING_PID=$(cat "$PID_FILE")
    echo "Found existing PID (PID: $EXISTING_PID)"
    if is_process_running "$EXISTING_PID"; then
        echo "Flask application is already running (PID: $EXISTING_PID)"
        need_to_start=0
    else
        echo "Found stale PID file, will start new instance"
        rm "$PID_FILE"
    fi
fi

if [ $need_to_start -eq 1 ]; then
    # Start the Flask application in the background
    if [ ! -d "$LOG_DIRECTORY" ]; then
        echo "$LOG_DIRECTORY does not exist. Creating one."
        mkdir -p "$LOG_DIRECTORY"
    fi
    nohup python3 app.py > logs/flask.log 2>&1 & 
    APP_PID=$!
    echo "$APP_PID" > "$PID_FILE"

    # Wait a moment to ensure the app starts
    sleep 2

    # Verify the app started successfully
    if is_process_running "$APP_PID"; then
        echo "Application started successfully!"
        echo "PID: $APP_PID"
    else
        echo "Failed to start application. Check logs for details."
        rm -f "$PID_FILE"
        exit 1
    fi
else
    echo "No action needed - application is already running"
fi


# Check if main.py is already running
main_need_to_start=1
if [ -f "$MAIN_PID_FILE" ]; then
    EXISTING_MAIN_PID=$(cat "$MAIN_PID_FILE")
    if ps -p "$EXISTING_MAIN_PID" > /dev/null 2>&1; then
        echo "Main script is already running (PID: $EXISTING_MAIN_PID)"
        main_need_to_start=0
    else
        echo "Found stale main PID file, will start new instance"
        rm "$MAIN_PID_FILE"
    fi
fi

# Only start main.py if it's not already running
if [ $main_need_to_start -eq 1 ]; then
    nohup python3 main.py > logs/main.log 2>&1 &
    MAIN_PID=$!
    echo "$MAIN_PID" > "$MAIN_PID_FILE"
    echo "Started main script (PID: $MAIN_PID)"
fi

# Deactivate virtual environment
deactivate