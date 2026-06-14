const API_URL = "https://jota2001-analizador-feedback.hf.space";

// Variables globales para controlar las instancias de los gráficos
let sentimentChart, categoryChart;

// Ejecutar automáticamente al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    loadDashboardStats();

    // Evento para el botón de analizar texto
    document.getElementById("btn-analyze-text").addEventListener("click", analyzeText);
});

// 1. Obtener estadísticas de FastAPI y pintar gráficos
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard-stats`);
        const data = await response.json();

        // Actualizar contadores numéricos en la interfaz de Bootstrap
        document.getElementById("stat-total").innerText = data.total_reviews;
        document.getElementById("stat-pos").innerText = data.sentiment_distribution.positivo;
        document.getElementById("stat-neg").innerText = data.sentiment_distribution.negativo;

        // Renderizar o actualizar los gráficos de Chart.js
        renderCharts(data.sentiment_distribution, data.category_distribution);
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
    }
}

// 2. Enviar texto individual a la IA (Modificado para alertas de Bootstrap)
async function analyzeText() {
    const textInput = document.getElementById("text-input");
    const btn = document.getElementById("btn-analyze-text");
    const resultDiv = document.getElementById("quick-result");

    if (!textInput.value.trim()) return alert("Por favor escribe una opinión.");

    // Cambiar estado del botón a modo carga
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Procesando con IA...`;

    try {
        const response = await fetch(`${API_URL}/analyze-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textInput.value })
        });
        
        const resData = await response.json();

        if (resData.status === "success") {
            // Configurar y mostrar alerta de éxito estilo Bootstrap (quitando d-none)
            resultDiv.classList.remove("d-none", "alert-danger");
            resultDiv.classList.add("alert-success");
            resultDiv.innerHTML = `<strong>Análisis de IA:</strong> Sentimiento <strong>${resData.data.sentiment.toUpperCase()}</strong> en categoría <strong>${resData.data.category.toUpperCase()}</strong>.<br><small class="text-muted">"${resData.data.summary}"</small>`;
            
            // Limpiar el campo y refrescar las métricas del dashboard
            textInput.value = "";
            await loadDashboardStats();
        } else {
            throw new Error("Error en la respuesta del servidor");
        }
    } catch (error) {
        // Configurar y mostrar alerta de error estilo Bootstrap
        resultDiv.classList.remove("d-none", "alert-success");
        resultDiv.classList.add("alert-danger");
        resultDiv.innerText = "Hubo un error al conectar con el servidor de IA.";
    } finally {
        // Restaurar estado del botón
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-stars me-2"></i>Analizar con IA`;
    }
}

// 3. Función para dibujar los gráficos de Chart.js
function renderCharts(sentimentData, categoryData) {
    // Destruir gráficos anteriores si existen para evitar duplicación visual al refrescar
    if (sentimentChart) sentimentChart.destroy();
    if (categoryChart) categoryChart.destroy();

    // Gráfico de Sentimientos (Doughnut)
    const ctxSentiment = document.getElementById('chart-sentiment').getContext('2d');
    sentimentChart = new Chart(ctxSentiment, {
        type: 'doughnut',
        data: {
            labels: ['Positivo', 'Neutral', 'Negativo'],
            datasets: [{
                data: [sentimentData.positivo, sentimentData.neutral, sentimentData.negativo],
                backgroundColor: ['#198754', '#6c757d', '#dc3545'], // Colores Success, Secondary y Danger de Bootstrap
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } } 
        }
    });

    // Gráfico de Categorías (Polar Area)
    const ctxCategory = document.getElementById('chart-category').getContext('2d');
    categoryChart = new Chart(ctxCategory, {
        type: 'polarArea',
        data: {
            labels: ['Precio', 'Soporte', 'Producto', 'Envío'],
            datasets: [{
                data: [categoryData.precio, categoryData.soporte, categoryData.producto, categoryData.envio],
                backgroundColor: ['#ffc107', '#0dcaf0', '#0d6efd', '#f472b6'], // Colores Warning, Info, Primary de Bootstrap y Rosa
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } } 
        }
    });
}
