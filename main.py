import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import csv
import io
import google.generativeai as genai
from supabase import create_client, Client

app = FastAPI()

# Configuración de CORS middleware (Esencial para conectar con el Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# CONFIGURACIÓN DE VARIABLES DE ENTORNO (SEGURIDAD PARA PRODUCCIÓN)
# =====================================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Validación preventiva de variables de entorno
if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ Alerta: Faltan las credenciales de Supabase en las variables de entorno.")
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

if not GEMINI_API_KEY:
    print("⚠️ Alerta: Falta la GEMINI_API_KEY en las variables de entorno.")
else:
    genai.configure(api_key=GEMINI_API_KEY)


# =====================================================================
# MODELOS DE DATOS (PYDANTIC)
# =====================================================================
class ReviewInput(BaseModel):
    review_text: str

class ReviewResponse(BaseModel):
    id: str
    review_text: str
    sentiment: str
    category: str
    created_at: str


# =====================================================================
# PROCESAMIENTO CON INTELIGENCIA ARTIFICIAL (GEMINI)
# =====================================================================
def analizar_resena_con_ia(texto: str):
    """
    Se comunica con el modelo Gemini de Google para analizar la reseña
    y devolver estrictamente el sentimiento y la categoría.
    """
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = fBlock
        prompt = (
            f"Analiza la siguiente reseña de un cliente y clasifícala.\n"
            f"Debes responder ÚNICAMENTE en este formato exacto de dos líneas, sin añadir introducciones ni saludos:\n"
            f"Sentimiento: [Positivo o Negativo]\n"
            f"Categoría: [Atención, Calidad, Precio, Envío o General]\n\n"
            f"Reseña: \"{texto}\""
        )
        
        response = model.generate_content(prompt)
        lineas = response.text.strip().split('\n')
        
        sentimiento = "General"
        categoria = "General"
        
        for linea in lineas:
            if "Sentimiento:" in linea:
                sentimiento = linea.replace("Sentimiento:", "").strip()
            if "Categoría:" in linea or "Categoria:" in linea:
                categoria = linea.replace("Categoría:", "").replace("Categoria:", "").strip()
                
        return sentimiento, categoria
    except Exception as e:
        print(f"Error procesando con Gemini: {str(e)}")
        return "Neutral", "General"


# =====================================================================
# ENDPOINTS / RUTAS DE LA API
# =====================================================================

@app.get("/")
def read_root():
    return {"message": "API de Analizador de Feedback con IA corriendo exitosamente"}


@app.post("/api/analyze")
def analizar_resena_individual(data: ReviewInput):
    """
    Endpoint para procesar una sola reseña desde el cuadro de texto.
    """
    if not data.review_text.strip():
        raise HTTPException(status_code=400, detail="El texto de la reseña no puede estar vacío.")
        
    # 1. Analizar con el modelo de Machine Learning / IA
    sentimiento, categoria = analizar_resena_con_ia(data.review_text)
    
    # 2. Guardar el análisis estructurado en Supabase
    try:
        nuevo_registro = {
            "review_text": data.review_text,
            "sentiment": sentimiento,
            "category": categoria
        }
        res = supabase.table("reviews").insert(nuevo_registro).execute()
        return {"status": "success", "data": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar en Supabase: {str(e)}")


@app.post("/api/upload-csv")
async def cargar_masiva_csv(file: UploadFile = File(...)):
    """
    Endpoint para procesar archivos CSV en lote (Batch Processing).
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo subido debe ser un formato CSV válido.")
        
    contents = await file.read()
    buffer = io.StringIO(contents.decode('utf-8'))
    reader = csv.reader(buffer)
    
    registros_procesados = 0
    
    for row in reader:
        if not row or len(row) == 0:
            continue
            
        texto_resena = row[0].strip()
        if not texto_resena:
            continue
            
        # Analizar cada fila del lote con IA
        sentimiento, categoria = analizar_resena_con_ia(texto_resena)
        
        # Insertar en la base de datos
        try:
            supabase.table("reviews").insert({
                "review_text": texto_resena,
                "sentiment": sentimiento,
                "category": categoria
            }).execute()
            registros_procesados += 1
        except Exception as e:
            print(f"Error insertando fila del CSV: {str(e)}")
            continue
            
    return {"status": "success", "total_processed": registros_processed}


@app.get("/api/dashboard-stats")
def obtener_estadisticas_dashboard():
    """
    Endpoint que consume el Frontend para pintar los gráficos de Chart.js y tarjetas.
    """
    try:
        res = supabase.table("reviews").select("*").execute()
        todas_resenas = res.data
        
        total = len(todas_resenas)
        positivas = sum(1 for r in todas_resenas if r.get("sentiment") == "Positivo")
        negativas = sum(1 for r in todas_resenas if r.get("sentiment") == "Negativo")
        
        # Contadores de categorías
        categorias_count = {"Atención": 0, "Calidad": 0, "Precio": 0, "Envío": 0, "General": 0}
        for r in todas_resenas:
            cat = r.get("category", "General")
            if cat in categorias_count:
                categorias_count[cat] += 1
            else:
                categorias_count["General"] += 1
                
        return {
            "total_reviews": total,
            "positive_reviews": positivas,
            "negative_reviews": negativas,
            "categories": categorias_count,
            "raw_data": todas_resenas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al recopilar estadísticas: {str(e)}")