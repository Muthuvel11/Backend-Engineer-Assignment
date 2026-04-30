function calculate() {
    const heights = document.getElementById("input").value
        .split(",")
        .map(Number);

    const water = findWater(heights);

    let total = 0;
    for (let w of water) {
        total += w;
    }

    document.getElementById("answer").innerText =
        "Output: " + total + " Units";

    drawTable(heights, water);
}

function findWater(heights) {
    let left = 0;
    let right = heights.length - 1;

    let leftMax = 0;
    let rightMax = 0;

    let water = new Array(heights.length).fill(0);

    while (left < right) {
        if (heights[left] < heights[right]) {
            if (heights[left] >= leftMax) {
                leftMax = heights[left];
            } else {
                water[left] = leftMax - heights[left];
            }
            left++;
        } else {
            if (heights[right] >= rightMax) {
                rightMax = heights[right];
            } else {
                water[right] = rightMax - heights[right];
            }
            right--;
        }
    }

    return water;
}

function drawTable(heights, water) {
    const tank = document.getElementById("tank");
    tank.innerHTML = "";

    const maxHeight = Math.max(...heights);

    for (let level = maxHeight; level >= 1; level--) {
        const row = document.createElement("div");
        row.className = "row";

        for (let i = 0; i < heights.length; i++) {
            const cell = document.createElement("div");
            cell.className = "cell";

            if (level <= heights[i]) {
                cell.classList.add("block");
            } else if (level <= heights[i] + water[i]) {
                cell.classList.add("water");
            } else {
                cell.classList.add("empty");
            }

            row.appendChild(cell);
        }

        tank.appendChild(row);
    }
}

calculate();