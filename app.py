import subprocess
import sys
import os

def install_requirements():
    """Instala automáticamente las dependencias desde requirements.txt si no están."""
    req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    if not os.path.exists(req_file):
        print("⚠️  No se encuentra requirements.txt. Por favor, créalo con 'pip freeze > requirements.txt'")
        sys.exit(1)
    print("📦 Instalando dependencias faltantes...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file])
    print("✅ Dependencias instaladas correctamente.")

# Intentar importar Flask (la primera dependencia crítica)
try:
    from flask import Flask, jsonify, current_app, render_template, request, redirect, url_for, session
except ImportError:
    print("Flask no está instalado. Procediendo a instalar todas las dependencias...")
    install_requirements()
    # Después de instalar, reintentamos el import
    from flask import Flask, jsonify, current_app, render_template, request, redirect, url_for, session

from routes.actividades import actividades_bp
import os
import re
import shutil
import json
from werkzeug.utils import secure_filename
import base64
import zipfile
from flask import abort
import tempfile

app = Flask(__name__)
app.secret_key = 'toro_secret_key_2026'
app.register_blueprint(actividades_bp)

LECCIONES_DIR = os.path.join(app.root_path, 'data', 'LECCIONES DISPONIBLES')

CATALOGO_PLANTILLAS = {
    'P001': {'tipo': 'Crucigrama', 'img': 'img/imagenesActividades/CRUCIGRAMA.png'},
    'P002': {'tipo': 'Cuestionario F/V', 'img': 'img/imagenesActividades/FV.png'},
    'P003': {'tipo': 'Opción Múltiple', 'img': 'img/imagenesActividades/OPCIONES.png'},
    'P004': {'tipo': 'Sopa de Letras', 'img': 'img/imagenesActividades/SOPA.png'},
    'C001': {'tipo': 'Completar Camino', 'img': 'img/imagenesActividades/COMPLETARCAMINO.png'},
    'P006': {'tipo': 'Completar Palabra', 'img': 'img/imagenesActividades/COMPLETARPALABRA.png'},
}

# ==========================================
# FUNCIONES PARA IDS AUTOINCREMENTALES
# ==========================================
def obtener_siguiente_id_actividad():
    ruta_contador = os.path.join(app.root_path, 'data', 'contador_actividades.json')
    os.makedirs(os.path.dirname(ruta_contador), exist_ok=True)
    if os.path.exists(ruta_contador):
        with open(ruta_contador, 'r', encoding='utf-8') as f:
            data = json.load(f)
            ultimo = data.get('ultimo_id', 0)
    else:
        ultimo = 0
    nuevo_num = ultimo + 1
    with open(ruta_contador, 'w', encoding='utf-8') as f:
        json.dump({'ultimo_id': nuevo_num}, f)
    return f"ACT-{nuevo_num:03d}"

def obtener_siguiente_id_leccion():
    ruta_contador = os.path.join(app.root_path, 'data', 'contador_lecciones.json')
    os.makedirs(os.path.dirname(ruta_contador), exist_ok=True)
    if os.path.exists(ruta_contador):
        with open(ruta_contador, 'r', encoding='utf-8') as f:
            data = json.load(f)
            ultimo = data.get('ultimo_id', 0)
    else:
        ultimo = 0
    nuevo_num = ultimo + 1
    with open(ruta_contador, 'w', encoding='utf-8') as f:
        json.dump({'ultimo_id': nuevo_num}, f)
    return f"L-{nuevo_num:03d}"

# ==========================================
# FUNCIONES PARA EXTRAER DATOS DE ACTIVIDAD
# ==========================================
def extraer_datos_actividad(ruta_archivo_actividad):
    with open(ruta_archivo_actividad, 'r', encoding='utf-8') as f:
        contenido = f.read().strip()
    
    # Intentar como JSON primero
    if contenido.startswith('{'):
        try:
            data = json.loads(contenido)
            # Para completar camino, necesitamos izquierda, derecha, respuestas
            if 'izquierda' in data and 'derecha' in data and 'respuestas' in data:
                return {
                    'izquierda': f"const izquierda = {json.dumps(data['izquierda'])};",
                    'derecha': f"const derecha = {json.dumps(data['derecha'])};",
                    'respuestas': f"const respuestas = {json.dumps(data['respuestas'])};"
                }
            else:
                raise ValueError("El JSON no contiene los campos esperados para Completar Camino")
        except Exception as e:
            raise ValueError(f"Error parseando JSON: {e}")
    
    # Formato antiguo: buscar constantes en el cuerpo (después de '---')
    if '---' in contenido:
        _, cuerpo = contenido.split('---', 1)
    else:
        cuerpo = contenido
    
    izq_match = re.search(r'const izquierda\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
    der_match = re.search(r'const derecha\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
    res_match = re.search(r'const respuestas\s*=\s*(\{.*?\});', cuerpo, re.DOTALL)
    
    if not izq_match or not der_match or not res_match:
        raise ValueError("El archivo de actividad no tiene el formato esperado")
    
    return {
        'izquierda': f"const izquierda = {izq_match.group(1)};",
        'derecha': f"const derecha = {der_match.group(1)};",
        'respuestas': f"const respuestas = {res_match.group(1)};"
    }

def parsear_actividad_general(ruta_archivo_actividad):
    with open(ruta_archivo_actividad, 'r', encoding='utf-8') as f:
        contenido = f.read().strip()

    # --- Intento 1: Parsear como JSON (nuevo formato) ---
    if contenido.startswith('{'):
        try:
            import json
            data = json.loads(contenido)
            tipo = data.get('tipo')
            # Mapeo de tipo a ID_PLANTILLA
            tipo_a_id = {
                'falso-verdadero': 'P002',      # ← antes 'FV01'
                'opcion-multiple': 'P003',
                'completar-camino': 'C001',
                'sopa-letras': 'P004'
            }
            id_plantilla = tipo_a_id.get(tipo, 'P000')
            nombre_actividad = data.get('nombre', '')
            intentos_max = str(data.get('intentos', '3'))
            tiempo_estimado = data.get('tiempo', '')
            fecha_vencimiento = data.get('fecha_vencimiento', '')
            id_actividad = data.get('id_actividad', '')  # ← se guarda si existe

            preguntas = []

            if tipo == 'falso-verdadero':
                for p in data.get('preguntas', []):
                    preguntas.append({
                        'texto': p['afirmacion'],
                        'respuesta_correcta': p['respuesta']
                    })
            elif tipo == 'opcion-multiple':
                for p in data.get('preguntas', []):
                    preguntas.append({
                        'texto': p['afirmacion'],
                        'opciones': p['opciones'],
                        'respuesta_correcta': p['respuesta']
                    })
            elif tipo == 'completar-camino':
                izquierda = data.get('izquierda', [])
                derecha = data.get('derecha', [])
                for i in range(min(len(izquierda), len(derecha))):
                    preguntas.append({
                        'texto': izquierda[i],
                        'respuesta_correcta': derecha[i]
                    })
            elif tipo == 'sopa-letras':
                descripciones = data.get('descripciones', [])
                palabras = data.get('palabras', [])
                for i in range(min(len(descripciones), len(palabras))):
                    preguntas.append({
                        'texto': descripciones[i],
                        'palabra': palabras[i]
                    })

            return {
                'id_actividad': id_actividad,
                'nombre_actividad': nombre_actividad,
                'intentos_max': intentos_max,
                'tiempo_estimado': tiempo_estimado,
                'fecha_vencimiento': fecha_vencimiento,
                'tipo_plantilla': id_plantilla,
                'preguntas': preguntas
            }
        except Exception as e:
            print(f"Error parseando JSON: {e}")

    # --- Intento 2: Formato antiguo (texto plano con cabeceras y ---) ---
    try:
        # Separar cabecera y cuerpo
        if '---' in contenido:
            cabecera, cuerpo = contenido.split('---', 1)
        else:
            cabecera = contenido
            cuerpo = ""

        metadatos = {}
        for linea in cabecera.strip().split('\n'):
            if ':' in linea:
                clave, valor = linea.split(':', 1)
                metadatos[clave.strip()] = valor.strip()

        id_actividad = metadatos.get('ID_ACTIVIDAD', '')
        nombre_actividad = metadatos.get('NOMBRE', '')
        intentos_max = metadatos.get('INTENTOS', '')
        tiempo_estimado = metadatos.get('TIEMPO', '')
        fecha_vencimiento = metadatos.get('FECHA_VENCIMIENTO', '')
        id_plantilla = metadatos.get('ID_PLANTILLA', '')

        preguntas = []

        if id_plantilla == 'C001':  # Completar camino
            import re, ast
            izq_match = re.search(r'const izquierda\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
            der_match = re.search(r'const derecha\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
            res_match = re.search(r'const respuestas\s*=\s*(\{.*?\});', cuerpo, re.DOTALL)
            if izq_match and der_match and res_match:
                izquierda_list = ast.literal_eval(izq_match.group(1))
                respuestas_dict = ast.literal_eval(res_match.group(1))
                for pregunta in izquierda_list:
                    respuesta = respuestas_dict.get(pregunta, '')
                    preguntas.append({'texto': pregunta, 'respuesta_correcta': respuesta})

        elif id_plantilla in ('P002', 'FV01'):  # Falso/Verdadero
            lineas = cuerpo.strip().split('\n')
            pregunta_actual = None
            for linea in lineas:
                linea = linea.strip()
                if linea.startswith('Pregunta'):
                    partes = linea.split(':', 1)
                    if len(partes) == 2:
                        pregunta_actual = partes[1].strip()
                elif linea.startswith('Respuesta:') and pregunta_actual:
                    respuesta = linea.split(':', 1)[1].strip()
                    preguntas.append({'texto': pregunta_actual, 'respuesta_correcta': respuesta})
                    pregunta_actual = None

        elif id_plantilla == 'P003':  # Opción Múltiple
            lineas = cuerpo.strip().split('\n')
            pregunta_actual = None
            opciones_actual = None
            for linea in lineas:
                linea = linea.strip()
                if not linea:
                    continue
                if linea.startswith('Pregunta'):
                    partes = linea.split(':', 1)
                    if len(partes) == 2:
                        pregunta_actual = partes[1].strip()
                elif linea.startswith('Opciones:'):
                    opciones_str = linea.split(':', 1)[1].strip()
                    opciones_actual = [opt.strip() for opt in opciones_str.split('|') if opt.strip()]
                elif linea.startswith('Respuesta correcta:') and pregunta_actual and opciones_actual:
                    respuesta_letra = linea.split(':', 1)[1].strip().upper()
                    preguntas.append({
                        'texto': pregunta_actual,
                        'opciones': opciones_actual,
                        'respuesta_correcta': respuesta_letra
                    })
                    pregunta_actual = None
                    opciones_actual = None

        elif id_plantilla == 'P004':  # Sopa de Letras
            import re, ast
            desc_match = re.search(r'const descripciones\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
            pal_match = re.search(r'const palabras\s*=\s*(\[.*?\]);', cuerpo, re.DOTALL)
            if desc_match and pal_match:
                descripciones = ast.literal_eval(desc_match.group(1))
                palabras = ast.literal_eval(pal_match.group(1))
                for desc, pal in zip(descripciones, palabras):
                    preguntas.append({'texto': desc, 'palabra': pal})

        return {
            'id_actividad': id_actividad,
            'nombre_actividad': nombre_actividad,
            'intentos_max': intentos_max,
            'tiempo_estimado': tiempo_estimado,
            'fecha_vencimiento': fecha_vencimiento,
            'tipo_plantilla': id_plantilla,
            'preguntas': preguntas
        }
    except Exception as e:
        print(f"Error parseando formato texto: {e}")
        return {
            'id_actividad': '',
            'nombre_actividad': '',
            'intentos_max': '',
            'tiempo_estimado': '',
            'fecha_vencimiento': '',
            'tipo_plantilla': '',
            'preguntas': []
        }

def generar_html_multimedia(archivos):
    etiquetas = []
    for arch in archivos:
        nombre = arch
        ext = os.path.splitext(nombre)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            etiquetas.append(f'<img src="{nombre}" alt="{nombre}">')
        elif ext in ['.mp4', '.webm', '.ogg']:
            etiquetas.append(f'<video controls><source src="{nombre}" type="video/{ext[1:]}">Tu navegador no soporta video.</video>')
        elif ext == '.pdf':
            etiquetas.append(f'<iframe src="{nombre}" title="Documento PDF"></iframe>')
        elif ext in ['.mp3', '.wav', '.ogg']:
            etiquetas.append(f'<audio controls><source src="{nombre}" type="audio/{ext[1:]}">Tu navegador no soporta audio.</audio>')
        else:
            etiquetas.append(f'<p>Archivo adicional: <a href="{nombre}">{nombre}</a></p>')
    return '\n'.join(etiquetas)

def cargar_actividades():
    ruta_carpeta = os.path.join(app.root_path, 'data', 'actividades')
    if not os.path.exists(ruta_carpeta):
        ruta_carpeta = os.path.join(app.root_path, 'data', 'Actividades')
    lista_actividades = []
    if not os.path.exists(ruta_carpeta):
        os.makedirs(ruta_carpeta, exist_ok=True)
        return lista_actividades
    for archivo in os.listdir(ruta_carpeta):
        if archivo.endswith('.txt'):
            ruta_completa = os.path.join(ruta_carpeta, archivo)
            datos = {}
            try:
                with open(ruta_completa, 'r', encoding='utf-8') as f:
                    contenido = f.read().strip()
                # Intentar parsear como JSON primero (nuevo formato)
                if contenido.startswith('{'):
                    import json
                    data_json = json.loads(contenido)
                    # Dentro de cargar_actividades, en el bloque JSON:
                    datos['ID_PLANTILLA'] = {
                        'falso-verdadero': 'P002',      # ← antes 'FV01'
                        'opcion-multiple': 'P003',
                        'completar-camino': 'C001',
                        'sopa-letras': 'P004'
                    }.get(data_json.get('tipo'), 'P000')
                    datos['NOMBRE'] = data_json.get('nombre', 'Sin título')
                    datos['FECHA'] = ''  # No se guarda fecha en JSON, poner vacío o extraer si existe
                    # Si quieres mantener la fecha, podrías agregarla al JSON al guardar.
                else:
                    # Formato antiguo (texto plano)
                    for linea in contenido.split('\n'):
                        linea = linea.strip()
                        if linea == '---':
                            break
                        if ':' in linea:
                            clave, valor = linea.split(':', 1)
                            datos[clave.strip()] = valor.strip()
                id_plantilla = datos.get('ID_PLANTILLA', '')
                info_visual = CATALOGO_PLANTILLAS.get(id_plantilla, {'tipo': 'Desconocido', 'img': 'img/default.png'})
                datos['TIPO_LEGIBLE'] = info_visual['tipo']
                datos['IMAGEN'] = info_visual['img']
                datos['ARCHIVO'] = archivo
                if 'FECHA' not in datos or not datos['FECHA']:
                    datos['FECHA'] = '01/02/2026'
                lista_actividades.append(datos)
            except Exception as e:
                print(f"Error leyendo {archivo}: {e}")
    return lista_actividades

def obtener_info_leccion(carpeta):
    """Lee info_leccion.txt y extrae el título, ID_LECCION y la lista de archivos multimedia (excepto los del juego)."""
    ruta_info = os.path.join(LECCIONES_DIR, carpeta, 'info_leccion.txt')
    if not os.path.exists(ruta_info):
        return None
    
    with open(ruta_info, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    titulo = ""
    id_leccion = ""
    for linea in contenido.split('\n'):
        linea = linea.strip()
        if linea.startswith('TITULO:'):
            titulo = linea.split(':', 1)[1].strip()
        elif linea.startswith('ID_LECCION:'):
            id_leccion = linea.split(':', 1)[1].strip()
    
    # Si por alguna razón no se encontró el ID, usamos el nombre de carpeta como fallback
    if not id_leccion:
        id_leccion = carpeta
    
    # Listar archivos multimedia (excluir info_leccion.txt, index.html y las imágenes del juego)
    ruta_carpeta = os.path.join(LECCIONES_DIR, carpeta)
    excluir = {'info_leccion.txt', 'index.html', 'oak2.jpg', 'rana_quieto.png', 'rana_salto.gif'}
    archivos = []
    
    for f in os.listdir(ruta_carpeta):
        ruta_completa = os.path.join(ruta_carpeta, f)
        if f not in excluir and os.path.isfile(ruta_completa):
            tamaño = os.path.getsize(ruta_completa)
            archivos.append({'nombre': f, 'tamano': tamaño})
    
    return {
        'titulo': titulo,
        'archivos': archivos,
        'carpeta': carpeta,
        'id_leccion': id_leccion
    }

def leer_datos(archivo):
    ruta = os.path.join('data', archivo)
    if os.path.exists(ruta):
        with open(ruta, 'r', encoding='utf-8') as f:
            return [linea.strip() for linea in f.readlines()]
    return []

# ==========================================
# RUTAS
# ==========================================
@app.route('/')
def index():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    nombre = request.form.get('nombre')
    apellidos = request.form.get('apellidos')
    if nombre and apellidos:
        session['profesor'] = f"{nombre} {apellidos}"
        return redirect(url_for('vista_contenido'))
    return redirect(url_for('index'))

@app.route('/formatear_actividades')
def formatear_actividades():
    ruta_origen = os.path.join(app.root_path, 'data', 'actividades')
    ruta_destino = os.path.join(app.root_path, 'data', 'LECCIONES-LISTAS-PARA-ENVIAR')
    if not os.path.exists(ruta_destino):
        os.makedirs(ruta_destino)
    log_errores = []
    procesados = 0
    if not os.path.exists(ruta_origen):
        return "No existe la carpeta data/actividades"
    for nombre_archivo in os.listdir(ruta_origen):
        if nombre_archivo.endswith('.txt'):
            path_origen = os.path.join(ruta_origen, nombre_archivo)
            try:
                contenido = ""
                try:
                    with open(path_origen, 'r', encoding='utf-8') as f:
                        contenido = f.read()
                except UnicodeDecodeError:
                    with open(path_origen, 'r', encoding='latin-1') as f:
                        contenido = f.read()
                if '---' in contenido:
                    partes = contenido.split('---')
                    cabecera = partes[0].strip().split('\n')
                    cuerpo = partes[1].strip().split('\n')
                else:
                    cabecera = contenido.strip().split('\n')
                    cuerpo = []
                meta = {}
                for linea in cabecera:
                    if ':' in linea:
                        clave, valor = linea.split(':', 1)
                        meta[clave.strip()] = valor.strip()
                nuevo = []
                nuevo.append("=== [ENTIDAD: PROFESOR] ===")
                nuevo.append("ID_PROFESOR: 101")
                nuevo.append("NOMBRE_COMPLETO: Profesor T.O.R.O.\n")
                nuevo.append("=== [ENTIDAD: LECCIÓN] ===")
                nuevo.append(f"ID_LECCION: {nombre_archivo.replace('.txt', '')}")
                nuevo.append(f"TITULO: {meta.get('LECCION', 'Generico')}")
                nuevo.append("TEMA: General\n")
                nuevo.append("--- [RELACIÓN: INCORPORA -> CONTENIDO MULTIMEDIA] ---")
                nuevo.append("CONTENIDO_1: estandar.jpg | Tipo: Imagen | Ruta: ./assets/estandar.jpg\n")
                nuevo.append("=== [ENTIDAD: ACTIVIDAD] ===")
                nuevo.append(f"ID_ACTIVIDAD: ACT-{abs(hash(nombre_archivo))}")
                nuevo.append(f"NOMBRE_ACTIVIDAD: {meta.get('NOMBRE', nombre_archivo)}")
                nuevo.append(f"INTENTOS_MAX: {meta.get('INTENTOS', '1')}")
                tiempo = meta.get('TIEMPO', '0').lower().replace('minutos', '').replace('mins', '').strip()
                nuevo.append(f"TIEMPO_ESTIMADO: {tiempo} minutos\n")
                nuevo.append("--- [RELACIÓN: GENERA <- PLANTILLA: OPCIÓN MÚLTIPLE] ---")
                contador = 1
                letras = ['a', 'b', 'c', 'd']
                for linea in cuerpo:
                    linea = linea.strip()
                    if not linea: continue
                    campos = [c.strip() for c in linea.split('|')]
                    if len(campos) >= 6:
                        preg_texto = campos[0]
                        opciones = campos[1:5]
                        respuesta_correcta_texto = campos[5]
                        letra = 'a'
                        match_encontrado = False
                        if respuesta_correcta_texto in opciones:
                            letra = letras[opciones.index(respuesta_correcta_texto)]
                            match_encontrado = True
                        if not match_encontrado and len(respuesta_correcta_texto) == 1:
                            letra = respuesta_correcta_texto.lower()
                        nuevo.append(f"PREGUNTA_{contador}: {preg_texto}")
                        nuevo.append(f"OPCIONES: a) {opciones[0]}, b) {opciones[1]}, c) {opciones[2]}, d) {opciones[3]}")
                        nuevo.append(f"RESPUESTA: {letra}\n")
                        contador += 1
                path_destino = os.path.join(ruta_destino, nombre_archivo)
                with open(path_destino, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(nuevo))
                procesados += 1
            except Exception as e:
                log_errores.append(f"{nombre_archivo}: {str(e)}")
    if log_errores:
        return jsonify({'status': 'Con Errores', 'procesados': procesados, 'errores': log_errores})
    else:
        return f"¡Éxito! {procesados} archivos convertidos correctamente en data/LECCIONES-LISTAS-PARA-ENVIAR"

from gestor_archivos import obtener_lista_lecciones, crear_estructura_leccion

@app.route('/contenido')
def vista_contenido():
    lecciones_reales = obtener_lista_lecciones()
    actividades = cargar_actividades()
    return render_template('contenido/contenido.html',
                           lecciones=lecciones_reales,
                           actividades=actividades,
                           active_page='contenido')

@app.route('/contenido/subir_leccion', methods=['GET', 'POST'])
def subir_leccion():
    if request.method == 'POST':
        grupo = request.form.get('grupo')
        materia = request.form.get('materia')
        parcial = request.form.get('parcial')
        tema = request.form.get('tema')
        nombre_actividad_leccion = request.form.get('actividad')
        actividad_seleccionada = request.form.get('actividad_seleccionada')
        orden_archivos_str = request.form.get('orden_archivos', '')
        archivos_subidos = request.files.getlist('archivos')
        if not nombre_actividad_leccion:
            return "Falta el nombre de la actividad", 400
        if not actividad_seleccionada:
            return "Debes seleccionar una actividad", 400
        try:
            ruta_destino = crear_estructura_leccion(grupo, materia, parcial, tema, nombre_actividad_leccion)
            imagenes_juego = ['oak2.jpg', 'rana_quieto.png', 'rana_salto.gif']
            ruta_origen_imagenes = os.path.join(app.root_path, 'static', 'img', 'imagenesActividades')
            for img in imagenes_juego:
                origen = os.path.join(ruta_origen_imagenes, img)
                if os.path.exists(origen):
                    shutil.copy2(origen, os.path.join(ruta_destino, img))
                else:
                    print(f"⚠️ No se encontró la imagen {img} en {origen}")
            nombres_archivos = []
            if orden_archivos_str:
                orden_nombres = orden_archivos_str.split(',')
                archivos_dict = {f.filename: f for f in archivos_subidos if f.filename}
                archivos_ordenados = []
                for nombre in orden_nombres:
                    if nombre in archivos_dict:
                        archivos_ordenados.append(archivos_dict[nombre])
                for f in archivos_subidos:
                    if f.filename and f.filename not in orden_nombres:
                        archivos_ordenados.append(f)
            else:
                archivos_ordenados = archivos_subidos
            for archivo in archivos_ordenados:
                if archivo and archivo.filename:
                    nombre_seguro = secure_filename(archivo.filename)
                    ruta_archivo = os.path.join(ruta_destino, nombre_seguro)
                    archivo.save(ruta_archivo)
                    nombres_archivos.append(nombre_seguro)
            ruta_actividad_origen = os.path.join(app.root_path, 'data', 'actividades', actividad_seleccionada)
            if not os.path.exists(ruta_actividad_origen):
                return f"El archivo de actividad {actividad_seleccionada} no existe", 400

            # === PARSEAR ACTIVIDAD ===
            actividad_data = parsear_actividad_general(ruta_actividad_origen)
            tipo_plantilla = actividad_data['tipo_plantilla']

            id_leccion = obtener_siguiente_id_leccion()
            nombre_profesor = session.get('profesor', 'Profesor no especificado')

            # === GENERAR info_leccion.txt ===
            metadatos = []
            metadatos.append("=== [ENTIDAD: PROFESOR] ===")
            metadatos.append(f"NOMBRE_COMPLETO: {nombre_profesor}\n")
            metadatos.append("=== [ENTIDAD: LECCIÓN] ===")
            metadatos.append(f"ID_LECCION: {id_leccion}")
            metadatos.append(f"TITULO: {nombre_actividad_leccion}")
            metadatos.append(f"TEMA: {tema}")
            metadatos.append(f"PARCIAL: {parcial}")
            metadatos.append(f"MATERIA: {materia}")
            metadatos.append(f"GRUPO: {grupo}\n")
            metadatos.append("--- [RELACIÓN: INCORPORA -> CONTENIDO MULTIMEDIA] ---")
            for idx, arch in enumerate(nombres_archivos, start=1):
                ext = os.path.splitext(arch)[1].lower()
                tipo = "Imagen"
                if ext in ['.mp4', '.webm', '.ogg']:
                    tipo = "Video"
                elif ext == '.pdf':
                    tipo = "PDF"
                elif ext in ['.mp3', '.wav', '.ogg']:
                    tipo = "Audio"
                metadatos.append(f"CONTENIDO_{idx}: {arch} | Tipo: {tipo} | Ruta: {arch}")
            metadatos.append("")
            metadatos.append("=== [ENTIDAD: ACTIVIDAD] ===")
            metadatos.append(f"ID_ACTIVIDAD: {actividad_data['id_actividad']}")
            metadatos.append(f"NOMBRE_ACTIVIDAD: {actividad_data['nombre_actividad']}")
            metadatos.append(f"INTENTOS_MAX: {actividad_data['intentos_max']}")
            metadatos.append(f"TIEMPO_ESTIMADO: {actividad_data['tiempo_estimado']}")
            metadatos.append(f"FECHA_VENCIMIENTO: {actividad_data['fecha_vencimiento']}\n")

            # Escribir relación según tipo de plantilla
            if tipo_plantilla == 'C001':
                metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: Completar Camino] ---\n")
                for i, p in enumerate(actividad_data['preguntas'], start=1):
                    metadatos.append(f"PREGUNTA_{i}: {p['texto']}")
                    metadatos.append(f"RESPUESTA: {p['respuesta_correcta']}\n")
            elif tipo_plantilla == 'P002':
                metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: VERDADERO O FALSO] ---\n")
                for i, p in enumerate(actividad_data['preguntas'], start=1):
                    metadatos.append(f"PREGUNTA_{i}:")
                    metadatos.append(f"ENUNCIADO: {p['texto']}")
                    metadatos.append("TIPO: VERDADERO_FALSO")
                    metadatos.append(f"RESPUESTA_CORRECTA: {p['respuesta_correcta']}\n")
            elif tipo_plantilla == 'P003':
                metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: OPCIÓN MÚLTIPLE] ---\n")
                for i, p in enumerate(actividad_data['preguntas'], start=1):
                    metadatos.append(f"PREGUNTA_{i}:")
                    metadatos.append(f"ENUNCIADO: {p['texto']}")
                    metadatos.append(f"OPCIONES: {' | '.join(p['opciones'])}")
                    metadatos.append(f"RESPUESTA_CORRECTA: {p['respuesta_correcta']}\n")
            elif tipo_plantilla == 'P004':
                metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: SOPA DE LETRAS] ---\n")
                for i, p in enumerate(actividad_data['preguntas'], start=1):
                    metadatos.append(f"PALABRA_{i}: {p['palabra']}")
                    metadatos.append(f"DESCRIPCIÓN_{i}: {p['texto']}\n")
            else:
                metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: DESCONOCIDA] ---\n")

            ruta_metadatos = os.path.join(ruta_destino, 'info_leccion.txt')
            with open(ruta_metadatos, 'w', encoding='utf-8') as f:
                f.write('\n'.join(metadatos))
            print(f"✅ Metadatos guardados en {ruta_metadatos}")

            # === GENERAR HTML ===
            if tipo_plantilla == 'C001':
                plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion.html')
                datos_act = extraer_datos_actividad(ruta_actividad_origen)
            elif tipo_plantilla == 'P002':
                plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_fv.html')
                datos_act = None
            elif tipo_plantilla == 'P003':
                plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_opcion_multiple.html')
                datos_act = None
            elif tipo_plantilla == 'P004':
                plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_sopa.html')
                datos_act = None
            else:
                return f"Tipo de actividad no soportado: {tipo_plantilla}", 400

            html_multimedia = generar_html_multimedia(nombres_archivos)

            with open(plantilla_path, 'r', encoding='utf-8') as f:
                plantilla_html = f.read()

            # Reemplazos comunes
            html_final = plantilla_html.replace('{{ ARCHIVOS_MULTIMEDIA }}', html_multimedia)
            html_final = html_final.replace('{{ titulo_leccion }}', nombre_actividad_leccion)
            html_final = html_final.replace('{{ tema }}', tema)

            if tipo_plantilla == 'C001' and datos_act:
                html_final = html_final.replace('{{ IZQUIERDA_ARRAY }}', datos_act['izquierda'])
                html_final = html_final.replace('{{ DERECHA_ARRAY }}', datos_act['derecha'])
                html_final = html_final.replace('{{ RESPUESTAS_OBJ }}', datos_act['respuestas'])
            elif tipo_plantilla == 'P002':
                preguntas_html = ""
                for idx, p in enumerate(actividad_data['preguntas'], 1):
                    preguntas_html += f'''
        <div class="question-card">
            <h3>{idx}. {p['texto']}</h3>
            <label><input type="radio" name="p{idx}" value="v"> Verdadero</label><br><br>
            <label><input type="radio" name="p{idx}" value="f"> Falso</label>
        </div>
        '''
                html_final = html_final.replace('{{ PREGUNTAS_HTML }}', preguntas_html)
            elif tipo_plantilla == 'P003':
                preguntas_html = ""
                for idx, p in enumerate(actividad_data['preguntas'], 1):
                    opciones_html = ""
                    letras = ['A', 'B', 'C', 'D']
                    for opt_idx, opt_texto in enumerate(p['opciones']):
                        letra = letras[opt_idx] if opt_idx < len(letras) else str(opt_idx+1)
                        opciones_html += f'<label class="opcion"><input type="radio" name="p{idx}" value="{letra}"> {opt_texto}</label><br>'
                    preguntas_html += f'''
        <div class="question-card">
            <h3>{idx}. {p['texto']}</h3>
            {opciones_html}
        </div>
        '''
                html_final = html_final.replace('{{ PREGUNTAS_HTML }}', preguntas_html)
            elif tipo_plantilla == 'P004':
                # Construir JSON con palabras y descripciones
                preguntas_json = []
                for p in actividad_data['preguntas']:
                    preguntas_json.append({'palabra': p['palabra'], 'texto': p['texto']})
                import json
                preguntas_json_str = json.dumps(preguntas_json, ensure_ascii=False)
                html_final = html_final.replace('{{ PREGUNTAS_JSON }}', preguntas_json_str)

            ruta_html = os.path.join(ruta_destino, 'index.html')
            with open(ruta_html, 'w', encoding='utf-8') as f:
                f.write(html_final)
            print(f"✅ HTML generado en {ruta_html}")

                                    # === OFUSCAR Y EMPAQUETAR EN .ZIP ===
            try:
                def ofuscar_reporte(texto: str) -> str:
                    firma = str(len(texto) * 77)
                    texto_con_firma = texto + "||" + firma
                    texto_modificado = "".join(chr(ord(c) + 3) for c in texto_con_firma)
                    encoded_bytes = texto_modificado.encode("utf-8")
                    return base64.b64encode(encoded_bytes).decode("ascii")
                
                with open(ruta_metadatos, 'r', encoding='utf-8') as f:
                    texto_original = f.read()
                texto_ofuscado = ofuscar_reporte(texto_original)
                
                ruta_actividades_formateadas = os.path.join(app.root_path, 'data', 'LECCIONES-LISTAS-PARA-ENVIAR')
                os.makedirs(ruta_actividades_formateadas, exist_ok=True)
                
                nombre_carpeta_leccion = os.path.basename(ruta_destino)
                nombre_zip = nombre_carpeta_leccion + ".zip"
                ruta_zip = os.path.join(ruta_actividades_formateadas, nombre_zip)
                
                # Borrar zip antiguo si existe
                if os.path.exists(ruta_zip):
                    os.remove(ruta_zip)
                
                with zipfile.ZipFile(ruta_zip, "w", zipfile.ZIP_DEFLATED) as zf:
                    zf.writestr("info_leccion.txt", texto_ofuscado)
                    zf.write(ruta_html, "index.html")
                    
                    # Agregar archivos multimedia solo si existen físicamente
                    for archivo in os.listdir(ruta_destino):
                        ruta_completa_archivo = os.path.join(ruta_destino, archivo)
                        if archivo not in ["info_leccion.txt", "index.html"] and os.path.isfile(ruta_completa_archivo):
                            # Verificar existencia real (por si el archivo fue borrado después de listar)
                            if os.path.exists(ruta_completa_archivo):
                                zf.write(ruta_completa_archivo, archivo)
                            else:
                                print(f"⚠️ Advertencia: El archivo '{archivo}' no existe físicamente. Se omite del ZIP.")
                
                print(f"✅ ZIP ofuscado generado en {ruta_zip}")
            except Exception as e:
                print(f"Error al crear el ZIP: {e}")
                # No interrumpimos la creación de la lección si falla el zip

            return redirect(url_for('vista_contenido'))
        except Exception as e:
            print(f"Error al crear lección: {e}")
            return f"Hubo un error al procesar la carpeta: {e}", 500
    # GET: mostrar formulario
    lecciones_existentes = obtener_lista_lecciones()
    actividades = cargar_actividades()
    return render_template('contenido/contenido_crear_leccion.html',
                           lecciones=lecciones_existentes,
                           actividades=actividades,
                           active_page='contenido')

@app.route('/actividad/eliminar/<string:nombre_archivo>')
def eliminar_actividad(nombre_archivo):
    carpeta_actividades = os.path.join(app.root_path, 'data', 'actividades')
    if not os.path.exists(carpeta_actividades):
        carpeta_actividades = os.path.join(app.root_path, 'data', 'Actividades')
    ruta_completa = os.path.join(carpeta_actividades, nombre_archivo)
    try:
        if os.path.exists(ruta_completa):
            os.remove(ruta_completa)
            print(f"Archivo eliminado: {nombre_archivo}")
        else:
            print("El archivo no existe")
    except Exception as e:
        print(f"Error al borrar: {e}")
    return redirect(url_for('vista_contenido'))

@app.route('/actividad/editar/<string:nombre_archivo>', methods=['GET', 'POST'])
def editar_actividad(nombre_archivo):
    carpeta = os.path.join(current_app.root_path, 'data', 'actividades')
    ruta_completa = os.path.join(carpeta, nombre_archivo)
    try:
        with open(ruta_completa, 'r', encoding='utf-8') as f:
            contenido_total = f.read()
    except FileNotFoundError:
        return "Error: El archivo no existe."
    partes = contenido_total.split('---')
    cabecera_lines = partes[0].strip().split('\n')
    cuerpo_original = partes[1].strip() if len(partes) > 1 else ""
    meta = {}
    for linea in cabecera_lines:
        if ':' in linea:
            clave, valor = linea.split(':', 1)
            meta[clave.strip()] = valor.strip()
    id_actividad = meta.get('ID_ACTIVIDAD', 'ERROR-ID')
    id_plantilla = meta.get('ID_PLANTILLA', 'P000')
    fecha = meta.get('FECHA', '01/01/2026')
    if request.method == 'POST':
        nuevo_nombre = request.form['nombre']
        nuevo_contenido = request.form['contenido_raw']
        nuevo_archivo_str = f"ID_ACTIVIDAD: {id_actividad}\n"
        nuevo_archivo_str += f"ID_PLANTILLA: {id_plantilla}\n"
        nuevo_archivo_str += f"FECHA: {fecha}\n"
        nuevo_archivo_str += f"NOMBRE: {nuevo_nombre}\n"
        nuevo_archivo_str += "---\n"
        nuevo_archivo_str += nuevo_contenido.strip()
        with open(ruta_completa, 'w', encoding='utf-8') as f:
            f.write(nuevo_archivo_str)
        return redirect(url_for('vista_contenido'))
    datos_vista = {
        'NOMBRE': meta.get('NOMBRE', ''),
        'CUERPO': cuerpo_original
    }
    return render_template('contenido/editar_actividad.html',
                           archivo=nombre_archivo,
                           datos=datos_vista,
                           id_plantilla=id_plantilla,
                           active_page='contenido')

@app.route('/actividad/crear', methods=['GET', 'POST'])
def crear_actividad():
    if request.method == 'POST':
        try:
            plantilla = request.form.get('plantilla_seleccionada')
            leccion_padre = request.form.get('leccion_padre')
            nombre_actividad = request.form.get('nombre_confirmacion')
            intentos = request.form.get('intentos')
            tiempo_num = request.form.get('tiempo_limite') or "Sin límite"
            instrucciones = request.form.get('instrucciones') or "Sin instrucciones específicas."
            if not nombre_actividad or not leccion_padre:
                return "Faltan datos obligatorios (Nombre o Lección)", 400
            preguntas = []
            claves = sorted(request.form.keys())
            for key in claves:
                if key.startswith('q_') and key.endswith('_text'):
                    q_id = key.split('_')[1]
                    letra_correcta = request.form.get(f'q_{q_id}_correct')
                    opA = request.form.get(f'q_{q_id}_optA')
                    opB = request.form.get(f'q_{q_id}_optB')
                    opC = request.form.get(f'q_{q_id}_optC')
                    opD = request.form.get(f'q_{q_id}_optD')
                    texto_correcta = ""
                    if letra_correcta == 'A': texto_correcta = opA
                    elif letra_correcta == 'B': texto_correcta = opB
                    elif letra_correcta == 'C': texto_correcta = opC
                    elif letra_correcta == 'D': texto_correcta = opD
                    pregunta = {
                        "texto": request.form.get(f'q_{q_id}_text'),
                        "opA": opA,
                        "opB": opB,
                        "opC": opC,
                        "opD": opD,
                        "correcta_texto": texto_correcta
                    }
                    preguntas.append(pregunta)
            id_actividad = obtener_siguiente_id_actividad()
            contenido_archivo = f"ID_ACTIVIDAD: {id_actividad}\n"
            contenido_archivo += f"ID_PLANTILLA: {plantilla}\n"
            contenido_archivo += f"NOMBRE: {nombre_actividad}\n"
            contenido_archivo += f"LECCION: {leccion_padre}\n"
            contenido_archivo += f"INTENTOS: {intentos}\n"
            contenido_archivo += f"TIEMPO: {tiempo_num} minutos\n"
            contenido_archivo += f"TOTAL_PREGUNTAS: {len(preguntas)}\n"
            contenido_archivo += f"INSTRUCCIONES: {instrucciones}\n"
            contenido_archivo += "---\n"
            for p in preguntas:
                linea = f"{p['texto']}|{p['opA']}|{p['opB']}|{p['opC']}|{p['opD']}|{p['correcta_texto']}\n"
                contenido_archivo += linea
            ruta_carpeta = os.path.join(app.root_path, 'data', 'Actividades')
            if not os.path.exists(ruta_carpeta):
                os.makedirs(ruta_carpeta)
            nombre_archivo = f"{nombre_actividad.replace(' ', '_')}.txt"
            ruta_completa = os.path.join(ruta_carpeta, nombre_archivo)
            with open(ruta_completa, 'w', encoding='utf-8') as f:
                f.write(contenido_archivo)
            print(f"Actividad guardada con ID {id_actividad}: {ruta_completa}")
            return redirect(url_for('vista_contenido'))
        except Exception as e:
            print(f"Error al guardar actividad: {e}")
            return f"Error interno: {str(e)}", 500
    lista_lecciones = obtener_lista_lecciones()
    return render_template('contenido/crearActividad.html',
                           active_page='contenido',
                           lecciones=lista_lecciones)

# ==========================================
# GRUPOS, CALIFICACIONES, ETC. (NUEVO SISTEMA CON grupos.txt)
# ==========================================

def validar_archivo_alumnos(archivo):
    """Valida el contenido del archivo TXT de alumnos y devuelve lista de alumnos o lanza excepción."""
    contenido = archivo.read().decode('utf-8').replace('\r', '').strip()
    if not contenido:
        raise ValueError('El archivo está vacío.')
    lineas = [linea.strip() for linea in contenido.split('\n') if linea.strip()]
    alumnos = []
    for idx, linea in enumerate(lineas, start=1):
        partes = linea.split('|')
        if len(partes) != 3:
            raise ValueError(f'Error en línea {idx}: Debe tener 3 campos separados por "|".')
        matricula, nombres, apellidos = [p.strip() for p in partes]
        if not matricula or not nombres or not apellidos:
            raise ValueError(f'Error en línea {idx}: Ningún campo puede estar vacío.')
        alumnos.append({
            'matricula': matricula,
            'nombres': nombres,
            'apellidos': apellidos
        })
    # Devolver el puntero al principio para futuras operaciones
    archivo.seek(0)
    return alumnos

def leer_grupos():
    """Lee el archivo data/grupos.txt y devuelve una lista de grupos en formato JSON."""
    ruta = os.path.join(app.root_path, 'data', 'grupos.txt')
    grupos = []
    if not os.path.exists(ruta):
        return grupos
    
    with open(ruta, 'r', encoding='utf-8') as f:
        lineas = [linea.strip() for linea in f.readlines() if linea.strip() != '']
    
    i = 0
    while i < len(lineas):
        if lineas[i] == '%':
            # Inicio de un grupo
            i += 1
            if i >= len(lineas):
                break
            # Siguiente línea debe ser @nombre@
            if not lineas[i].startswith('@') or not lineas[i].endswith('@'):
                i += 1
                continue
            nombre_grupo = lineas[i][1:-1]
            i += 1
            materias = []
            alumnos = []
            # Ahora leemos hasta encontrar un '-' que separa estructura de alumnos
            while i < len(lineas) and lineas[i] != '-':
                # Procesar materias, parciales, progresiones
                linea = lineas[i]
                if linea.startswith('#') and linea.endswith('#'):
                    # Materia
                    nombre_materia = linea[1:-1]
                    materia_actual = {'nombre': nombre_materia, 'parciales': []}
                    materias.append(materia_actual)
                    i += 1
                    # Leer parciales y progresiones de esta materia
                    while i < len(lineas) and lineas[i] != '-' and not (lineas[i].startswith('#') and lineas[i].endswith('#')):
                        if lineas[i].startswith('*') and lineas[i].endswith('*'):
                            nombre_parcial = lineas[i][1:-1]
                            parcial_actual = {'nombre': nombre_parcial, 'progresiones': []}
                            materia_actual['parciales'].append(parcial_actual)
                            i += 1
                            # Leer progresiones de este parcial
                            while i < len(lineas) and lineas[i] != '-' and not (lineas[i].startswith('*') and lineas[i].endswith('*')) and not (lineas[i].startswith('#') and lineas[i].endswith('#')):
                                if lineas[i].startswith('&') and lineas[i].endswith('&'):
                                    nombre_progresion = lineas[i][1:-1]
                                    parcial_actual['progresiones'].append(nombre_progresion)
                                    i += 1
                                else:
                                    # Si no es &, rompemos (no debería pasar)
                                    break
                        else:
                            # Si no es *, avanzamos (por si hay líneas mal formadas)
                            i += 1
                else:
                    # Si no es #, avanzamos (por si hay espacios)
                    i += 1
            # Ahora estamos en el '-' que separa estructura de alumnos
            if i < len(lineas) and lineas[i] == '-':
                i += 1
                # Leer alumnos hasta encontrar otro '-' o el final del grupo
                while i < len(lineas) and lineas[i] != '-':
                    if '|' in lineas[i]:
                        partes = lineas[i].split('|')
                        if len(partes) >= 3:
                            alumnos.append({
                                'matricula': partes[0].strip(),
                                'nombres': partes[1].strip(),
                                'apellidos': partes[2].strip()
                            })
                    i += 1
                # Saltar el '-' que cierra la lista de alumnos (si está)
                if i < len(lineas) and lineas[i] == '-':
                    i += 1
            # Ahora debe venir el '%' que cierra el grupo, pero lo omitimos
            grupos.append({
                'nombre': nombre_grupo,
                'materias': materias,
                'alumnos': alumnos
            })
        else:
            i += 1
    return grupos

def escribir_grupos(grupos):
    """Escribe la lista de grupos en data/grupos.txt con el formato requerido."""
    ruta = os.path.join(app.root_path, 'data', 'grupos.txt')
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    lineas = []
    for grupo in grupos:
        lineas.append('%')
        lineas.append(f"@{grupo['nombre']}@")
        for materia in grupo.get('materias', []):
            lineas.append(f"#{materia['nombre']}#")
            for parcial in materia.get('parciales', []):
                lineas.append(f"*{parcial['nombre']}*")
                for prog in parcial.get('progresiones', []):
                    lineas.append(f"&{prog}&")
        lineas.append('-')
        for alumno in grupo.get('alumnos', []):
            lineas.append(f"{alumno['matricula']}|{alumno['nombres']}|{alumno['apellidos']}")
        lineas.append('-')
    lineas.append('%')
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lineas))
    print(f"✅ grupos.txt actualizado con {len(grupos)} grupos")

# ==========================================
# RUTAS DE GRUPOS (USANDO grupos.txt)
# ==========================================

@app.route('/grupos')
def vista_grupos():
    """Vista principal de grupos (solo renderiza el HTML)."""
    return render_template('grupos/grupos.html', active_page='grupos')

@app.route('/api/grupos', methods=['GET'])
def api_obtener_grupos():
    """Devuelve la lista de grupos con materias y parciales (sin alumnos)."""
    grupos = leer_grupos()
    # Construir respuesta simplificada (sin alumnos)
    resultado = []
    for g in grupos:
        resultado.append({
            'nombre': g['nombre'],
            'materias': [
                {
                    'nombre': m['nombre'],
                    'parciales': [
                        {
                        'nombre': p['nombre'],
                        'progresiones': p['progresiones']
                        } for p in m['parciales']
                    ]
                } for m in g['materias']
            ]
        })
    return jsonify(resultado)

@app.route('/crear_grupo', methods=['POST'])
def crear_grupo():
    try:
        nombre_grupo = request.form.get('nombre')
        archivo = request.files.get('archivo')
        if not nombre_grupo or not archivo:
            return jsonify({'exito': False, 'mensaje': 'Faltan datos (nombre o archivo)'})
        nombre_grupo = nombre_grupo.strip()
        
        # Validar que no exista ya un grupo con ese nombre
        grupos = leer_grupos()
        for g in grupos:
            if g['nombre'] == nombre_grupo:
                return jsonify({'exito': False, 'mensaje': 'Ya existe un grupo con ese nombre.'})
        
        # Validar el archivo y extraer alumnos
        try:
            alumnos = validar_archivo_alumnos(archivo)
        except ValueError as e:
            return jsonify({'exito': False, 'mensaje': str(e)})
        
        # Crear nuevo grupo
        nuevo_grupo = {
            'nombre': nombre_grupo,
            'materias': [],
            'alumnos': alumnos
        }
        grupos.append(nuevo_grupo)
        escribir_grupos(grupos)
        return jsonify({'exito': True, 'mensaje': 'Grupo creado exitosamente'})
    except Exception as e:
        print(f"Error al crear grupo: {e}")
        return jsonify({'exito': False, 'mensaje': f'Error interno: {str(e)}'})
    


@app.route('/api/crear_materia', methods=['POST'])
def api_crear_materia():
    data = request.json
    grupo_idx = data.get('grupo')
    nombre_materia = data.get('materia')
    if grupo_idx is None or not nombre_materia:
        return jsonify({'exito': False, 'mensaje': 'Faltan datos'})
    try:
        grupos = leer_grupos()
        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})
        # Verificar si ya existe una materia con ese nombre en el grupo
        for m in grupos[grupo_idx]['materias']:
            if m['nombre'] == nombre_materia:
                return jsonify({'exito': False, 'mensaje': 'La materia ya existe en este grupo'})
        grupos[grupo_idx]['materias'].append({'nombre': nombre_materia, 'parciales': []})
        escribir_grupos(grupos)
        return jsonify({'exito': True})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/api/editar_materia', methods=['POST'])
def api_editar_materia():
    data = request.json
    grupos = leer_grupos()
    grupos[data['grupo']]['materias'][data['materia']]['nombre'] = data['nombre']
    escribir_grupos(grupos)
    return jsonify({'exito': True})

@app.route('/api/editar_grupo', methods=['POST'])
def api_editar_grupo():
    try:
        data = request.json
        grupo_idx = data.get('grupo')
        nuevo_nombre = data.get('nombre', '').strip()

        if grupo_idx is None or not nuevo_nombre:
            return jsonify({'exito': False, 'mensaje': 'Faltan datos'})

        grupos = leer_grupos()

        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})

        for i, g in enumerate(grupos):
            if i != grupo_idx and g['nombre'] == nuevo_nombre:
                return jsonify({'exito': False, 'mensaje': 'Ya existe un grupo con ese nombre.'})

        grupos[grupo_idx]['nombre'] = nuevo_nombre
        escribir_grupos(grupos)

        return jsonify({'exito': True})

    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/api/editar_parcial', methods=['POST'])
def api_editar_parcial():
    data = request.json
    grupos = leer_grupos()
    grupos[data['grupo']]['materias'][data['materia']]['parciales'][data['parcial']]['nombre'] = data['nombre']
    escribir_grupos(grupos)
    return jsonify({'exito': True})

@app.route('/api/crear_parcial', methods=['POST'])
def api_crear_parcial():
    data = request.json
    grupo_idx = data.get('grupo')
    materia_idx = data.get('materia')
    nombre_parcial = data.get('nombre')
    if grupo_idx is None or materia_idx is None or not nombre_parcial:
        return jsonify({'exito': False, 'mensaje': 'Faltan datos'})
    try:
        grupos = leer_grupos()
        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})
        materias = grupos[grupo_idx]['materias']
        if materia_idx < 0 or materia_idx >= len(materias):
            return jsonify({'exito': False, 'mensaje': 'Materia no válida'})
        # Verificar límite de 3 parciales
        if len(materias[materia_idx]['parciales']) >= 3:
            return jsonify({'exito': False, 'mensaje': 'Máximo 3 parciales por materia'})
        # Verificar que no exista un parcial con el mismo nombre
        for p in materias[materia_idx]['parciales']:
            if p['nombre'] == nombre_parcial:
                return jsonify({'exito': False, 'mensaje': 'El parcial ya existe'})
        materias[materia_idx]['parciales'].append({'nombre': nombre_parcial, 'progresiones': []})
        escribir_grupos(grupos)
        return jsonify({'exito': True})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/api/crear_progresion', methods=['POST'])
def api_crear_progresion():
    data = request.json
    grupo_idx = data.get('grupo')
    materia_idx = data.get('materia')
    parcial_idx = data.get('parcial')
    nombre_progresion = data.get('nombre')
    if None in (grupo_idx, materia_idx, parcial_idx, nombre_progresion):
        return jsonify({'exito': False, 'mensaje': 'Faltan datos'})
    try:
        grupos = leer_grupos()
        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})
        materias = grupos[grupo_idx]['materias']
        if materia_idx < 0 or materia_idx >= len(materias):
            return jsonify({'exito': False, 'mensaje': 'Materia no válida'})
        parciales = materias[materia_idx]['parciales']
        if parcial_idx < 0 or parcial_idx >= len(parciales):
            return jsonify({'exito': False, 'mensaje': 'Parcial no válido'})
        # Verificar que no exista ya esa progresión
        if nombre_progresion in parciales[parcial_idx]['progresiones']:
            return jsonify({'exito': False, 'mensaje': 'La progresión ya existe'})
        parciales[parcial_idx]['progresiones'].append(nombre_progresion)
        escribir_grupos(grupos)
        return jsonify({'exito': True})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/api/eliminar_elemento', methods=['POST'])
def api_eliminar_elemento():
    data = request.json
    try:
        grupos = leer_grupos()
        grupo_idx = data.get('grupo')
        if grupo_idx is None:
            return jsonify({'exito': False, 'mensaje': 'Se requiere el índice del grupo'})
        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})
        # Si solo viene grupo: eliminar todo el grupo
        if 'materia' not in data:
            grupos.pop(grupo_idx)
            escribir_grupos(grupos)
            return jsonify({'exito': True})
        # Eliminar materia
        materia_idx = data.get('materia')
        if materia_idx is None or materia_idx < 0 or materia_idx >= len(grupos[grupo_idx]['materias']):
            return jsonify({'exito': False, 'mensaje': 'Materia no válida'})
        if 'parcial' not in data:
            grupos[grupo_idx]['materias'].pop(materia_idx)
            escribir_grupos(grupos)
            return jsonify({'exito': True})
        # Eliminar parcial
        parcial_idx = data.get('parcial')
        if parcial_idx is None or parcial_idx < 0 or parcial_idx >= len(grupos[grupo_idx]['materias'][materia_idx]['parciales']):
            return jsonify({'exito': False, 'mensaje': 'Parcial no válido'})
        if 'progresion' not in data:
            grupos[grupo_idx]['materias'][materia_idx]['parciales'].pop(parcial_idx)
            escribir_grupos(grupos)
            return jsonify({'exito': True})
        # Eliminar progresión
        prog_idx = data.get('progresion')
        if prog_idx is None:
            return jsonify({'exito': False, 'mensaje': 'Se requiere el índice de la progresión'})
        parcial = grupos[grupo_idx]['materias'][materia_idx]['parciales'][parcial_idx]
        if prog_idx < 0 or prog_idx >= len(parcial['progresiones']):
            return jsonify({'exito': False, 'mensaje': 'Progresión no válida'})
        parcial['progresiones'].pop(prog_idx)
        escribir_grupos(grupos)
        return jsonify({'exito': True})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/api/obtener_progresiones', methods=['GET'])
def api_obtener_progresiones():
    grupo_idx = request.args.get('grupo', type=int)
    materia_idx = request.args.get('materia', type=int)
    parcial_idx = request.args.get('parcial', type=int)
    if grupo_idx is None or materia_idx is None or parcial_idx is None:
        return jsonify({'exito': False, 'mensaje': 'Faltan parámetros'})
    try:
        grupos = leer_grupos()
        if grupo_idx < 0 or grupo_idx >= len(grupos):
            return jsonify({'exito': False, 'mensaje': 'Grupo no válido'})
        materias = grupos[grupo_idx]['materias']
        if materia_idx < 0 or materia_idx >= len(materias):
            return jsonify({'exito': False, 'mensaje': 'Materia no válida'})
        parciales = materias[materia_idx]['parciales']
        if parcial_idx < 0 or parcial_idx >= len(parciales):
            return jsonify({'exito': False, 'mensaje': 'Parcial no válido'})
        progresiones = parciales[parcial_idx]['progresiones']
        return jsonify(progresiones)
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)})

@app.route('/progresiones')
def vista_progresiones():
    """Vista para gestionar progresiones de un parcial."""
    return render_template('grupos/progresiones.html', active_page='grupos')

# ==========================================
# RUTAS DE CALIFICACIONES Y ESTADÍSTICAS (adaptadas parcialmente)
# ==========================================

# ----------------------------------------------------------
# FUNCIONES DE PERSISTENCIA DE CALIFICACIONES
# ----------------------------------------------------------

def _ruta_calificaciones():
    return os.path.join(app.root_path, 'data', 'calificaciones.json')

def leer_calificaciones():
    ruta = _ruta_calificaciones()
    if not os.path.exists(ruta):
        return {}
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def escribir_calificaciones(data):
    ruta = _ruta_calificaciones()
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ----------------------------------------------------------
# RUTAS DE CALIFICACIONES
# ----------------------------------------------------------

@app.route('/calificaciones')
def vista_calificaciones():
    # BUG CORREGIDO: se pasaban solo strings (nombres) en lugar de objetos completos.
    # El template necesita grupo.materias y parcial.nombre para generar los links.
    grupos = leer_grupos()
    return render_template('calificaciones/calificaciones_grupos.html',
                           grupos=grupos,
                           active_page='calificaciones')

@app.route('/calificaciones/<string:nombre_grupo>/<string:nombre_materia>/<string:nombre_parcial>')
def vista_tabla_calificaciones(nombre_grupo, nombre_materia, nombre_parcial):
    # BUG CORREGIDO: la URL anterior solo tenía /<nombre_grupo>, sin materia ni parcial.
    # El JS necesita context_key, nombre_grupo, nombre_materia, nombre_parcial y alumnos
    # inyectados como JSON en el tag <script id="datos-servidor">.
    # La versión anterior pasaba info_grupo/columnas/filas que el template actual no usa.
    grupos = leer_grupos()
    grupo  = next((g for g in grupos if g['nombre'] == nombre_grupo), None)
    if not grupo:
        return redirect(url_for('vista_calificaciones'))

    idx_grupo   = next((i for i, g in enumerate(grupos)            if g['nombre']  == nombre_grupo),  0)
    idx_materia = next((i for i, m in enumerate(grupo['materias']) if m['nombre']  == nombre_materia), 0)
    materia_obj = grupo['materias'][idx_materia] if grupo['materias'] else None
    idx_parcial = next(
        (i for i, p in enumerate(materia_obj['parciales']) if p['nombre'] == nombre_parcial), 0
    ) if materia_obj else 0

    context_key    = f"{idx_grupo}|{idx_materia}|{idx_parcial}"
    todas          = leer_calificaciones()
    calificaciones = todas.get(context_key, [])

    return render_template(
        'calificaciones/calificaciones.html',
        nombre_grupo=nombre_grupo,
        nombre_materia=nombre_materia,
        nombre_parcial=nombre_parcial,
        alumnos=grupo.get('alumnos', []),
        calificaciones_json=json.dumps(calificaciones, ensure_ascii=False),
        context_key=context_key,
        active_page='calificaciones'
    )

@app.route('/api/calificaciones/guardar', methods=['POST'])
def api_guardar_calificaciones():
    """Recibe calificaciones desde el JS y las persiste fusionando intentos."""
    try:
        data        = request.get_json()
        context_key = data.get('context_key', '')
        nuevas      = data.get('calificaciones', [])
        if not context_key:
            return jsonify({'success': False, 'error': 'context_key requerido'}), 400
        todas      = leer_calificaciones()
        existentes = todas.get(context_key, [])
        for nueva in nuevas:
            mat = nueva.get('matricula')
            lec = nueva.get('idLeccion')
            idx = next((i for i, e in enumerate(existentes)
                        if e.get('matricula') == mat and e.get('idLeccion') == lec), -1)
            if idx != -1:
                for ni in nueva.get('intentos', []):
                    if not any(i['numero'] == ni['numero'] for i in existentes[idx].get('intentos', [])):
                        existentes[idx].setdefault('intentos', []).append(ni)
                existentes[idx]['intentos'].sort(key=lambda i: i['numero'])
            else:
                existentes.append(nueva)
        todas[context_key] = existentes
        escribir_calificaciones(todas)
        return jsonify({'success': True, 'guardados': len(nuevas)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/calificaciones/limpiar', methods=['POST'])
def api_limpiar_calificaciones():
    """Borra todas las calificaciones de un context_key."""
    try:
        data        = request.get_json()
        context_key = data.get('context_key', '')
        if not context_key:
            return jsonify({'success': False, 'error': 'context_key requerido'}), 400
        todas = leer_calificaciones()
        todas.pop(context_key, None)
        escribir_calificaciones(todas)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/calificaciones/eliminar-alumno', methods=['POST'])
def api_eliminar_alumno_calificaciones():
    """Elimina todas las calificaciones de un alumno en un context_key específico."""
    try:
        data        = request.get_json()
        context_key = data.get('context_key', '')
        matricula   = data.get('matricula', '')
        if not context_key or not matricula:
            return jsonify({'success': False, 'error': 'context_key y matricula son requeridos'}), 400
        todas = leer_calificaciones()
        if context_key not in todas:
            return jsonify({'success': False, 'error': 'context_key no encontrado'}), 404
        antes = len(todas[context_key])
        todas[context_key] = [
            c for c in todas[context_key]
            if (c.get('matricula') or c.get('estudiante')) != matricula
        ]
        if len(todas[context_key]) == antes:
            return jsonify({'success': False, 'error': 'Alumno no encontrado'}), 404
        escribir_calificaciones(todas)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/estadisticas')
def vista_estadisticas():
    return render_template('estadisticas/estadisticas.html', active_page='estadisticas')

@app.route('/api/estadisticas/grupos')
def api_estadisticas_grupos():
    return jsonify(leer_grupos())

@app.route('/api/estadisticas/calificaciones')
def api_estadisticas_calificaciones():

    grupo = request.args.get('grupo')
    materia = request.args.get('materia')
    parcial = request.args.get('parcial')

    datos = leer_calificaciones()

    resultados = []

    numero_parcial = parcial.replace('Parcial ', '')

    def normalizar(texto):
        return (
            str(texto)
            .lower()
            .replace('á', 'a')
            .replace('é', 'e')
            .replace('í', 'i')
            .replace('ó', 'o')
            .replace('ú', 'u')
            .strip()
        )

    for contexto, registros in datos.items():

        for registro in registros:

            if (
                normalizar(registro.get('grupo')) == normalizar(grupo)
                and normalizar(registro.get('materia')) == normalizar(materia)
                and str(registro.get('parcial')) == numero_parcial
            ):
                resultados.append(registro)

    return jsonify(resultados)

ACTIVIDADES_DIR = os.path.join(app.root_path, 'data', 'actividades')

def leer_actividad(nombre_archivo):
    """Lee un archivo de actividad (JSON o texto plano) y devuelve un diccionario
       con la estructura esperada por editar-actividad.html (wizard de edición)."""
    ruta = os.path.join(ACTIVIDADES_DIR, nombre_archivo)
    if not os.path.exists(ruta):
        return None
    with open(ruta, 'r', encoding='utf-8') as f:
        contenido = f.read().strip()

    # ========== 1. INTENTAR COMO JSON ==========
    if contenido.startswith('{'):
        try:
            data = json.loads(contenido)
            tipo = data.get('tipo')
            resultado = {
                'id_actividad': data.get('id_actividad', ''),
                'nombre': data.get('nombre', 'Sin título'),
                'intentos': str(data.get('intentos', '3')),
                'tiempo': str(data.get('tiempo', '')),
                'fecha_vencimiento': data.get('fecha_vencimiento', ''),
                'ponderacion': str(data.get('ponderacion', '0')),
                'tipo': tipo,
                'preguntas': []
            }
            if tipo == 'falso-verdadero':
                resultado['preguntas'] = data.get('preguntas', [])   # [{afirmacion, respuesta}]
            elif tipo == 'opcion-multiple':
                resultado['preguntas'] = data.get('preguntas', [])   # [{afirmacion, opciones, respuesta}]
            elif tipo == 'completar-camino':
                resultado['izquierda'] = data.get('izquierda', [])
                resultado['derecha'] = data.get('derecha', [])
                resultado['respuestas'] = data.get('respuestas', {})
            elif tipo == 'sopa-letras':
                resultado['descripciones'] = data.get('descripciones', [])
                resultado['palabras'] = data.get('palabras', [])
            else:
                resultado['tipo'] = None
            return resultado
        except Exception as e:
            print(f"Error parseando JSON en {nombre_archivo}: {e}")

    # ========== 2. FORMATO ANTIGUO (TEXTO PLANO) ==========
    try:
        # Separar cabecera y cuerpo (si existe '---')
        if '---' in contenido:
            cabecera_str, cuerpo_str = contenido.split('---', 1)
        else:
            cabecera_str = contenido
            cuerpo_str = ""

        # Parsear cabeceras
        metadatos = {}
        for linea in cabecera_str.strip().split('\n'):
            if ':' in linea:
                clave, valor = linea.split(':', 1)
                metadatos[clave.strip()] = valor.strip()

        id_actividad = metadatos.get('ID_ACTIVIDAD', '')
        resultado = {
            'id_actividad': id_actividad,
            'nombre': metadatos.get('NOMBRE', 'Sin título'),
            'intentos': metadatos.get('INTENTOS', '3'),
            'tiempo': metadatos.get('TIEMPO', '').replace(' minutos', '').replace('min', '').strip(),
            'fecha_vencimiento': metadatos.get('FECHA_VENCIMIENTO', ''),
            'ponderacion': '0',
            'tipo': None,
            'preguntas': []
        }

        id_plantilla = metadatos.get('ID_PLANTILLA', '')

        # ---- Completar Camino ----
        if id_plantilla == 'C001':
            resultado['tipo'] = 'completar-camino'
            import re, ast
            izq_match = re.search(r'const izquierda\s*=\s*(\[.*?\]);', cuerpo_str, re.DOTALL)
            der_match = re.search(r'const derecha\s*=\s*(\[.*?\]);', cuerpo_str, re.DOTALL)
            res_match = re.search(r'const respuestas\s*=\s*(\{.*?\});', cuerpo_str, re.DOTALL)
            if izq_match and der_match and res_match:
                resultado['izquierda'] = ast.literal_eval(izq_match.group(1))
                resultado['derecha'] = ast.literal_eval(der_match.group(1))
                resultado['respuestas'] = ast.literal_eval(res_match.group(1))

        # ---- Falso / Verdadero (P002 o FV01) ----
        elif id_plantilla in ('P002', 'FV01'):
            resultado['tipo'] = 'falso-verdadero'
            lineas = cuerpo_str.strip().split('\n')
            pregunta_actual = None
            preguntas = []
            for linea in lineas:
                linea = linea.strip()
                if linea.startswith('Pregunta'):
                    partes = linea.split(':', 1)
                    if len(partes) == 2:
                        pregunta_actual = partes[1].strip()
                elif linea.startswith('Respuesta:') and pregunta_actual:
                    respuesta = linea.split(':', 1)[1].strip()
                    preguntas.append({'afirmacion': pregunta_actual, 'respuesta': respuesta})
                    pregunta_actual = None
            resultado['preguntas'] = preguntas

        # ---- Opción Múltiple ----
        elif id_plantilla == 'P003':
            resultado['tipo'] = 'opcion-multiple'
            lineas = cuerpo_str.strip().split('\n')
            pregunta_actual = None
            opciones_actual = None
            preguntas = []
            for linea in lineas:
                linea = linea.strip()
                if not linea:
                    continue
                if linea.startswith('Pregunta'):
                    partes = linea.split(':', 1)
                    if len(partes) == 2:
                        pregunta_actual = partes[1].strip()
                elif linea.startswith('Opciones:'):
                    opciones_str = linea.split(':', 1)[1].strip()
                    opciones_actual = [opt.strip() for opt in opciones_str.split('|') if opt.strip()]
                elif linea.startswith('Respuesta correcta:') and pregunta_actual and opciones_actual:
                    respuesta_letra = linea.split(':', 1)[1].strip().upper()
                    preguntas.append({
                        'afirmacion': pregunta_actual,
                        'opciones': opciones_actual,
                        'respuesta': respuesta_letra
                    })
                    pregunta_actual = None
                    opciones_actual = None
            resultado['preguntas'] = preguntas

        # ---- Sopa de Letras ----
        elif id_plantilla == 'P004':
            resultado['tipo'] = 'sopa-letras'
            import re, ast
            desc_match = re.search(r'const descripciones\s*=\s*(\[.*?\]);', cuerpo_str, re.DOTALL)
            pal_match = re.search(r'const palabras\s*=\s*(\[.*?\]);', cuerpo_str, re.DOTALL)
            if desc_match and pal_match:
                resultado['descripciones'] = ast.literal_eval(desc_match.group(1))
                resultado['palabras'] = ast.literal_eval(pal_match.group(1))

        # ---- Cualquier otro tipo no soportado ----
        else:
            resultado['tipo'] = None

        return resultado
    except Exception as e:
        print(f"Error leyendo formato texto en {nombre_archivo}: {e}")
        return None

@app.route('/editar_actividad/<path:nombre_archivo>', methods=['GET', 'POST'])
def editar_actividad_json(nombre_archivo):
    if request.method == 'POST':
        data = request.get_json()
        ruta = os.path.join(ACTIVIDADES_DIR, nombre_archivo)
        with open(ruta, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return jsonify({'success': True, 'ruta': ruta})
    else:
        data = leer_actividad(nombre_archivo)
        if not data:
            abort(404, "Actividad no encontrada")
        return render_template('editar-actividad.html', actividad=data, nombre_archivo=nombre_archivo)

@app.route('/editar_leccion/<carpeta>', methods=['GET', 'POST'])
def editar_leccion(carpeta):
    original_carpeta = carpeta   # antes de cualquier modificación
    if request.method == 'POST':
        # Recibir datos del formulario
        grupo = request.form.get('grupo')
        materia = request.form.get('materia')
        parcial = request.form.get('parcial')
        tema = request.form.get('tema')
        nombre_leccion = request.form.get('actividad')
        actividad_seleccionada = request.form.get('actividad_seleccionada')
        archivos_conservar_str = request.form.get('archivos_conservar', '')
        archivos_conservar = [a.strip() for a in archivos_conservar_str.split(',') if a.strip()]
        nuevos_archivos = request.files.getlist('archivos')

        # Validaciones básicas
        if not nombre_leccion or not actividad_seleccionada:
            return "Faltan datos obligatorios (nombre o actividad)", 400
        if not grupo or not materia or not parcial or not tema:
            return "Faltan datos de grupo/materia/parcial/tema", 400

        ruta_antigua = os.path.join(LECCIONES_DIR, carpeta)
        if not os.path.exists(ruta_antigua):
            return f"Error: La lección original '{carpeta}' no existe", 400

        # Ruta de la actividad seleccionada
        ruta_actividad = os.path.join(app.root_path, 'data', 'actividades', actividad_seleccionada)
        if not os.path.exists(ruta_actividad):
            return f"El archivo de actividad {actividad_seleccionada} no existe", 400

        # Parsear la actividad
        actividad_data = parsear_actividad_general(ruta_actividad)
        tipo_plantilla = actividad_data['tipo_plantilla']

        # Obtener el ID original de la lección (enviado desde el formulario)
        id_leccion_original = request.form.get('id_leccion_original', carpeta)
        id_leccion = id_leccion_original
        nombre_profesor = session.get('profesor', 'Profesor no especificado')

        # 1. Crear un directorio temporal para guardar los archivos que se conservan
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            # Copiar los archivos conservados (los que el usuario no eliminó) al temporal
            for nombre in archivos_conservar:
                origen = os.path.join(ruta_antigua, nombre)
                if os.path.exists(origen):
                    shutil.copy2(origen, os.path.join(tmpdir, nombre))

            # 2. Borrar la carpeta antigua por completo
            shutil.rmtree(ruta_antigua)

            # 3. Crear la nueva carpeta con el mismo nombre (por ahora)
            os.makedirs(ruta_antigua)

            # 4. Copiar las imágenes del juego (siempre las mismas)
            imagenes_juego = ['oak2.jpg', 'rana_quieto.png', 'rana_salto.gif']
            ruta_origen_imagenes = os.path.join(app.root_path, 'static', 'img', 'imagenesActividades')
            for img in imagenes_juego:
                origen = os.path.join(ruta_origen_imagenes, img)
                if os.path.exists(origen):
                    shutil.copy2(origen, os.path.join(ruta_antigua, img))

            # 5. Copiar de vuelta los archivos conservados desde el temporal
            for nombre in archivos_conservar:
                shutil.copy2(os.path.join(tmpdir, nombre), os.path.join(ruta_antigua, nombre))

            # 6. Guardar los nuevos archivos subidos
            for archivo in nuevos_archivos:
                if archivo and archivo.filename:
                    nombre_seguro = secure_filename(archivo.filename)
                    ruta_archivo = os.path.join(ruta_antigua, nombre_seguro)
                    archivo.save(ruta_archivo)

        # 7. Generar info_leccion.txt (similar a subir_leccion)
        metadatos = []
        metadatos.append("=== [ENTIDAD: PROFESOR] ===")
        metadatos.append(f"NOMBRE_COMPLETO: {nombre_profesor}\n")
        metadatos.append("=== [ENTIDAD: LECCIÓN] ===")
        metadatos.append(f"ID_LECCION: {id_leccion}")
        metadatos.append(f"TITULO: {nombre_leccion}")
        metadatos.append(f"TEMA: {tema}")
        metadatos.append(f"PARCIAL: {parcial}")
        metadatos.append(f"MATERIA: {materia}")
        metadatos.append(f"GRUPO: {grupo}\n")
        metadatos.append("--- [RELACIÓN: INCORPORA -> CONTENIDO MULTIMEDIA] ---")

        # Listar todos los archivos multimedia en la carpeta (excluyendo las imágenes del juego y los archivos del sistema)
        archivos_finales = []
        for f in os.listdir(ruta_antigua):
            ruta_completa = os.path.join(ruta_antigua, f)
            if (f not in imagenes_juego and 
                f not in ('info_leccion.txt', 'index.html') and 
                os.path.isfile(ruta_completa) and 
                os.path.exists(ruta_completa)):
                archivos_finales.append(f)
        for idx, arch in enumerate(archivos_finales, start=1):
            ext = os.path.splitext(arch)[1].lower()
            tipo = "Imagen"
            if ext in ['.mp4', '.webm', '.ogg']:
                tipo = "Video"
            elif ext == '.pdf':
                tipo = "PDF"
            elif ext in ['.mp3', '.wav', '.ogg']:
                tipo = "Audio"
            metadatos.append(f"CONTENIDO_{idx}: {arch} | Tipo: {tipo} | Ruta: {arch}")
        metadatos.append("")
        metadatos.append("=== [ENTIDAD: ACTIVIDAD] ===")
        metadatos.append(f"ID_ACTIVIDAD: {actividad_data['id_actividad']}")
        metadatos.append(f"NOMBRE_ACTIVIDAD: {actividad_data['nombre_actividad']}")
        metadatos.append(f"INTENTOS_MAX: {actividad_data['intentos_max']}")
        metadatos.append(f"TIEMPO_ESTIMADO: {actividad_data['tiempo_estimado']}")
        metadatos.append(f"FECHA_VENCIMIENTO: {actividad_data['fecha_vencimiento']}\n")

        # Escribir las preguntas según el tipo de plantilla
        if tipo_plantilla == 'C001':
            metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: Completar Camino] ---\n")
            for i, p in enumerate(actividad_data['preguntas'], start=1):
                metadatos.append(f"PREGUNTA_{i}: {p['texto']}")
                metadatos.append(f"RESPUESTA: {p['respuesta_correcta']}\n")
        elif tipo_plantilla in ('P002', 'FV01'):
            metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: VERDADERO O FALSO] ---\n")
            for i, p in enumerate(actividad_data['preguntas'], start=1):
                metadatos.append(f"PREGUNTA_{i}:")
                metadatos.append(f"ENUNCIADO: {p['texto']}")
                metadatos.append("TIPO: VERDADERO_FALSO")
                metadatos.append(f"RESPUESTA_CORRECTA: {p['respuesta_correcta']}\n")
        elif tipo_plantilla == 'P003':
            metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: OPCIÓN MÚLTIPLE] ---\n")
            for i, p in enumerate(actividad_data['preguntas'], start=1):
                metadatos.append(f"PREGUNTA_{i}:")
                metadatos.append(f"ENUNCIADO: {p['texto']}")
                metadatos.append(f"OPCIONES: {' | '.join(p['opciones'])}")
                metadatos.append(f"RESPUESTA_CORRECTA: {p['respuesta_correcta']}\n")
        elif tipo_plantilla == 'P004':
            metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: SOPA DE LETRAS] ---\n")
            for i, p in enumerate(actividad_data['preguntas'], start=1):
                metadatos.append(f"PALABRA_{i}: {p['palabra']}")
                metadatos.append(f"DESCRIPCIÓN_{i}: {p['texto']}\n")
        else:
            metadatos.append("--- [RELACIÓN: GENERA <- PLANTILLA: DESCONOCIDA] ---\n")

        ruta_metadatos = os.path.join(ruta_antigua, 'info_leccion.txt')
        with open(ruta_metadatos, 'w', encoding='utf-8') as f:
            f.write('\n'.join(metadatos))

        # 8. Generar index.html
        if tipo_plantilla == 'C001':
            plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion.html')
            datos_act = extraer_datos_actividad(ruta_actividad)
        elif tipo_plantilla == 'P002':
            plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_fv.html')
            datos_act = None
        elif tipo_plantilla == 'P003':
            plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_opcion_multiple.html')
            datos_act = None
        elif tipo_plantilla == 'P004':
            plantilla_path = os.path.join(app.root_path, 'templates', 'plantilla_leccion_sopa.html')
            datos_act = None
        else:
            return f"Tipo de actividad no soportado: {tipo_plantilla}", 400

        html_multimedia = generar_html_multimedia(archivos_finales)

        with open(plantilla_path, 'r', encoding='utf-8') as f:
            plantilla_html = f.read()

        html_final = plantilla_html.replace('{{ ARCHIVOS_MULTIMEDIA }}', html_multimedia)
        html_final = html_final.replace('{{ titulo_leccion }}', nombre_leccion)
        html_final = html_final.replace('{{ tema }}', tema)

        if tipo_plantilla == 'C001' and datos_act:
            html_final = html_final.replace('{{ IZQUIERDA_ARRAY }}', datos_act['izquierda'])
            html_final = html_final.replace('{{ DERECHA_ARRAY }}', datos_act['derecha'])
            html_final = html_final.replace('{{ RESPUESTAS_OBJ }}', datos_act['respuestas'])
        elif tipo_plantilla == 'P002':
            preguntas_html = ""
            for idx, p in enumerate(actividad_data['preguntas'], 1):
                preguntas_html += f'''
        <div class="question-card">
            <h3>{idx}. {p['texto']}</h3>
            <label><input type="radio" name="p{idx}" value="v"> Verdadero</label><br><br>
            <label><input type="radio" name="p{idx}" value="f"> Falso</label>
        </div>
        '''
            html_final = html_final.replace('{{ PREGUNTAS_HTML }}', preguntas_html)
        elif tipo_plantilla == 'P003':
            preguntas_html = ""
            for idx, p in enumerate(actividad_data['preguntas'], 1):
                opciones_html = ""
                letras = ['A', 'B', 'C', 'D']
                for opt_idx, opt_texto in enumerate(p['opciones']):
                    letra = letras[opt_idx] if opt_idx < len(letras) else str(opt_idx+1)
                    opciones_html += f'<label class="opcion"><input type="radio" name="p{idx}" value="{letra}"> {opt_texto}</label><br>'
                preguntas_html += f'''
        <div class="question-card">
            <h3>{idx}. {p['texto']}</h3>
            {opciones_html}
        </div>
        '''
            html_final = html_final.replace('{{ PREGUNTAS_HTML }}', preguntas_html)
        elif tipo_plantilla == 'P004':
            preguntas_json = []
            for p in actividad_data['preguntas']:
                preguntas_json.append({'palabra': p['palabra'], 'texto': p['texto']})
            preguntas_json_str = json.dumps(preguntas_json, ensure_ascii=False)
            html_final = html_final.replace('{{ PREGUNTAS_JSON }}', preguntas_json_str)

        ruta_html = os.path.join(ruta_antigua, 'index.html')
        with open(ruta_html, 'w', encoding='utf-8') as f:
            f.write(html_final)

        nuevo_nombre_carpeta = f"{grupo}_{materia}_{parcial}_{tema}_{nombre_leccion}"
        nuevo_nombre_carpeta = nuevo_nombre_carpeta.replace(' ', '_')
        if nuevo_nombre_carpeta != carpeta:
            ruta_nueva = os.path.join(LECCIONES_DIR, nuevo_nombre_carpeta)
            if os.path.exists(ruta_nueva):
                # Si ya existe, no renombramos (podría sobrescribir datos)
                print(f"⚠️ No se renombró la carpeta porque '{nuevo_nombre_carpeta}' ya existe.")
                ruta_nueva = ruta_antigua  # nos quedamos con la antigua
            else:
                os.rename(ruta_antigua, ruta_nueva)
                ruta_antigua = ruta_nueva
                carpeta = nuevo_nombre_carpeta
                print(f"✅ Carpeta renombrada a: {carpeta}")
        else:
            ruta_nueva = ruta_antigua

        # Ahora escribimos los archivos en la carpeta definitiva (ruta_antigua)
        ruta_metadatos = os.path.join(ruta_antigua, 'info_leccion.txt')
        with open(ruta_metadatos, 'w', encoding='utf-8') as f:
            f.write('\n'.join(metadatos))

        ruta_html = os.path.join(ruta_antigua, 'index.html')
        with open(ruta_html, 'w', encoding='utf-8') as f:
            f.write(html_final)

        # 9. Eliminar el ZIP antiguo (si existe) y generar uno nuevo
        def ofuscar_reporte(texto: str) -> str:
            firma = str(len(texto) * 77)
            texto_con_firma = texto + "||" + firma
            texto_modificado = "".join(chr(ord(c) + 3) for c in texto_con_firma)
            encoded_bytes = texto_modificado.encode("utf-8")
            return base64.b64encode(encoded_bytes).decode("ascii")

        ruta_zip_destino = os.path.join(app.root_path, 'data', 'LECCIONES-LISTAS-PARA-ENVIAR')
        os.makedirs(ruta_zip_destino, exist_ok=True)
        old_zip = os.path.join(ruta_zip_destino, original_carpeta + ".zip")
        if os.path.exists(old_zip):
            os.remove(old_zip)
            print(f"🗑️ ZIP antiguo eliminado: {old_zip}")

        nombre_zip = carpeta + ".zip"   # 'carpeta' ya se actualizó si hubo renombrado
        ruta_zip = os.path.join(ruta_zip_destino, nombre_zip)

        with zipfile.ZipFile(ruta_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            with open(ruta_metadatos, 'r', encoding='utf-8') as f:
                texto_original = f.read()
            texto_ofuscado = ofuscar_reporte(texto_original)
            zf.writestr("info_leccion.txt", texto_ofuscado)
            zf.write(ruta_html, "index.html")
            for archivo in archivos_finales:
                ruta_archivo_fisico = os.path.join(ruta_antigua, archivo)
                if os.path.isfile(ruta_archivo_fisico):
                    zf.write(ruta_archivo_fisico, archivo)

        return redirect(url_for('vista_contenido'))

    else:   # GET
        info = obtener_info_leccion(carpeta)
        if not info:
            abort(404, "Lección no encontrada")
        actividades = cargar_actividades()
        return render_template('editar_leccion.html', leccion=info, actividades=actividades, carpeta=carpeta, active_page='contenido')

@app.route('/eliminar_leccion/<carpeta>')
def eliminar_leccion(carpeta):
    # 1. Eliminar la carpeta de la lección en LECCIONES DISPONIBLES
    ruta_carpeta = os.path.join(LECCIONES_DIR, carpeta)
    if os.path.exists(ruta_carpeta):
        shutil.rmtree(ruta_carpeta)
        print(f"🗑️ Carpeta de lección eliminada: {ruta_carpeta}")
    else:
        print(f"⚠️ La carpeta {ruta_carpeta} no existe")

    # 2. Eliminar el ZIP correspondiente en LECCIONES-LISTAS-PARA-ENVIAR
    ruta_zip = os.path.join(app.root_path, 'data', 'LECCIONES-LISTAS-PARA-ENVIAR', carpeta + '.zip')
    if os.path.exists(ruta_zip):
        os.remove(ruta_zip)
        print(f"🗑️ ZIP eliminado: {ruta_zip}")
    else:
        print(f"⚠️ El ZIP {ruta_zip} no existe")

    return redirect(url_for('vista_contenido'))
# NOTA: Las rutas de progresiones, api/lecciones_disponibles, api/asignar_leccion no se incluyen aquí.
# Si las necesitas, deberás adaptarlas al nuevo sistema.

# ==========================================
# PUNTO DE ENTRADA
# ==========================================
if __name__ == '__main__':
    app.run(debug=True)