from flask import Flask, Response, render_template, request, send_from_directory
from queue import Queue
import json
import time

app = Flask(__name__)
event_queue = Queue()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)

@app.route('/health')
def health():
    return "OK", 200

@app.route('/internal/event', methods=['POST'])
def receive_event():
    event_data = request.get_json()
    event_queue.put(event_data)
    return "OK", 200

@app.route('/events')
def events():
    def generate():
        while True:
            if not event_queue.empty():
                data = event_queue.get()
                print("Sending event:", data)
                yield f"data: {json.dumps(data)}\n\n"
            time.sleep(0.1)
    print("Client connected to event stream") 
    return Response(generate(), mimetype='text/event-stream')

app.run(debug=False, port=8091)