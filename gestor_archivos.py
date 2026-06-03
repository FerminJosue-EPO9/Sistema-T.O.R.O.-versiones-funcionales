import os
from pathlib import Path

RUTA_BASE_PROYECTO = Path(__file__).parent
RUTA_BASE_LECCIONES = RUTA_BASE_PROYECTO / "data" / "LECCIONES DISPONIBLES"

def crear_estructura_leccion(grupo, materia, parcial, tema, actividad):
    # Crear el nombre de la carpeta con el formato solicitado
    nombre_carpeta = f"{grupo}_{materia}_{parcial}_{tema}_{actividad}"
    
    # Combinar la ruta base con el nombre de la nueva carpeta
    ruta_destino = RUTA_BASE_LECCIONES / nombre_carpeta
    
    # Crear la carpeta física. exist_ok=True evita que el programa truene si ya existe
    if not ruta_destino.exists():
        ruta_destino.mkdir(parents=True, exist_ok=True)
    
    return str(ruta_destino)

def obtener_lista_lecciones():
    if not RUTA_BASE_LECCIONES.exists():
        return []
    # Retorna los nombres de las carpetas existentes
    return [f.name for f in RUTA_BASE_LECCIONES.iterdir() if f.is_dir()]