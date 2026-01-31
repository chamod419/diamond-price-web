// Create floating particles
const particlesContainer = document.getElementById('particles');
for (let i = 0; i < 30; i++) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.style.left = Math.random() * 100 + '%';
  particle.style.animationDelay = Math.random() * 15 + 's';
  particle.style.animationDuration = (15 + Math.random() * 10) + 's';
  particlesContainer.appendChild(particle);
}

const $ = (id) => document.getElementById(id);

function setStatus(text, type = 'normal') {
  const el = $("status");
  el.textContent = text;
  el.classList.remove('error', 'success');
  if (type === 'error') el.classList.add('error');
  if (type === 'success') el.classList.add('success');
}

function formatUSD(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function animateValue(element, start, end, duration) {
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = start + (end - start) * easeOutQuart;

    element.textContent = formatUSD(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

$("apiBase").addEventListener("input", () => {
  $("apiBaseText").textContent = $("apiBase").value.trim();
});

$("btnReset").addEventListener("click", () => {
  $("carat").value = 1.10;
  $("cut").value = "Ideal";
  $("color").value = "H";
  $("clarity").value = "SI1";
  $("polish").value = "VG";
  $("symmetry").value = "EX";
  $("report").value = "GIA";
  setStatus("Ready to predict");
  $("resultBox").style.display = "none";
});

$("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const apiBase = $("apiBase").value.trim().replace(/\/+$/, "");
  $("apiBaseText").textContent = apiBase;

  const payload = {
    carat_weight: parseFloat($("carat").value),
    cut: $("cut").value,
    color: $("color").value,
    clarity: $("clarity").value,
    polish: $("polish").value,
    symmetry: $("symmetry").value,
    report: $("report").value
  };

  if (!payload.carat_weight || payload.carat_weight <= 0) {
    setStatus("⚠️ Carat weight must be greater than 0", "error");
    return;
  }

  const btnPredict = $("btnPredict");
  const btnText = $("btnText");
  btnPredict.disabled = true;
  btnText.innerHTML = '<span class="loading-spinner"></span> Analyzing...';
  setStatus("🔄 Processing prediction...");

  try {
    const res = await fetch(apiBase + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API Error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const price = data.predicted_price;

    // Animate price counting up
    const priceElement = $("priceText");
    animateValue(priceElement, 0, price, 1200);

    // Update specs
    $("specCarat").textContent = payload.carat_weight + " ct";
    $("specCut").textContent = payload.cut;
    $("specColor").textContent = payload.color;
    $("specClarity").textContent = payload.clarity;
    $("specPolish").textContent = payload.polish;
    $("specSymmetry").textContent = payload.symmetry;
    $("specReport").textContent = payload.report;

    $("resultBox").style.display = "block";
    setStatus("✅ Prediction successful", "success");

    // Scroll to results
    setTimeout(() => {
      $("resultBox").scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

  } catch (err) {
    console.error(err);
    setStatus("❌ " + err.message, "error");
    $("resultBox").style.display = "none";
  } finally {
    btnPredict.disabled = false;
    btnText.textContent = "Calculate Price";
  }
});
