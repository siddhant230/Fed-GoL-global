import os
from pathlib import Path
import json
import base64
from datetime import datetime, timedelta
from syftbox.lib import Client
import requests
from typing import List
import shutil

API_NAME = "fed_gol"


def network_participants(datasite_path: Path) -> List[str]:
    entries = os.listdir(datasite_path)
    return [entry for entry in entries if Path(datasite_path / entry).is_dir()]


def send_event_to_flask(event_data: dict) -> bool:
    try:
        response = requests.post(
            'http://localhost:8091/internal/event', json=event_data)
        return response.status_code == 200
    except requests.RequestException:
        return False


def get_latest_events(
    datasites_path: Path,
    peers: List[str],
    last_processed_file: Path = Path("last_processed.json")
) -> List[dict]:
    active_peers = []
    all_new_events = []

    for peer in peers:
        tracker_folder_images = datasites_path / \
            peer / "api_data" / API_NAME / "images"
        tracker_folder_events = datasites_path / \
            peer / "api_data" / API_NAME / "events"
        dest_path = "./static/images"

        if not tracker_folder_images.exists():
            continue

        active_peers.append(peer)

        # Copy new images
        image_extensions = {".jpg", ".jpeg", ".png"}
        for file in tracker_folder_images.glob("*"):
            if file.suffix.lower() in image_extensions:
                shutil.copy(file, Path(dest_path) / file.name)

        if not tracker_folder_events.exists():
            continue

        # Process events
        last_timestamp = None
        if last_processed_file.exists():
            with open(last_processed_file) as f:
                processed_data = json.load(f)
                if peer in processed_data:
                    last_timestamp = datetime.strptime(
                        processed_data[peer]['timestamp'],
                        "%Y%m%d_%H%M%S"
                    )

        new_events = []
        with open(tracker_folder_events / "event.txt") as f:
            for line in f:
                image_path, x, y, timestamp = line.strip().split(',')
                timestamp = datetime.strptime(timestamp, "%Y%m%d_%H%M%S")

                if not last_timestamp:
                    last_timestamp = timestamp - timedelta(seconds=1)

                if timestamp > last_timestamp:
                    with open(image_path, 'rb') as img_file:
                        img_data = base64.b64encode(
                            img_file.read()).decode('utf-8')

                    event_data = {
                        'peer': peer,
                        'image': img_data,
                        'type': Path(image_path).suffix[1:],
                        'x': int(x),
                        'y': int(y),
                        'timestamp': timestamp.strftime('%Y%m%d_%H%M%S')
                    }
                    print(peer)
                    send_event_to_flask(event_data)
                    new_events.append(event_data)

        if new_events:
            latest_timestamp = max(event['timestamp'] for event in new_events)

            processed_data = {}
            if last_processed_file.exists():
                with open(last_processed_file) as f:
                    processed_data = json.load(f)

            processed_data[peer] = {'timestamp': latest_timestamp}

            with open(last_processed_file, 'w') as f:
                json.dump(processed_data, f, indent=2)

            all_new_events.extend(new_events)

    return all_new_events


def main():
    client = Client.load()

    # Create input folder for the current user
    image_input_path = client.datasite_path / "api_data" / API_NAME / "images"
    os.makedirs(image_input_path, exist_ok=True)

    # Fetch all new added images
    peers = network_participants(client.datasite_path.parent)
    new_events = get_latest_events(client.datasite_path.parent, peers)

    print(f"Processed {len(new_events)} new events")
    return new_events


if __name__ == "__main__":
    main()
