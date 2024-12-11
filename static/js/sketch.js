// Game of Life
// cleaner code, only dithering based

let generation = 0;

let grid;
let cols;
let rows;
let resolution = 5;
let N = 100; //patch image size
let frame_rate = 5;
let CANVAS_SIZE = 2500;
const generationTxt = document.getElementById('generation');
const aliveTxt = document.getElementById('alive');
const deathsTxt = document.getElementById('death');
const birthsTxt = document.getElementById('birth');
const buttons = document.getElementById('buttons');
const selected_mode = document.getElementById('color-mode');
const activePeers = new Set();

function init_canvas() {
    createCanvas(CANVAS_SIZE, CANVAS_SIZE);

    cols = width / resolution;
    rows = height / resolution;

    grid = make2DArray(cols, rows);
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            grid[i][j] = 0;//floor(random(2));
        }
    }
}

function assign_color(num_neighbors) {
    let mode = selected_mode.value;
    // document.getElementById('current-mode').textContent = "running in " + mode + " mode";

    if (mode == "matrix") {
        return [0, 255 / num_neighbors, 0];
    }
    else if (mode == "white-fade") {
        return [255 / num_neighbors, 255 / num_neighbors, 255 / num_neighbors];
    }
    else if (mode == "color") {
        if (num_neighbors == 0 || num_neighbors == 1) {
            return [0, 255, 0];
        }
        else if (num_neighbors == 2) {
            return [255, 255, 0];
        }
        else if (num_neighbors == 3) {
            return [255, 0, 0];
        }
        else {
            return [0, 0, 0];
        }
    }
}

function setup() {
    init_canvas()
   
    const eventSource = new EventSource('/events');

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received event:', data.peer);
            
            const imageUrl = `data:image/${data.type};base64,${data.image}`;

            loadImage(imageUrl, (p5Image) => {
                const maxX = Math.max(0, grid.length - N/2);
                const maxY = Math.max(0, grid[0].length - N/2);
                const sx = Math.floor(Math.random() * maxX);
                const sy = Math.floor(Math.random() * maxY);

                induct_state(p5Image, sx, sy);
            });

            activePeers.add(data.peer);
            updatePeersList();

        } catch (error) {
            console.error('Error processing event:', error);
        }
    };

    const increaseBtn = document.getElementById('increaseSpeed')
    increaseBtn.addEventListener('click', increase_speed);

    const decreaseBtn = document.getElementById('decreaseSpeed')
    decreaseBtn.addEventListener('click', decrease_speed);
}


function updatePeersList() {
    const peersListDiv = document.getElementById('peers-list');
    if (peersListDiv) {
        peersListDiv.innerHTML = `
            <h3>Active Peers (${activePeers.size})</h3>
            <ul>
                ${Array.from(activePeers).map(peer => `<li>${peer}</li>`).join('')}
            </ul>
        `;
    }
}

function draw() {
    background(0);

    let deaths = 0;
    let births = 0;
    let alive = 0;

    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let x = i * resolution;
            let y = j * resolution;
            let num_neighbors = countNeighbors(grid, i, j);

            let r = 0;
            let g = 0;
            let b = 0;
            if (grid[i][j] == 1) {
                let [r, g, b] = assign_color(num_neighbors);
                fill(r, g, b);
                alive++;
                rect(x, y, resolution - 1, resolution - 1);
            }
        }
    }

    let next = make2DArray(cols, rows);
    let sum = 0;
    // Compute next based on grid
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            let state = grid[i][j];
            // Count live neighbors!

            sum = sum + state;
            let neighbors = countNeighbors(grid, i, j);

            if (state == 0 && neighbors == 3) {
                next[i][j] = 1;
                births++;
            } else if (state == 1 && (neighbors < 2 || neighbors > 3)) {
                next[i][j] = 0;
                deaths++;
            } else {
                next[i][j] = state;
            }

        }
    }

    grid = next;
    if (sum != 0) {
        generation++;
    }

    generationTxt.textContent = str(generation) + " Generations";
    aliveTxt.textContent = str(alive) + " Alive";
    deathsTxt.textContent = str(deaths) + " Deaths";
    birthsTxt.textContent = str(births) + " Births";

    frameRate(frame_rate);
    //saveCanvas("canvas", "png");
}

function increase_speed() {
    if (frame_rate < 15) {
        frame_rate++;
    }
}

function decrease_speed() {
    if (frame_rate > 1) {
        frame_rate--;
    }
}
