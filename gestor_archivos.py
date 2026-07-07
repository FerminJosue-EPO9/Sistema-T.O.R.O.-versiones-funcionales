import os
from pathlib import Path

# ==========================================
# RUTA BASE FIJA PARA LECCIONES (C:\TORO)
# ==========================================
def obtener_base():
    """Devuelve la ruta base donde se guardarán todos los datos del sistema."""
    # Usamos siempre C:\TORO (fijo) para que sea consistente
    base = "C:\\TORO"
    return base

BASE_DIR = obtener_base()
RUTA_BASE_LECCIONES = Path(BASE_DIR) / "data" / "LECCIONES DISPONIBLES"

# Crear la carpeta si no existe
RUTA_BASE_LECCIONES.mkdir(parents=True, exist_ok=True)

def crear_estructura_leccion(grupo, materia, parcial, tema, actividad):
    """
    Crea una nueva carpeta para la lección con el formato:
    {grupo}_{materia}_{parcial}_{tema}_{actividad}
    Retorna la ruta absoluta de la carpeta creada.
    """
    # Crear el nombre de la carpeta con el formato solicitado
    nombre_carpeta = f"{grupo}_{materia}_{parcial}_{tema}_{actividad}"
    
    # Combinar la ruta base con el nombre de la nueva carpeta
    ruta_destino = RUTA_BASE_LECCIONES / nombre_carpeta
    
    # Crear la carpeta física. exist_ok=True evita que el programa truene si ya existe
    if not ruta_destino.exists():
        ruta_destino.mkdir(parents=True, exist_ok=True)
    
    return str(ruta_destino)

def obtener_lista_lecciones():
    """
    Retorna los nombres de las carpetas existentes dentro de LECCIONES DISPONIBLES.
    """
    if not RUTA_BASE_LECCIONES.exists():
        return []
    # Retorna los nombres de las carpetas existentes
    return [f.name for f in RUTA_BASE_LECCIONES.iterdir() if f.is_dir()]