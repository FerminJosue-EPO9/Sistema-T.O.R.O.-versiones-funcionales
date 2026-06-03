import webview
import os
import shutil
from pathlib import Path

# Configuración de Rutas
BASE_DIR = Path(__file__).resolve().parent.parent
LECCIONES_DIR = BASE_DIR / "LECCIONES DISPONIBLES"
EXTENSIONES_PERMITIDAS = [".pdf", ".docx", ".png", ".jpeg", ".jpg", ".mp3", ".mp4", ".txt"]

class SistemaToroAPI:
    def __init__(self):
        self._window = None
        # Asegurar que la carpeta de lecciones exista
        LECCIONES_DIR.mkdir(parents=True, exist_ok=True)

    def set_window(self, window):
        self._window = window

    # --- LÓGICA DE NAVEGACIÓN ---
    def obtener_ruta_formulario(self):
        # Devolvemos la ruta absoluta formateada para el navegador
        path = (BASE_DIR / "organizar_archivos.html").as_uri()
        return path

    # --- LÓGICA DE ARCHIVOS ---
    def seleccionar_archivos(self):
        result = self._window.create_file_dialog(
            webview.FileDialog.OPEN, 
            allow_multiple=True, 
            file_types=('Archivos permitidos (*.pdf;*.docx;*.png;*.jpg;*.mp3;*.mp4;*.txt)',)
        )
        return list(result) if result else []

    def obtener_lecciones_existentes(self):
        if not LECCIONES_DIR.exists():
            return []
        return [d.name for d in LECCIONES_DIR.iterdir() if d.is_dir()]

    def guardar_leccion(self, data):
        try:
            rutas = data.get("rutas", [])
            es_nueva = data.get("es_nueva", True)
            
            if es_nueva:
                nombre_carpeta = f"{data['grupo']}_{data['materia']}_{data['parcial']}_{data['tema']}_{data['actividad']}"
            else:
                nombre_carpeta = data['carpeta_existente']

            destino = LECCIONES_DIR / nombre_carpeta
            destino.mkdir(parents=True, exist_ok=True)

            copiados = 0
            for r in rutas:
                archivo_origen = Path(r)
                if archivo_origen.exists() and archivo_origen.suffix.lower() in EXTENSIONES_PERMITIDAS:
                    shutil.copy2(archivo_origen, destino / archivo_origen.name)
                    copiados += 1

            return {"success": True, "mensaje": f"¡Éxito! {copiados} archivos guardados en: {nombre_carpeta}"}
        except Exception as e:
            return {"success": False, "mensaje": f"Error: {str(e)}"}

def iniciar_app():
    api = SistemaToroAPI()
    index_path = (BASE_DIR / "index.html").as_uri()
    
    window = webview.create_window(
        "Sistema TORO - Gestión de Lecciones",
        url=index_path,
        js_api=api,
        width=950,
        height=750,
        resizable=True
    )
    
    api.set_window(window)
    webview.start(debug=True) # Activa inspección con click derecho

if __name__ == "__main__":
    iniciar_app()