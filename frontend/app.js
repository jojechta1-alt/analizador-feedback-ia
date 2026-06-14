const API_URL = "https://jota2001-analizador-feedback.hf.space";

// Variables globales para controlar las instancias de los gráficos
let sentimentChart, categoryChart;

// Ejecutar automáticamente al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar estadísticas iniciales del Dashboard
    loadDashboardStats();

    // 2. Escuchar evento para el botón de analizar reseña individual
    const btnAnalyzeText = document.getElementById("btn-analyze-text");
    if (btnAnalyzeText) {
        btnAnalyzeText.addEventListener("click", analyzeText);
    }

    // 3. Escuchar evento para la zona de Carga Masiva (CSV)
    const csvInput = document.getElementById("csv-input");
    if (csvInput) {
        csvInput.addEventListener("change", handleCSVUpload);
    }
});

// =====================================================================
// FUNCTION 1: OBTENER ESTADÍSTICAS DEL BACKEND Y RENDERIZAR MAPAS
// =====================================================================
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/dashboard-stats`);
        const data = await response.json();

        // Actualizar contadores numéricos en la interfaz de Bootstrap
        document.getElementById("stat-total").innerText = data.total_reviews || 0;
        document.getElementById("stat-pos").innerText = data.positivo || 0;
        document.getElementById("stat-neg").innerText = data.negativo || 0;

        // Estructurar los datos de sentimientos de manera segura para Chart.js
        const sentimentData = {
            positivo: data.positivo || 0,
            neutral: data.total_reviews - (data.positivo + data.negativo) || 0,
            negativo: data.negativo || 0
        };

        // Renderizar o actualizar los gráficos pasando los datos limpios
        renderCharts(sentimentData, data.categories);
    } catch (error) {
        console.error("Error al cargar estadísticas del dashboard:", error);
    }
}

// =====================================================================
// FUNCTION 2: ENVIAR RESEÑA INDIVIDUAL A LA IA (GEMINI)
// =====================================================================
async function analyzeText() {
    const textInput = document.getElementById("text-input");
    const btn = document.getElementById("btn-analyze-text");
    const resultDiv = document.getElementById("quick-result");

    if (!textInput.value.trim()) return alert("Por favor escribe una opinión antes de analizar.");

    // Cambiar estado del botón a modo de carga (Spinner de Bootstrap)
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Procesando con IA...`;

    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ review_text: textInput.value }) // Formato que espera el Pydantic BaseModel en FastAPI
        });
        
        const resData = await response.json();

        if (resData.status === "success") {
            // Mostrar tarjeta de alerta verde de éxito
            resultDiv.classList.remove("d-none", "alert-danger");
            resultDiv.classList.add("alert-success");
            resultDiv.innerHTML = `<strong>¡Análisis de IA Exitoso!</strong><br>
                                    Sentimiento: <strong>${resData.data.sentiment.toUpperCase()}</strong><br>
                                    Categoría: <strong>${resData.data.category.toUpperCase()}</strong>`;
            
            // Limpiar caja de texto y actualizar de inmediato el dashboard
            textInput.value = "";
            await loadDashboardStats();
        } else {
            throw new Error("La respuesta del servidor no fue exitosa.");
        }
    } catch (error) {
        console.error("Error analizando texto individual:", error);
        resultDiv.classList.remove("d-none", "alert-success");
        resultDiv.classList.add("alert-danger");
        resultDiv.innerText = "Hubo un error al conectar con el servidor de IA.";
    } finally {
        // Devolver el botón a su estado normal
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-stars me-2"></i>Analizar con IA`;
    }
}

// =====================================================================
// FUNCTION 3: PROCESAR CARGA MASIVA DE ARCHIVOS (BATCH CSV)
// =====================================================================
async function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validación preventiva de tipo de archivo
    if (!file.name.endsWith('.csv')) {
        alert("Formato incorrecto. Por favor, sube un archivo que termine en .csv");
        event.target.value = ""; 
        return;
    }

    // Cambiar el estilo visual temporalmente o alertar al usuario
    console.log("Subiendo lote CSV a Hugging Face...");

    // Enviar archivo físico real usando multipart/form-data
    const formData = new FormData();
    formData.append("file", file); // Coincide con UploadFile en FastAPI

    try {
        const response = await fetch(`${API_URL}/api/upload-csv`, {
            method: "POST",
            body: formData // El navegador inyecta el 'Content-Type' correcto automáticamente
        });

        const resData = await response.json();

        if (resData.status === "success") {
            alert(`¡Carga Masiva Exitosa! La IA analizó con éxito ${resData.total_processed} filas de opiniones.`);
            
            // Recargar todas las métricas del tablero
            await loadDashboardStats();
        } else {
            throw new Error(resData.detail || "Error interno procesando el lote.");
        }
    } catch (error) {
        console.error("Error en la carga por lote (CSV):", error);
        alert("Hubo un inconveniente al procesar las filas del CSV en Hugging Face.");
    } finally {
        // Limpiar el input de archivos para que el usuario pueda volver a subir el mismo u otro lote
        event.target.value = "";
    }
}

// =====================================================================
// FUNCTION 4: PINTAR Y REFRESCAR GRÁFICOS DE CHART.JS
// =====================================================================
function renderCharts(sentimentData, categories) {
    // Destruir instancias previas para evitar superposiciones raras al refrescar datos
    if (sentimentChart) sentimentChart.destroy();
    if (categoryChart) categoryChart.destroy();

    const safeCategories = categories || {};

    // Gráfico de Sentimientos (Doughnut / Rosquilla)
    const ctxSentiment = document.getElementById('chart-sentiment').getContext('2d');
    sentimentChart = new Chart(ctxSentiment, {
        type: 'doughnut',
        data: {
            labels: ['Positivo', 'Neutral', 'Negativo'],
            datasets: [{
                data: [sentimentData.positivo, sentimentData.neutral, sentimentData.negativo],
                backgroundColor: ['#198754', '#6c757d', '#dc3545'], // Éxito (Verde), Secundario (Gris), Peligro (Rojo)
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } } 
        }
    });

    // Gráfico de Categorías (Polar Area / Área Polar)
    const ctxCategory = document.getElementById('chart-category').getContext('2d');
    categoryChart = new Chart(ctxCategory, {
        type: 'polarArea',
        data: {
            labels: ['Atención', 'Calidad', 'Precio', 'Envío', 'General'],
            datasets: [{
                data: [
                    safeCategories["Atención"] || 0, 
                    safeCategories["Calidad"] || 0, 
                    safeCategories["Precio"] || 0, 
                    safeCategories["Envío"] || 0, 
                    safeCategories["General"] || 0
                ],
                backgroundColor: ['#ffc107', '#0dcaf0', '#0d6efd', '#f472b6', '#a855f7'], 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } } 
        }
    });
}
