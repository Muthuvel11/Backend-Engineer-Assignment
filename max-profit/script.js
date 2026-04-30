
// Declare building data
const buildings = [
    { name: "T", time: 5, earn: 1500 },
    { name: "P", time: 4, earn: 1000 },
    { name: "C", time: 10, earn: 2000 }
];

function run() {
    const time = Number(document.getElementById("time").value);
    const result = getMaxProfit(time);

    let output = `Earnings: ${result.earnings}<br>Solutions:<br>`;

    result.solutions.forEach((item, index) => {
        output += `${index + 1}. T:${item.T} P:${item.P} C:${item.C}<br>`;
    });

    document.getElementById("output").innerHTML = output;
}

function getMaxProfit(totalTime) {
    let max = 0;
    let result = [];

    function solve(time, profit, count) {
        if (profit > max) {
            max = profit;
            result = [{ ...count }];
        } else if (profit === max) {
            result.push({ ...count });
        }

        for (let b of buildings) {
            if (time >= b.time) {
                count[b.name]++;

                const operationalTime = time - b.time;
                const earnedAmount = operationalTime * b.earn;

                solve(
                    time - b.time,
                    profit + earnedAmount,
                    count
                );

                count[b.name]--;
            }
        }
    }

    solve(totalTime, 0, { T: 0, P: 0, C: 0 });

    return {
        earnings: max,
        solutions: result
    };
}
