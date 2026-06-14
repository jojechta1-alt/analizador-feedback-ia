// URL de tu API en Hugging Face Spaces
const API_URL = "https://jota2001-analizador-feedback.hf.space";

// Variables globales para guardar las instancias de los gráficos y los datos actuales
let sentimentChartInstance = null;
let categoryChartInstance = null;

// Objeto global para mantener el estado de los datos en el frontend
let currentData = {
    positivos: 0,
    negativos: 0,
    neutrales: 0,
    categorias: { "Atención": 0, "Calidad": 0, "Precio": 0, "Envío": 0, "General": 0 }
};

// Guardar de forma global las reseñas para que las actualizaciones locales persistan
let localReviewsList = [];

// Esperar a que el DOM esté completamente cargado para activar los listeners
document.addEventListener("DOMContentLoaded", async () => {
    // Carga inicial obligatoria
    await loadDashboardStats();

    // Configurar el botón de análisis individual
    const btnAnalyze = document.getElementById("btn-analyze-text");
    if (btnAnalyze) {
        btnAnalyze.addEventListener("click", analyzeText);
    }

    // Configurar el input de carga masiva CSV
    const fileInput = document.getElementById("csv-input");
    if (fileInput) {
        fileInput.addEventListener("change", uploadCSV);
    }
});

// =====================================================================
// FUNCTION: ANALIZAR RESEÑA INDIVIDUAL (CAMBIO INMEDIATO Y ESTÁTICO)
// =====================================================================
async function analyzeText() {
    const textArea = document.getElementById("text-input");
    
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
            const aiSentiment = String(result.data.sentiment || '').toLowerCase().trim();
            const aiCategory = String(result.data.category || '').toLowerCase().trim();

            showAlert(`¡Análisis completado! Sentimiento: ${result.data.sentiment} | Categoría: ${result.data.category}`, "success");
            textArea.value = ""; // Limpiar el cuadro de texto

            // --- ACTUALIZACIÓN LOCAL PERMANENTE ---
            // Modificamos el conteo de sentimientos global al instante
            if (aiSentiment.includes('positiv')) {
                currentData.positivos++;
            } else if (aiSentiment.includes('negativ')) {
                currentData.negativos++;
            } else {
                currentData.neutrales++;
            }

            // Modificamos el conteo de categorías global al instante
            if (aiCategory.includes('soport') || aiCategory.includes('atenci') || aiCategory.includes('atención') || aiCategory.includes('servici')) {
                currentData.categorias["Atención"]++;
            } else if (aiCategory.includes('product') || aiCategory.includes('calidad') || aiCategory.includes('articul') || aiCategory.includes('artículo')) {
                currentData.categorias["Calidad"]++;
            } else if (aiCategory.includes('precio') || aiCategory.includes('costo') || aiCategory.includes('tarif')) {
                currentData.categorias["Precio"]++;
            } else if (aiCategory.includes('enví') || aiCategory.includes('envio') || aiCategory.includes('entreg') || aiCategory.includes('deliver')) {
                currentData.categorias["Envío"]++;
            } else {
                currentData.categorias["General"]++;
            }

            // Insertamos el registro de forma permanente en la lista local para evitar que se borre
            localReviewsList.push({
                text: textToSend,
                sentiment: result.data.sentiment,
                category: result.data.category
            });

            // Actualizar tarjetas numéricas HTML instantáneamente con la nueva suma
            const totalEl = document.getElementById("stat-total");
            const posEl = document.getElementById("stat-pos");
            const negEl = document.getElementById("stat-neg");
            
            if (totalEl) totalEl.innerText = currentData.positivos + currentData.negativos + currentData.neutrales;
            if (posEl) posEl.innerText = currentData.positivos;
            if (negEl) negEl.innerText = currentData.negativos;

            // Forzar renderizado inmediato de los gráficos con los nuevos datos locales
            // SIN TEMPORIZADORES QUE SOBREESCRIBAN LA INFORMACIÓN ABAJO
            updateCharts(currentData.positivos, currentData.negativos, currentData.neutrales, currentData.categorias);

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

        const totalEl = document.getElementById("stat-total");
        const posEl = document.getElementById("stat-pos");
        const negEl = document.getElementById("stat-neg");

        localReviewsList = data.raw_data || [];
        let positivos = data.positivo || 0;
        let negativos = data.negativo || 0;
        let totalReviews = data.total_reviews || 0;

        if (totalReviews === 0 && localReviewsList.length > 0) {
            totalReviews = localReviewsList.length;
            localReviewsList.forEach(r => {
                let sent = String(r.sentiment || '').toLowerCase().trim();
                if (sent.includes('positiv')) positivos++;
                if (sent.includes('negativ')) negativos++;
            });
        }

        if (totalEl) totalEl.innerText = totalReviews;
        if (posEl) posEl.innerText = positivos;
        if (negEl) negEl.innerText = negativos;

        let neutrales = totalReviews - positivos - negativos;
        if (neutrales < 0) neutrales = 0;

        let categoriasLimpias = { "Atención": 0, "Calidad": 0, "Precio": 0, "Envío": 0, "General": 0 };
        
        localReviewsList.forEach(r => {
            let cat = String(r.category || '').toLowerCase().trim();
            if (cat.includes('soport') || cat.includes('atenci') || cat.includes('atención') || cat.includes('servici')) {
                categoriasLimpias["Atención"]++;
            } else if (cat.includes('product') || cat.includes('calidad') || cat.includes('articul') || cat.includes('artículo')) {
                categoriasLimpias["Calidad"]++;
            } else if (cat.includes('precio') || cat.includes('costo') || cat.includes('tarif')) {
                categoriasLimpias["Precio"]++;
            } else if (cat.includes('enví') || cat.includes('envio') || cat.includes('entreg') || cat.includes('deliver')) {
                categoriasLimpias["Envío"]++;
            } else {
                categoriasLimpias["General"]++;
            }
        });

        // Almacenar el estado global inicial
        currentData = {
            positivos: positivos,
            negativos: negativos,
            neutrales: neutrales,
            categorias: categoriasLimpias
        };

        updateCharts(positivos, negativos, neutrales, categoriasLimpias);

    } catch (error) {
        console.error("Error cargando estadísticas en tiempo real:", error);
    }
}

// =====================================================================
// FUNCTION: RENDERIZAR / ACTUALIZAR GRÁFICOS DINÁMICAMENTE
// =====================================================================
function updateCharts(positivos, negativos, neutrales, categorias) {
    const ctxSentiment = document.getElementById("chart-sentiment");
    if (ctxSentiment) {
        if (sentimentChartInstance !== null) {
            sentimentChartInstance.destroy();
        }

        try {
            sentimentChartInstance = new Chart(ctxSentiment, {
                type: 'doughnut',
                data: {
                    labels: ['Positivo', 'Neutral', 'Negativo'],
                    datasets: [{
                        data: [positivos, neutrales, negativos],
                        backgroundColor: ['#2e7d32', '#757575', '#c62828'], 
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
            console.error("Error al actualizar gráfico de sentimientos:", e);
        }
    }

    const ctxCategory = document.getElementById("chart-category");
    if (ctxCategory) {
        if (categoryChartInstance !== null) {
            categoryChartInstance.destroy();
        }

        const valoresBarras = [
            categorias["Atención"] || 0,
            categorias["Calidad"] || 0,
            categorias["Precio"] || 0,
            categorias["Envío"] || 0,
            categorias["General"] || 0
        ];

        try {
            categoryChartInstance = new Chart(ctxCategory, {
                type: 'bar',
                data: {
                    labels: ['Atención', 'Calidad', 'Precio', 'Envío', 'General'],
                    datasets: [{
                        label: 'Reseñas por Categoría',
                        data: valoresBarras,
                        backgroundColor: [
                            'rgba(147, 51, 234, 0.7)',
                            'rgba(33, 150, 243, 0.7)',
                            'rgba(255, 152, 0, 0.7)',
                            'rgba(0, 150, 136, 0.7)',
                            'rgba(158, 158, 158, 0.7)'
                        ],
                        borderColor: [
                            'rgb(147, 51, 234)',
                            'rgb(33, 150, 243)',
                            'rgb(255, 152, 0)',
                            'rgb(0, 150, 136)',
                            'rgb(158, 158, 158)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { 
                                stepSize: 1,
                                precision: 0 
                            }
                        }
                    },
                    plugins: {
                        legend: { 
                            display: true, 
                            position: 'top' 
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Error al actualizar gráfico de categorías:", e);
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
        await loadDashboardStats();
    } catch (error) {
        console.error("Error CSV:", error);
        showAlert("Error al procesar el archivo masivo.", "error");
    }
}

// =====================================================================
// FUNCTION AUXILIAR: ALERTAS
// =====================================================================
function showAlert(message, type) {
    const alertBox = document.getElementById("quick-result");
    if (!alertBox) return;

    alertBox.className = "mt-3 alert rounded-3 small";
    alertBox.classList.remove("d-none");
    alertBox.innerText = message;

    if (type === "success") {
        alertBox.classList.add("alert-success");
    } else if (type === "error") {
        alertBox.classList.add("alert-danger");
    } else {
        alertBox.classList.add("alert-info");
    }
}
