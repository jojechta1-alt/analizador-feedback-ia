// URL de tu API en Hugging Face Spaces (Asegúrate de que termine sin la barra / al final)
const API_URL = "https://jota2001-analizador-feedback.hf.space";

// Variables globales para guardar las instancias de los gráficos
let sentimentChartInstance = null;
let categoryChartInstance = null;

// Esperar a que el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", () => {
    // Cargar estadísticas iniciales al abrir la página
    loadDashboardStats();

    // Configurar el botón de análisis individual de forma segura
    const btnAnalyze = document.getElementById("btnAnalyze") || document.querySelector("button[onclick*='analyze']");
    if (btnAnalyze) {
        btnAnalyze.addEventListener("click", analyzeText);
    } else {
        // Respaldo por si el ID cambió: buscar el primer botón que sirva para analizar
        const fallbackBtn = document.querySelector("button");
        if (fallbackBtn) fallbackBtn.addEventListener("click", analyzeText);
    }

    // Configurar el input de carga masiva CSV
    const fileInput = document.getElementById("csvFile") || document.querySelector("input[type='file']");
    if (fileInput) {
        fileInput.addEventListener("change", uploadCSV);
    }
});

// =====================================================================
// FUNCTION: ANALIZAR RESEÑA INDIVIDUAL
// =====================================================================
async function analyzeText() {
    let textArea = document.getElementById("reviewInput") || document.querySelector("textarea");
    
    if (!textArea || !textArea.value.trim()) {
        showAlert("Por favor, escribe una opinión válida.", "error");
        return;
    }

    const textToSend = textArea.value.trim();
    showAlert("Analizando con Inteligencia Artificial...", "info");

    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ review_text: textToSend })
        });

        if (!response.ok) {
            throw new Error("La respuesta del servidor no fue exitosa.");
        }

        const result = await response.json();
        
        if (result.status === "success") {
            showAlert(`¡Análisis completado! Sentimiento: ${result.data.sentiment}`, "success");
            textArea.value = ""; // Limpiar el cuadro de texto
            
            // Recargar el dashboard inmediatamente para actualizar números y gráficos
            await loadDashboardStats();
        } else {
            showAlert("El backend procesó la solicitud pero no reportó éxito.", "error");
        }

    } catch (error) {
        console.error("Error analizando texto:", error);
        showAlert("Hubo un error al conectar con el servidor de IA.", "error");
    }
}

// =====================================================================
// FUNCTION: OBTENER Y ACTUALIZAR ESTADÍSTICAS DEL DASHBOARD
// =====================================================================
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/dashboard-stats`);
        if (!response.ok) throw new Error("No se pudieron obtener las estadísticas.");

        const data = await response.json();

        // 1. Buscar las tarjetas por cualquier combinación posible de IDs que puedas tener en tu HTML
        const totalEl = document.getElementById("totalReviewsCount") || document.getElementById("totalReviews") || document.getElementById("total-reviews");
        const posEl = document.getElementById("positiveCount") || document.getElementById("positivo") || document.getElementById("positives");
        const negEl = document.getElementById("negativeCount") || document.getElementById("negativo") || document.getElementById("negatives");

        // 2. Actualizar el texto SOLO si el elemento realmente existe en la página (Evita el error 'innerText' de null)
        if (totalEl) { totalEl.innerText = data.total_reviews || 0; }
        if (posEl) { posEl.innerText = data.positivo || 0; }
        if (negEl) { negEl.innerText = data.negativo || 0; }

        // Calcular cuántos neutrales quedan de forma matemática
        const neutrales = (data.total_reviews || 0) - (data.positivo || 0) - (data.negativo || 0);

        // 3. Renderizar o actualizar los gráficos de forma segura
        updateCharts(data.positivo, data.negativo, neutrales < 0 ? 0 : neutrales, data.categories);

    } catch (error) {
        console.error("Error cargando estadísticas protegido:", error);
    }
}

// =====================================================================
// FUNCTION: RENDERIZAR / ACTUALIZAR GRÁFICOS (CHART.JS)
// =====================================================================
function updateCharts(positivos, negativos, neutrales, categorias) {
    // --- GRÁFICO 1: DISTRIBUCIÓN DE SENTIMIENTOS (DONUT / PASTEL) ---
    const ctxSentiment = document.getElementById("sentimentChart") || document.getElementById("chartSentiment") || document.querySelector("canvas");
    if (ctxSentiment) {
        // Si ya existía un gráfico activo, lo destruimos por completo para evitar que se congele
        if (sentimentChartInstance) {
            sentimentChartInstance.destroy();
        }

        try {
            sentimentChartInstance = new Chart(ctxSentiment, {
                type: 'doughnut',
                data: {
                    labels: ['Positivo', 'Neutral', 'Negativo'],
                    datasets: [{
                        data: [positivos, neutrales, negativos],
                        backgroundColor: ['#2e7d32', '#757575', '#c62828'], // Verde, Gris, Rojo
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        } catch (e) {
            console.error("Error al crear gráfico de sentimientos:", e);
        }
    }

    // --- GRÁFICO 2: CATEGORÍAS DETECTADAS (RADAR / BARRAS) ---
    const ctxCategory = document.getElementById("categoryChart") || document.getElementById("chartCategory") || document.querySelectorAll("canvas")[1];
    if (ctxCategory) {
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        // Extraer los valores que mandó el backend para el gráfico de radar
        const labelsCategorias = Object.keys(categorias || {});
        const valoresCategorias = Object.values(categorias || {});

        try {
            categoryChartInstance = new Chart(ctxCategory, {
                type: 'radar',
                data: {
                    labels: labelsCategorias.length ? labelsCategorias : ['Atención', 'Calidad', 'Precio', 'Envío', 'General'],
                    datasets: [{
                        label: 'Cantidad de Reseñas',
                        data: valoresCategorias.length ? valoresCategorias : [0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(147, 51, 234, 0.2)', // Morado traslúcido
                        borderColor: 'rgb(147, 51, 234)',
                        pointBackgroundColor: 'rgb(147, 51, 234)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        } catch (e) {
            console.error("Error al crear gráfico de categorías:", e);
        }
    }
}

// =====================================================================
// FUNCTION: CARGA MASIVA DE CSV
// =====================================================================
async function uploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    showAlert("Procesando archivo CSV en lote...", "info");

    try {
        const response = await fetch(`${API_URL}/api/upload-csv`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Error subiendo el archivo masivo.");

        const result = await response.json();
        showAlert(`¡Éxito! Se procesaron ${result.total_processed} registros del CSV.`, "success");
        
        // Recargar estadísticas para pintar todo el CSV en los gráficos
        await loadDashboardStats();
    } catch (error) {
        console.error("Error CSV:", error);
        showAlert("Error al procesar el archivo masivo.", "error");
    }
}

// =====================================================================
// FUNCTION AUXILIAR: MOSTRAR ALERTAS VISUALES
// =====================================================================
function showAlert(message, type) {
    const alertBox = document.getElementById("alertBox") || document.getElementById("alert") || document.getElementById("mensaje");
    if (!alertBox) {
        // Respaldo por si no existe la caja en el HTML: usar alerta de navegador integrada
        alert(message);
        return;
    }

    alertBox.innerText = message;
    alertBox.style.display = "block";

    // Cambiar estilos según el tipo de respuesta
    if (type === "success") {
        alertBox.style.backgroundColor = "#d1e7dd";
        alertBox.style.color = "#0f5132";
        alertBox.style.borderColor = "#badbcc";
    } else if (type === "error") {
        alertBox.style.backgroundColor = "#f8d7da";
        alertBox.style.color = "#842029";
        alertBox.style.borderColor = "#f5c2c7";
    } else {
        alertBox.style.backgroundColor = "#cff4fc";
        alertBox.style.color = "#055160";
        alertBox.style.borderColor = "#b6effb";
    }
}
