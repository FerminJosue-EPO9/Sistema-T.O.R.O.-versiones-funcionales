// ==================== CONSTANTES Y VARIABLES GLOBALES ====================
const MAX_INTENTOS = 3;

// Datos inyectados por Flask desde el servidor
const _datosServidor = JSON.parse(
    document.getElementById('datos-servidor').textContent
);

const CONTEXT_KEY      = _datosServidor.context_key;
const NOMBRE_GRUPO     = _datosServidor.nombre_grupo;
const NOMBRE_MATERIA   = _datosServidor.nombre_materia;
const NOMBRE_PARCIAL   = _datosServidor.nombre_parcial;
const ALUMNOS_GRUPO    = _datosServidor.alumnos;       // [{matricula, nombres, apellidos}, ...]
let   calificacionesServer = _datosServidor.calificaciones; // array persistido en JSON del servidor

let archivosProcesadosTemp = [];

// ==================== INICIALIZACIÓN ====================

window.addEventListener('DOMContentLoaded', () => {
    verificarYMostrarInterfaz();
});

// ==================== INTERFAZ PRINCIPAL ====================

function verificarYMostrarInterfaz() {
    const main = document.getElementById('contenidoPrincipal');
    if (!main) return;

    const calificaciones = calificacionesServer;

    const breadcrumb = `
        <nav class="breadcrumb-contexto">
            Calificaciones &rsaquo; Grupos &rsaquo; ${escapeHtml(NOMBRE_GRUPO)}
            &rsaquo; ${escapeHtml(NOMBRE_MATERIA)}
            &rsaquo; ${escapeHtml(NOMBRE_PARCIAL)}
        </nav>`;

    const btnRegresar = `
        <button class="btn-volver" onclick="regresarAGrupos()">
            &#8592; Volver a Grupos
        </button>`;

    if (!calificaciones || calificaciones.length === 0) {
        // ── Vista sin archivos ──────────────────────────────────────────────
        main.innerHTML = `
            ${breadcrumb}
            <div class="header-row">
                <h1 class="card-title">${escapeHtml(NOMBRE_MATERIA)}</h1>
                ${btnRegresar}
            </div>

            <div class="upload-zona-central">
                <p class="empty-message">Aún no hay archivos cargados.</p>
                <p class="empty-submessage">Sube los archivos .TORO para ver las calificaciones.</p>

                <button class="btn-txt" id="btnCargarArchivos">
                    <span id="labelArchivos">Cargar respuestas de Alumnos (.TORO)</span>
                    &#x2B06;
                </button>
                <input type="file" id="fileInput" class="file-input" accept=".toro,.TORO" multiple style="display:none;">

                <p class="empty-message">Los archivos que se subirán aquí corresponden a los</p>
                <p class="empty-submessage">creados y enviados por los alumnos (.TORO)</p>

                <div id="fileListContainer" style="display:none; width:100%; max-width:520px;">
                    <h3 class="file-list-title">Archivos procesados:</h3>
                    <div id="previewArchivos"></div>
                    <button class="btn-save" id="saveBtn" style="display:none; margin-top:16px; width:100%;">Guardar calificaciones</button>
                </div>
            </div>

            ${_modalErrorHTML()}
        `;
        configurarEventosSubida();

    } else {
        // ── Vista con datos ─────────────────────────────────────────────────
        main.innerHTML = `
            ${breadcrumb}
            <div class="header-row">
                <h1 class="card-title">${escapeHtml(NOMBRE_MATERIA)}</h1>
                ${btnRegresar}
            </div>

            <div class="tabla-container">
                ${generarTablaCalificaciones(calificaciones)}
            </div>

            <div class="upload-area upload-area--inline">
                <p class="empty-submessage">
                    Sube los archivos .TORO de las nuevas lecciones para actualizar calificaciones.
                </p>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <button class="btn-txt" id="btnAgregarArchivos">
                        Cargar archivos (.TORO) &#x2B06;
                    </button>
                    <button class="btn-save" id="saveBtn" style="display:none;">Guardar</button>
                    <button class="btn-secundario btn-danger" id="btnLimpiarContexto">
                        Limpiar calificaciones
                    </button>
                </div>
                <input type="file" id="fileInput" accept=".toro,.TORO" multiple style="display:none;">
                <div id="previewArchivos"></div>
            </div>

            ${_modalErrorHTML()}
        `;
        configurarEventosConDatos();
    }
}

// ==================== TABLA DINÁMICA POR LECCIONES ====================

function generarTablaCalificaciones(calificaciones) {
    if (!calificaciones || calificaciones.length === 0) {
        return `<p class="empty-message">No hay datos que mostrar.</p>`;
    }

    // 1. Descubrir estructura global: progresiones → lecciones
    const progMap     = new Map();
    const leccionMeta = new Map();

    calificaciones.forEach(c => {
        const prog = c.progresion?.trim() || '(Sin progresión)';
        const lec  = c.idLeccion;
        if (!leccionMeta.has(lec)) {
            leccionMeta.set(lec, { progresion: prog, actividad: c.actividad?.trim() || lec });
        }
        if (!progMap.has(prog)) progMap.set(prog, []);
        if (!progMap.get(prog).includes(lec)) progMap.get(prog).push(lec);
    });

    const leccionesOrdenadas = [];
    progMap.forEach(lecs => lecs.forEach(l => leccionesOrdenadas.push(l)));

    // 2. Agrupar por alumno
    const alumnosMap = new Map();
    calificaciones.forEach(c => {
        const key = c.matricula || c.estudiante;
        if (!alumnosMap.has(key)) {
            alumnosMap.set(key, { nombre: c.estudiante, matricula: c.matricula, lecciones: {} });
        }
        alumnosMap.get(key).lecciones[c.idLeccion] = c;
    });

    // 3. Encabezado — Fila 1
    let tr1 = `
        <th rowspan="2" class="th-alumno">Nombre del Alumno</th>
        <th rowspan="2" class="th-leccion-fija">Lección</th>
    `;
    progMap.forEach((lecs, prog) => {
        const cs = lecs.length * 3;
        tr1 += `<th colspan="${cs}" class="th-leccion-header">${escapeHtml(prog)}</th>`;
    });
    tr1 += `
        <th rowspan="2" class="th-promedio-general">
            <div class="promedio-header-wrap">
                Promedio
                <button class="btn-tooltip-promedio" id="btnTooltipPromedio"
                        onclick="toggleTooltipPromedio(event)" type="button">?</button>
            </div>
        </th>
`;

    // Fila 2 — intentos por lección
    let tr2 = '';
    leccionesOrdenadas.forEach(lec => {
        const meta = leccionMeta.get(lec);
        tr2 += `
            <th class="th-sub th-intento" title="${escapeHtml(meta?.actividad || lec)}">Int. 1</th>
            <th class="th-sub th-intento" title="${escapeHtml(meta?.actividad || lec)}">Int. 2</th>
            <th class="th-sub th-intento" title="${escapeHtml(meta?.actividad || lec)}">Int. 3</th>
        `;
    });

    // 4. Filas de datos
    let tbody = '';
    alumnosMap.forEach(alumno => {
        const leccionesAlumno = leccionesOrdenadas.filter(lec => alumno.lecciones[lec]);
        const numFilas = leccionesAlumno.length || 1;
        const promGeneral = calcularPromedioGeneral(alumno.lecciones, leccionesOrdenadas);
        const promTexto   = promGeneral !== null ? promGeneral.toFixed(1) : '—';
        const promClase   = _claseNota(promGeneral);

        leccionesAlumno.forEach((lecActual, idx) => {
            let tr = '<tr>';
            if (idx === 0) {
                tr += `
                    <td rowspan="${numFilas}" class="td-alumno">
                        <strong>${escapeHtml(alumno.nombre)}</strong>
                        ${alumno.matricula
                            ? `<br><span class="matricula-small">${escapeHtml(alumno.matricula)}</span>`
                            : ''}
                    </td>`;
            }
            tr += `<td class="td-leccion">${escapeHtml(lecActual)}</td>`;

            leccionesOrdenadas.forEach(lec => {
                const reg = (lec === lecActual) ? alumno.lecciones[lec] : null;
                if (!reg) {
                    tr += `<td class="td-intento td-vacio">—</td>
                           <td class="td-intento td-vacio">—</td>
                           <td class="td-intento td-vacio">—</td>`;
                    return;
                }
                const i1 = reg.intentos.find(i => i.numero === 1);
                const i2 = reg.intentos.find(i => i.numero === 2);
                const i3 = reg.intentos.find(i => i.numero === 3);
                tr += `
                    <td class="td-intento ${_claseNota(i1?.calificacion)}">${i1 !== undefined ? i1.calificacion.toFixed(1) : '—'}</td>
                    <td class="td-intento ${_claseNota(i2?.calificacion)}">${i2 !== undefined ? i2.calificacion.toFixed(1) : '—'}</td>
                    <td class="td-intento ${_claseNota(i3?.calificacion)}">${i3 !== undefined ? i3.calificacion.toFixed(1) : '—'}</td>`;
            });

            if (idx === 0) {
                tr += `<td rowspan="${numFilas}" class="td-promedio-general ${promClase}">
                           <strong>${escapeHtml(promTexto)}</strong>
                       </td>`;
            }
            tr += '</tr>';
            tbody += tr;
        });

        // Alumno sin ninguna lección registrada
        if (leccionesAlumno.length === 0) {
            let tr = `<tr>
                <td class="td-alumno">
                    <strong>${escapeHtml(alumno.nombre)}</strong>
                    ${alumno.matricula ? `<br><span class="matricula-small">${escapeHtml(alumno.matricula)}</span>` : ''}
                </td>
                <td class="td-leccion td-vacio">—</td>`;
            leccionesOrdenadas.forEach(() => {
                tr += `<td class="td-intento td-vacio">—</td>
                       <td class="td-intento td-vacio">—</td>
                       <td class="td-intento td-vacio">—</td>`;
            });
            tr += `<td class="td-promedio-general">—</td></tr>`;
            tbody += tr;
        }
    });

    return `
        <div class="table-scroll">
            <table class="calificaciones-table">
                <thead>
                    <tr>${tr1}</tr>
                    <tr>${tr2}</tr>
                </thead>
                <tbody>${tbody}</tbody>
            </table>
        </div>
    `;
}

// ==================== CÁLCULO DE PROMEDIO ====================

function calcularPromedioGeneral(leccionesDelAlumno, leccionesOrdenadas) {
    const ultimosPorLeccion = [];
    leccionesOrdenadas.forEach(lec => {
        const reg = leccionesDelAlumno[lec];
        if (!reg || !reg.intentos?.length) return;
        const ultimo = [...reg.intentos]
            .filter(i => i.numero <= MAX_INTENTOS)
            .sort((a, b) => b.numero - a.numero)[0];
        if (ultimo) ultimosPorLeccion.push(ultimo.calificacion);
    });
    if (!ultimosPorLeccion.length) return null;
    return ultimosPorLeccion.reduce((acc, v) => acc + v, 0) / ultimosPorLeccion.length;
}

function _claseNota(val) {
    if (val === undefined || val === null) return '';
    if (val < 6)  return 'nota-baja';
    if (val >= 9) return 'nota-alta';
    return 'nota-media';
}

// ==================== TOOLTIP PROMEDIO ====================

function toggleTooltipPromedio(e) {
    e.stopPropagation();
    const btn = document.getElementById('btnTooltipPromedio');
    if (!btn) return;
    let box = document.getElementById('tooltipPromedioBox');
    if (!box) {
        box = document.createElement('div');
        box.id = 'tooltipPromedioBox';
        box.className = 'tooltip-promedio-box';
        box.textContent = 'El promedio se calcula con la calificación del último intento de cada actividad.';
        document.body.appendChild(box);
    }
    if (box.classList.contains('visible')) { box.classList.remove('visible'); return; }
    const rect = btn.getBoundingClientRect();
    box.style.position  = 'fixed';
    box.style.zIndex    = '9999';
    box.style.top       = (rect.top - 8) + 'px';
    box.style.left      = Math.max(8, rect.right - 220) + 'px';
    box.style.transform = 'translateY(-100%)';
    box.classList.add('visible');
}
document.addEventListener('click', () => {
    const box = document.getElementById('tooltipPromedioBox');
    if (box) box.classList.remove('visible');
});

// ==================== EVENTOS ====================

function configurarEventosSubida() {
    const btnCargar         = document.getElementById('btnCargarArchivos');
    const fileInput         = document.getElementById('fileInput');
    const saveBtn           = document.getElementById('saveBtn');
    const fileListContainer = document.getElementById('fileListContainer');
    const labelArchivos     = document.getElementById('labelArchivos');

    btnCargar?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const cantidad = files.length;
        if (labelArchivos) labelArchivos.textContent = `${cantidad} archivo${cantidad > 1 ? 's' : ''} cargado${cantidad > 1 ? 's' : ''}`;
        const procesados = await procesarArchivos(files);
        if (procesados) {
            fileListContainer.style.display = 'block';
            saveBtn.style.display = 'inline-block';
        }
        e.target.value = '';
    });
    saveBtn?.addEventListener('click', guardarCalificaciones);
}

function configurarEventosConDatos() {
    const btnAgregar = document.getElementById('btnAgregarArchivos');
    const btnLimpiar = document.getElementById('btnLimpiarContexto');
    const saveBtn    = document.getElementById('saveBtn');
    let   fileInput  = document.getElementById('fileInput');

    const nuevoInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(nuevoInput, fileInput);
    fileInput = nuevoInput;

    btnAgregar?.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const procesados = await procesarArchivos(files);
        if (procesados && saveBtn) saveBtn.style.display = 'inline-block';
        e.target.value = '';
    });
    saveBtn?.addEventListener('click', guardarCalificaciones);
    btnLimpiar?.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de limpiar TODAS las calificaciones de este parcial? Esta acción no se puede deshacer.')) return;
        try {
            const resp = await fetch('/api/calificaciones/limpiar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context_key: CONTEXT_KEY })
            });
            const json = await resp.json();
            if (json.success) {
                calificacionesServer = [];
                archivosProcesadosTemp = [];
                verificarYMostrarInterfaz();
            } else {
                mostrarMensaje('Error al limpiar: ' + json.error, true);
            }
        } catch (err) {
            mostrarMensaje('Error de conexión al limpiar', true);
        }
    });
}

// ==================== PROCESAMIENTO DE ARCHIVOS ====================

async function procesarArchivos(files) {
    const archivosParseados = [];
    let hayError = false;

    // Número de parcial esperado (1-based, según contexto Flask)
    const parcialEsperadoNum = (() => {
        const m = NOMBRE_PARCIAL.match(/\d+/);
        return m ? parseInt(m[0]) : null;
    })();

    // Normaliza texto: quita acentos y pasa a minúsculas para comparar
    const norm = str => str
        ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
        : '';

    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'toro') {
            mostrarMensaje(`✗ ${file.name}: extensión inválida (se esperaba .TORO)`, true, 5000);
            hayError = true; continue;
        }
        try {
            const contenidoRaw = await readFileAsText(file);
            if (!contenidoRaw?.trim()) {
                mostrarMensaje(`✗ ${file.name}: archivo vacío`, true, 5000);
                hayError = true; continue;
            }

            const datos = parsearArchivoOfuscado(contenidoRaw, file.name);

            // 1. Matrícula y nombre obligatorios
            if (!datos.matricula || !datos.estudiante) {
                mostrarMensaje(`✗ ${file.name}: faltan datos del alumno (matrícula o nombre)`, true, 5000);
                hayError = true; continue;
            }

            // 2. Validar que el alumno pertenece al grupo (por matrícula)
            const enGrupo = ALUMNOS_GRUPO.some(
                a => a.matricula.trim() === datos.matricula.trim()
            );
            if (!enGrupo) {
                mostrarMensaje(
                    `✗ ${file.name}: la matrícula "${datos.matricula}" no pertenece al grupo "${NOMBRE_GRUPO}"`,
                    true, 6000
                );
                hayError = true; continue;
            }

            // 3. Validar que la materia del archivo coincide con la materia del contexto
            if (datos.materia && norm(datos.materia) !== norm(NOMBRE_MATERIA)) {
                mostrarMensaje(
                    `✗ ${file.name}: materia incorrecta — archivo: "${datos.materia}", esperado: "${NOMBRE_MATERIA}"`,
                    true, 6000
                );
                hayError = true; continue;
            }

            // 4. Validar que el parcial del archivo coincide con el parcial del contexto
            if (datos.parcial !== null && datos.parcial !== undefined) {
                const parcialArchivo = parseInt(datos.parcial);
                if (!isNaN(parcialArchivo) && parcialEsperadoNum !== null &&
                    parcialArchivo !== parcialEsperadoNum) {
                    mostrarMensaje(
                        `✗ ${file.name}: parcial incorrecto — archivo: Parcial ${parcialArchivo}, esperado: ${NOMBRE_PARCIAL}`,
                        true, 6000
                    );
                    hayError = true; continue;
                }
            }

            archivosParseados.push(datos);
        } catch (err) {
            hayError = true;
            if (err.message?.startsWith('MANIPULADO')) {
                mostrarMensaje(`⚠ ${file.name}: archivo manipulado — calificaciones no confiables`, true, 6000);
            } else if (err.message?.startsWith('CORRUPTO')) {
                mostrarMensaje(`✗ ${file.name}: archivo corrupto o con formato inválido`, true, 5000);
            } else {
                mostrarMensaje(`✗ ${file.name}: error al procesar`, true, 5000);
            }
        }
    }

    if (archivosParseados.length > 0) {
        archivosProcesadosTemp.push(...archivosParseados);
        mostrarPreview(archivosProcesadosTemp);
        mostrarMensaje(`✓ ${archivosParseados.length} archivo(s) procesado(s) correctamente`, false);
        return true;
    }
    return false;
}

async function guardarCalificaciones() {
    if (archivosProcesadosTemp.length === 0) return;
    try {
        const resp = await fetch('/api/calificaciones/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_key: CONTEXT_KEY, calificaciones: archivosProcesadosTemp })
        });
        const json = await resp.json();
        if (json.success) {
            mostrarMensaje('Calificaciones guardadas con éxito', false);
            // Recargar la página para mostrar los datos actualizados desde el servidor
            setTimeout(() => location.reload(), 800);
        } else {
            mostrarMensaje('Error al guardar: ' + json.error, true);
        }
    } catch (err) {
        mostrarMensaje('Error de conexión al guardar', true);
    }
}

function mostrarPreview(archivos) {
    const previewDiv = document.getElementById('previewArchivos');
    if (!previewDiv) return;
    let html = '<ul class="file-list">';
    archivos.forEach(a => {
        html += `<li>
            <strong>${escapeHtml(a.nombreArchivo)}</strong><br>
            Alumno: ${escapeHtml(a.estudiante || 'N/A')} |
            Matrícula: ${escapeHtml(a.matricula || 'N/A')} |
            Intentos: ${a.intentos.length}/${MAX_INTENTOS}
        </li>`;
    });
    html += '</ul>';
    previewDiv.innerHTML = html;
}

// ==================== DESOFUSCADO ====================

function desofuscarReporte(base64) {
    let bytes;
    try {
        const binStr = atob(base64.trim());
        bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
    } catch {
        throw new Error('CORRUPTO: el archivo no es Base64 válido.');
    }
    let textoDesplazado;
    try {
        textoDesplazado = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        throw new Error('CORRUPTO: los bytes no son UTF-8 válido.');
    }
    const textoOriginal = textoDesplazado
        .split('')
        .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
        .join('');
    const partes = textoOriginal.split('||');
    if (partes.length < 2) throw new Error('INVALIDO: formato de archivo no reconocido.');
    const contenido     = partes[0];
    const firmaRecibida = partes[1].trim();
    const firmaCalculada = (contenido.length * 77).toString();
    if (firmaRecibida !== firmaCalculada) throw new Error('MANIPULADO: las firmas no coinciden.');
    return contenido;
}

function parsearArchivoOfuscado(contenidoRaw, nombreArchivo) {
    const contenido = desofuscarReporte(contenidoRaw);
    const datos = {
        nombreArchivo,
        idLeccion: null, grupo: null, materia: null,
        parcial: null, progresion: null, actividad: null,
        estudiante: null, matricula: null,
        intentos: [], promedioFinal: null
    };
    const patrones = {
        // Acepta tanto "ID_LECCION:" (formato antiguo) como "LECCIÓN:" / "LECCION:" (formato alumno)
        idLeccion:     /(?:ID_LECCI[OÓ]N|LECCI[OÓ]N):\s*(\S+)/i,
        grupo:         /GRUPO:\s*([^\n\r]+)/i,
        materia:       /MATERIA:\s*([^\n\r]+)/i,
        parcial:       /PARCIAL:\s*(\d+)/i,
        // Acepta "PROGRESION:" y "PROGRESIÓN:" (con o sin tilde)
        progresion:    /PROGRESI[OÓ]N:\s*([^\n\r]+)/i,
        actividad:     /ACTIVIDAD:\s*([^\n\r]+)/i,
        estudiante:    /ESTUDIANTE:\s*([^\n\r]+)/i,
        // Acepta "MATRICULA:" y "MATRÍCULA:" (con o sin tilde), valor alfanumérico
        matricula:     /MATR[IÍ]CULA:\s*(\S+)/i,
        promedioFinal: /PROMEDIO FINAL:\s*([\d.]+)/i
    };
    for (const [key, patron] of Object.entries(patrones)) {
        const m = contenido.match(patron);
        if (m) datos[key] = m[1].trim();
    }
    const patronIntento = /Intento\s+(\d+):\s+([\d.]+)\/10/g;
    let m;
    while ((m = patronIntento.exec(contenido)) !== null) {
        datos.intentos.push({ numero: parseInt(m[1]), calificacion: parseFloat(m[2]), fecha: new Date().toLocaleString() });
    }
    datos.intentos.sort((a, b) => a.numero - b.numero);
    return datos;
}

// ==================== MODAL DE ERROR ====================

function _modalErrorHTML() {
    return ''; // Las alertas ahora son toasts flotantes
}

function mostrarModalError() {
    mostrarMensaje('Uno o más archivos fueron rechazados: archivo vacío, manipulado, materia/parcial incorrectos, o alumno que no pertenece al grupo.', true, 6000);
}
function cerrarModalError() { /* ya no se usa, los toasts se cierran solos */ }

function regresarAGrupos() {
    window.location.href = '/calificaciones';
}

// ==================== AUXILIARES ====================

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const bytes = new Uint8Array(e.target.result);
            let str = '';
            for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
            resolve(str.trim());
        };
        reader.onerror = e => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

function mostrarMensaje(texto, esError = false, duracion = 3800) {
    // Contenedor de toasts (esquina superior derecha)
    let contenedor = document.getElementById('toast-contenedor');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-contenedor';
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-card ' + (esError ? 'toast-error' : 'toast-exito');

    const icono = esError
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';

    toast.innerHTML = `
        <div class="toast-icono">${icono}</div>
        <span class="toast-texto">${escapeHtml(texto)}</span>
        <button class="toast-cerrar" onclick="this.closest('.toast-card').remove()">&#x2715;</button>
    `;

    contenedor.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-cierre
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-saliendo');
        setTimeout(() => toast.remove(), 350);
    }, duracion);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m =>
        m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'
    );
}