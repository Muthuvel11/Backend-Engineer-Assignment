const buildings = [
  { name: "T", time: 5, earn: 1500 },
  { name: "P", time: 4, earn: 1000 },
  { name: "C", time: 10, earn: 2000 }
];

function getMaxProfit(totalTime) {
  const dp = Array(totalTime + 1).fill(null);

  dp[0] = {
    earnings: 0,
    solutions: [
      { T: 0, P: 0, C: 0 }
    ]
  };

  // Build DP bottom-up
  for (let currentTime = 0; currentTime <= totalTime; currentTime++) {

    if (!dp[currentTime]) continue;

    for (const building of buildings) {

      const newTime =
        currentTime + building.time;

      // skip if exceeds total time
      if (newTime > totalTime) continue;

      // operational time after construction
      const operationalTime =
        totalTime - newTime;

      // current building profit
      const currentProfit =
        operationalTime * building.earn;

      // total accumulated profit
      const totalProfit =
        dp[currentTime].earnings +
        currentProfit;

      const newSolutions = [];

      for (const sol of dp[currentTime].solutions) {

        newSolutions.push({
          ...sol,
          [building.name]:
            sol[building.name] + 1
        });
      }

      // update DP state
      if (
        !dp[newTime] ||
        totalProfit > dp[newTime].earnings
      ) {

        dp[newTime] = {
          earnings: totalProfit,
          solutions: newSolutions
        };

      }
      else if (
        totalProfit === dp[newTime].earnings
      ) {

        dp[newTime].solutions.push(
          ...newSolutions
        );
      }
    }
  }

  // find global maximum
  let maxProfit = 0;
  let bestSolutions = [];

  for (const item of dp) {

    if (!item) continue;

    if (item.earnings > maxProfit) {

      maxProfit = item.earnings;
      bestSolutions = item.solutions;

    }
    else if (
      item.earnings === maxProfit
    ) {

      bestSolutions.push(
        ...item.solutions
      );
    }
  }

  return {
    earnings: maxProfit,
    solutions: bestSolutions
  };
}

// Generate step-by-step construction timeline for a given solution
function getTimeline(totalTime, sol) {
  const sequence = [];
  let currentTime = 0;

  // Sort building types by Smith's Rule ratio: T (300) > P (250) > C (200)
  const order = [
    { name: "T", label: "Theatre", time: 5, earn: 1500 },
    { name: "P", label: "Pub", time: 4, earn: 1000 },
    { name: "C", label: "Commercial Park", time: 10, earn: 2000 }
  ];

  for (const b of order) {
    const count = sol[b.name];
    for (let i = 0; i < count; i++) {
      const start = currentTime;
      const end = start + b.time;
      const operationalTime = totalTime - end;
      const earnings = operationalTime * b.earn;
      sequence.push({
        building: b.label,
        start,
        end,
        operationalTime,
        earnings
      });
      currentTime = end;
    }
  }
  return sequence;
}

function run() {
  const inputEl = document.getElementById("time");
  const rawValue = inputEl.value.trim();

  // 1. Validation
  if (rawValue === "") {
    document.getElementById("output").innerHTML = `
      <p style="color: #dc2626; font-weight: 500;">Please enter a total number of available time units.</p>
    `;
    return;
  }

  const time = Number(rawValue);

  if (isNaN(time) || time < 0 || !Number.isInteger(time)) {
    document.getElementById("output").innerHTML = `
      <p style="color: #dc2626; font-weight: 500;">Please enter a valid non-negative integer (e.g. 0, 7, 8, 13...).</p>
    `;
    return;
  }

  // 2. Calculation
  const result = getMaxProfit(time);

  // 3. Render Output
  let html = `
    <h3>Time Unit: ${time}</h3>
    <h3>Earnings: $${result.earnings.toLocaleString()}</h3>
    <h3>Solutions</h3>
  `;

  if (result.solutions.length === 0 || result.earnings === 0) {
    html += `<p>No properties can be built in the given time units.</p>`;
  } else {
    result.solutions.forEach((sol, index) => {
      const timeline = getTimeline(time, sol);

      let timelineText = '';
      timeline.forEach((step, stepIdx) => {
        timelineText += `
          <div class="timeline-step">
            ${stepIdx + 1}. Build ${step.building} (t = ${step.start} &rarr; ${step.end}) &mdash; Earns $${step.earnings.toLocaleString()} (${step.operationalTime} operational units)
          </div>`;
      });

      html += `
        <div class="solution-item">
          <div class="solution-title">${index + 1}. T: ${sol.T} P: ${sol.P} C: ${sol.C}</div>
          <div class="solution-details">
            ${timelineText}
          </div>
        </div>
      `;
    });
  }

  document.getElementById("output").innerHTML = html;
}
