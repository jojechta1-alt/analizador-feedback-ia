// URL de tu API en Hugging Face Spaces (Asegúrate de que termine sin la barra / al final)
const API_URL = "https://jota2001-analizador-feedback.hf.space";

// Variables globales para guardar las instancias de los gráficos sus estructuras
let sentimentChartInstance = null;
let categoryChartInstance = null;

// Esperar a que el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", () => {
    // Cargar estadísticas iniciales al abrir la página
    loadDashboardStats();

    // Configurar el botón de análisis individual (ID exacto: btn-analyze-text)
    const btnAnalyze = document.getElementById("btn-analyze-text");
    if (btnAnalyze) {
        btnAnalyze.addEventListener("click", analyzeText);
    }

    // Configurar el input de carga masiva CSV (ID exacto: csv-input)
    const fileInput = document.getElementById("csv-input");
    if (fileInput) {
        fileInput.addEventListener("change", uploadCSV);
    }
});

// =====================================================================
// FUNCTION: ANALIZAR RESEÑA INDIVIDUAL
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

        // 1. Mapear los IDs de tus tarjetas numéricas reales del HTML
        const totalEl = document.getElementById("stat-total");
        const posEl = document.getElementById("stat-pos");
        const negEl = document.getElementById("stat-neg");

        // --- SISTEMA INTERNO DE PROTECCIÓN Y CONTEO ---
        // Si el backend viene vacío, vamos a contar los datos directamente desde el JSON crudo (raw_data)
        let listaResenas = data.raw_data || [];
        
        let positivos = data.positivo || 0;
        let negativos = data.negativo || 0;
        let totalReviews = data.total_reviews || 0;

        // Si los contadores vinieron en 0 pero sí hay datos en la base de datos, recalculamos en vivo
        if (totalReviews === 0 && listaResenas.length > 0) {
            totalReviews = listaResenas.length;
            listaResenas.forEach(r => {
                let sent = String(r.sentiment || '').toLowerCase().trim();
                if (sent === 'positivo' || sent === 'positive') positivos++;
                if (sent === 'negativo' || sent === 'negative') negativos++;
            });
        }

        // 2. Modificar el texto de forma segura comprobando que existan
        if (totalEl) totalEl.innerText = totalReviews;
        if (posEl) posEl.innerText = positivos;
        if (negEl) negEl.innerText = negativos;

        // Calcular cuántos neutrales quedan de forma matemática
        let neutrales = totalReviews - positivos - negativos;
        if (neutrales < 0) neutrales = 0;

        // --- ENRUTADOR INTELIGENTE DE CATEGORÍAS ---
        // Mapeamos lo que venga en minúsculas ("soporte", "producto") directamente al formato del gráfico
        let categoriasLimpias = { "Atención": 0, "Calidad": 0, "Precio": 0, "Envío": 0, "General": 0 };
        
        if (data.categories && Object.keys(data.categories).length > 0 && data.total_reviews > 0) {
            // Si el backend envió categorías procesadas, las usamos
            categoriasLimpias = data.categories;
        } else {
            // Si no, las extraemos y normalizamos nosotros mismos desde Supabase en vivo
            listaResenas.forEach(r => {
                let cat = String(r.category || '').toLowerCase().trim();
                if (cat === 'soporte' || cat === 'atención' || cat === 'atencion' || cat === 'servicio') {
                    categoriasLimpias["Atención"]++;
                } else if (cat === 'producto' || cat === 'calidad' || cat === 'articulo') {
                    categoriasLimpias["Calidad"]++;
                } else if (cat === 'precio' || cat === 'costo') {
                    categoriasLimpias["Precio"]++;
                } else if (cat === 'envío' || cat === 'envio' || cat === 'entrega') {
                    categoriasLimpias["Envío"]++;
                } else {
                    categoriasLimpias["General"]++;
                }
            });
        }

        // 3. Renderizar los gráficos usando el filtro corregido
        updateCharts(positivos, negativos, neutrales, categoriasLimpias);

    } catch (error) {
        console.error("Error cargando estadísticas:", error);
    }
}

// =====================================================================
// FUNCTION: RENDERIZAR / ACTUALIZAR GRÁFICOS (CHART.JS)
// =====================================================================
function updateCharts(positivos, negativos, neutrales, categorias) {
    // --- GRÁFICO 1: DISTRIBUCIÓN DE SENTIMIENTOS (ID exacto: chart-sentiment) ---
    const ctxSentiment = document.getElementById("chart-sentiment");
    if (ctxSentiment) {
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

    // --- GRÁFICO 2: CATEGORÍAS DETECTADAS (ID exacto: chart-category) ---
    const ctxCategory = document.getElementById("chart-category");
    if (ctxCategory) {
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

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
        await loadDashboardStats();
    } catch (error) {
        console.error("Error CSV:", error);
        showAlert("Error al procesar el archivo masivo.", "error");
    }
}

// =====================================================================
// FUNCTION AUXILIAR: MOSTRAR ALERTAS (ID exacto: quick-result)
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
