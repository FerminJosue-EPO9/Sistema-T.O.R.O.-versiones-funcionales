// ══════════════════════════════════════════════════════════
//  GRUPOS.JS — Conectado al backend Flask (/api/...)
//  Sin localStorage, sin prompt(), sin confirm()
//  Todos los inputs y confirmaciones usan modales propios
// ══════════════════════════════════════════════════════════

// ── Variables de estado ──
let archivoValidado   = false;
let datosAlumnos      = null;

let grupoMateriaTarget   = null;  // { idxGrupo }
let gruposCache = [];
let editarMateriaTarget  = null;  // { idxGrupo, idxMateria }
let accionEliminar       = null;  // función a ejecutar al confirmar eliminación

let parcialTarget        = null;  // { idxGrupo, idxMateria }
let editarParcialTarget  = null;  // { idxGrupo, idxMateria, idxParcial }
let editarGrupoTarget = null;  // { idxGrupo }

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    const inputArchivo = document.getElementById("archivoAlumnos");
    if (inputArchivo) inputArchivo.addEventListener("change", validarArchivo);

    actualizarBreadcrumb(["Grupos"]);
    cargarYElegirSeccion();
});

// ══════════════════════════════════════════════════════════
//  CARGA Y SECCIÓN
// ══════════════════════════════════════════════════════════
function cargarYElegirSeccion() {
    fetch("/api/grupos")
        .then(r => r.json())
        .then(grupos => {
            gruposCache = grupos || [];

            if (!grupos || grupos.length === 0) {
                mostrarSeccion("seccionDefault");
                document.getElementById("listaGrupos").innerHTML = "";
            } else {
                renderizarGrupos(grupos);
                mostrarSeccion("mostrarGrupos");
            }
        })
        .catch(() => mostrarSeccion("seccionDefault"));
}

function mostrarSeccion(id) {
    document.querySelectorAll(".seccion").forEach(s => s.classList.remove("activa"));
    const sec = document.getElementById(id);
    if (sec) sec.classList.add("activa");
}

function actualizarBreadcrumb(ruta) {
    const bc = document.getElementById("breadcrumbTexto");
    if (!bc) return;

    bc.innerHTML = ruta.join(" > ");
}

// ══════════════════════════════════════════════════════════
//  MODAL NUEVO GRUPO
// ══════════════════════════════════════════════════════════
function abrirModal() {
    limpiarModalGrupo();
    actualizarBreadcrumb(["Grupos", "Crear grupo"]);   
    _abrirModal("modalNuevoGrupo");
}

function cerrarModal() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalNuevoGrupo");
    limpiarModalGrupo();
}

function limpiarModalGrupo() {
    const n = document.getElementById("nombreGrupo");
    const a = document.getElementById("archivoAlumnos");
    const btn = document.getElementById("btnGuardarGrupo");
    
    if (n) n.value = "";
    if (a) a.value = "";
    if (btn) btn.disabled = true;
    archivoValidado = false;
    datosAlumnos    = null;
    mostrarMensajeModal("", "");
}

// ── Validar archivo al seleccionarlo ──
function validarArchivo(event) {
    const archivo = event.target.files[0];
    if (!archivo) {
        archivoValidado = false;
        datosAlumnos    = null;
        mostrarMensajeModal("", "");
        return;
    }

    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result.replace(/\r/g, "").trim();
        if (!contenido) {
            mostrarMensajeModal("El archivo está vacío.", "error");
            archivoValidado = false;
            datosAlumnos    = null;
            return;
        }
        const lineas = contenido.split("\n").filter(l => l.trim() !== "");
        const temp   = [];
        for (let i = 0; i < lineas.length; i++) {
            const partes = lineas[i].split("|");
            if (partes.length !== 3) {
                mostrarMensajeModal(`Error en línea ${i+1}: debe tener 3 campos separados por "|".`, "error");
                archivoValidado = false;
                datosAlumnos    = null;
                return;
            }
            const [matricula, nombres, apellidos] = partes.map(p => p.trim());
            if (!matricula || !nombres || !apellidos) {
                mostrarMensajeModal(`Error en línea ${i+1}: ningún campo puede estar vacío.`, "error");
                archivoValidado = false;
                datosAlumnos    = null;
                return;
            }
            temp.push({ matricula, nombres, apellidos });
        }
        mostrarMensajeModal(`Archivo válido. ${temp.length} alumnos cargados.`, "exito");
        archivoValidado = true;
        datosAlumnos    = temp;
    };
    lector.readAsText(archivo, "UTF-8");
}

function mostrarMensajeModal(texto, tipo) {
    const div = document.getElementById("mensajeModal");
    const btn = document.getElementById("btnGuardarGrupo");

    if (btn) btn.disabled = tipo !== "exito";
    if (!div) return;

    if (!texto) {
        div.style.display = "none";
        div.className = "aviso-archivo";
        div.innerHTML = "";

        if (btn) btn.disabled = true;
        return;
    }

    div.style.display = "flex";
    div.className = "aviso-archivo " + tipo;

    if (tipo === "exito") {
        div.innerHTML = `
            <div class="aviso-icono">✓</div>
            <div class="aviso-texto">
                Archivo leído correctamente, oprima guardar grupo.
            </div>
        `;
    }

    if (tipo === "error") {
        div.innerHTML = `
            <div class="aviso-icono">⚠</div>
            <div class="aviso-texto">
                <strong>Error:</strong><br>
                El archivo está vacío o no tiene el formato:<br>
                Matrícula | Nombre | Apellido.<br>
                Vuelva a cargar el archivo
            </div>
        `;
    }
}

// ── Guardar grupo → POST /crear_grupo ──
function guardarGrupo() {
    const nombre      = document.getElementById("nombreGrupo").value.trim();
    const archivoInput = document.getElementById("archivoAlumnos");

    if (!nombre) {
        mostrarMensajeModal("El nombre del grupo es obligatorio.", "error");
        return;
    }
    if (!archivoInput.files.length) {
        mostrarMensajeModal("Selecciona un archivo .txt con la lista de alumnos.", "error");
        return;
    }
    if (!archivoValidado || !datosAlumnos) {
        mostrarMensajeModal("El archivo no es válido. Verifica el formato.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("nombre",  nombre);
    formData.append("archivo", archivoInput.files[0]);

    fetch("/crear_grupo", { method: "POST", body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.exito) {
                mostrarMensajeModal("¡Grupo creado correctamente!", "exito");
                setTimeout(() => {
                    cerrarModal();
                    cargarYElegirSeccion();
                }, 1200);
            } else {
                mostrarMensajeModal("Error: " + (data.mensaje || "No se pudo crear."), "error");
            }
        })
        .catch(() => mostrarMensajeModal("Error de conexión con el servidor.", "error"));
}

function obtenerNumeroParcial(nombreParcial) {
    const match = String(nombreParcial).match(/Parcial\s+(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

function obtenerParcialesMateria(idxGrupo, idxMateria) {
    return gruposCache?.[idxGrupo]?.materias?.[idxMateria]?.parciales || [];
}

function obtenerNumerosParcialesExistentes(idxGrupo, idxMateria) {
    return obtenerParcialesMateria(idxGrupo, idxMateria)
        .map(p => obtenerNumeroParcial(p.nombre))
        .filter(num => num !== null);
}

function obtenerParcialFaltante(idxGrupo, idxMateria) {
    const existentes = obtenerNumerosParcialesExistentes(idxGrupo, idxMateria);

    for (let i = 1; i <= 3; i++) {
        if (!existentes.includes(i)) return i;
    }

    return null;
}

// ══════════════════════════════════════════════════════════
//  RENDERIZADO DE GRUPOS
// ══════════════════════════════════════════════════════════
function renderizarGrupos(grupos) {
    const contenedor = document.getElementById("listaGrupos");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    grupos.forEach((grupo, idxGrupo) => {
        const tarjeta = document.createElement("div");
        tarjeta.classList.add("grupo-card");
        tarjeta.innerHTML = `
            <div class="grupo-header">
                <span class="nombreGrupo">Grupo ${grupo.nombre}</span>
                <div class="acciones-grupo">
                    <button class="btn-materia" onclick="agregarMateria(${idxGrupo})">+ Materia</button>

                    <button class="btn-editar-grupo"
                        onclick="editarGrupo(${idxGrupo})"
                        title="Editar grupo">
                        <img src="/static/img/editar-grupo.svg" alt="Editar">
                    </button>

                    <button class="btn-eliminar-grupo" onclick="abrirModalEliminarGrupo(${idxGrupo})" title="Eliminar grupo">
                        <img src="/static/img/eliminar.svg" alt="Eliminar">
                    </button>
                </div>
            </div>
            <div class="grupo-body" id="materias-${idxGrupo}"></div>
        `;
        contenedor.appendChild(tarjeta);
        renderizarMaterias(grupo.materias, idxGrupo);
    });
}

function renderizarMaterias(materias, idxGrupo) {
    const cont = document.getElementById(`materias-${idxGrupo}`);
    if (!cont) return;
    cont.innerHTML = "";

    if (!materias || materias.length === 0) {
        cont.innerHTML = `<p class="mensaje-vacio">Aún no hay materias en este grupo.</p>`;
        return;
    }

    materias.forEach((materia, idxMateria) => {
        const div = document.createElement("div");
        div.classList.add("contenedor-materia-parcial");
        div.innerHTML = `
            <div class="contenedor-materia-acciones">
                <span class="nombreMateria">${materia.nombre}</span>
                <div class="acciones-materia">
                    <button class="btn-eliminar-materia"
                        onclick="abrirModalEliminarMateria(${idxGrupo}, ${idxMateria})"
                        title="Eliminar materia">
                        <img src="/static/img/eliminar2.png" alt="Eliminar">
                    </button>
                    <button class="btn-editar-materia"
                        onclick="editarMateria(${idxGrupo}, ${idxMateria})"
                        title="Editar materia">
                        <img src="/static/img/editar2.png" alt="Editar">
                    </button>
                </div>
            </div>
            <div class="parcial-contenedor" id="parciales-${idxGrupo}-${idxMateria}"></div>
            <button class="btn-agregarParcial" onclick="agregarParcial(${idxGrupo}, ${idxMateria})">
                + Añadir parcial
            </button>
        `;
        cont.appendChild(div);
        renderizarParciales(materia.parciales, idxGrupo, idxMateria);
    });
}

function renderizarParciales(parciales, idxGrupo, idxMateria) {
    const cont = document.getElementById(`parciales-${idxGrupo}-${idxMateria}`);
    if (!cont) return;

    cont.innerHTML = "";
    if (!parciales || parciales.length === 0) return;

    parciales
        .map((parcial, idxOriginal) => ({ parcial, idxOriginal }))
        .sort((a, b) => {
            const numA = parseInt(a.parcial.nombre.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.parcial.nombre.match(/\d+/)?.[0] || "0");
            return numA - numB;
        })
        .forEach(({ parcial, idxOriginal }) => {
            const chip = document.createElement("div");
            chip.classList.add("parciales-container");

            chip.innerHTML = `
                <button class="parcial-item"
                    onclick="irAProgresiones(${idxGrupo}, ${idxMateria}, ${idxOriginal})">
                    ${parcial.nombre}
                </button>
                <div class="acciones-parcial">
                    <button class="btn-eliminarParcial"
                        onclick="abrirModalEliminarParcial(${idxGrupo}, ${idxMateria}, ${idxOriginal})"
                        title="Eliminar parcial">
                        <img src="/static/img/eliminar2.png" alt="Eliminar">
                    </button>
                    <button class="btn-editarParcial"
                        onclick="editarParcial(${idxGrupo}, ${idxMateria}, ${idxOriginal})"
                        title="Editar parcial">
                        <img src="/static/img/editar2.png" alt="Editar">
                    </button>
                </div>
            `;

            cont.appendChild(chip);
        });
}

// ══════════════════════════════════════════════════════════
//  EDITAR GRUPO
// ══════════════════════════════════════════════════════════
function editarGrupo(idxGrupo) {
    const span = document.querySelector(
        `#listaGrupos .grupo-card:nth-child(${idxGrupo + 1}) .nombreGrupo`
    );

    const nombreActual = span
        ? span.textContent.replace("Grupo", "").trim()
        : "";

    editarGrupoTarget = { idxGrupo };

    const input = document.getElementById("inputEditarGrupo");
    input.value = nombreActual;

    actualizarBreadcrumb(["Grupos", "Editar grupo"]);
    _abrirModal("modalEditarGrupo");

    setTimeout(() => input.focus(), 120);
}

function cerrarModalEditarGrupo() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEditarGrupo");
    editarGrupoTarget = null;
}

function confirmarEditarGrupo() {
    const nuevoNombre = document.getElementById("inputEditarGrupo").value.trim();

    if (!nuevoNombre || !editarGrupoTarget) return;

    fetch("/api/editar_grupo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grupo: editarGrupoTarget.idxGrupo,
            nombre: nuevoNombre
        })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarGrupo();

        if (data.exito) {
            cargarYElegirSeccion();
        } else {
            alert(data.mensaje || "No se pudo editar el grupo.");
        }
    })
    .catch(() => {
        cerrarModalEditarGrupo();
        alert("El endpoint /api/editar_grupo no está implementado aún en app.py.");
    });
}

// ══════════════════════════════════════════════════════════
//  MODAL ELIMINAR (genérico)
// ══════════════════════════════════════════════════════════
function _abrirModalEliminar(titulo, linea1, linea2, textoBtn, chipsHTML, accion) {
    document.getElementById("tituloModalEliminar").textContent  = titulo;
    document.getElementById("textoEliminarLinea1").textContent  = linea1;
    document.getElementById("textoEliminarLinea2").textContent  = linea2;
    document.getElementById("textoBotonEliminar").textContent   = textoBtn;

    const extra = document.getElementById("infoEliminarExtra");
    if (chipsHTML) {
        extra.innerHTML      = chipsHTML;
        extra.style.display  = "flex";
    } else {
        extra.innerHTML      = "";
        extra.style.display  = "none";
    }

    accionEliminar = accion;
    _abrirModal("modalEliminar");
}

function ejecutarEliminar() {
    if (typeof accionEliminar === "function") accionEliminar();
    accionEliminar = null;
}

function cerrarModalEliminar() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEliminar");
    accionEliminar = null;
}

// ── Eliminar grupo ──
function abrirModalEliminarGrupo(idxGrupo) {
    actualizarBreadcrumb(["Grupos", "Eliminar grupo"]);
    _abrirModalEliminar(
        "ELIMINAR GRUPO",
        "¿Estás seguro de que deseas eliminar este grupo?",
        "Se perderán todos los datos de forma permanente.",
        "Eliminar grupo",
        null,
        () => ejecutarEliminarGrupo(idxGrupo)
    );
}

function ejecutarEliminarGrupo(idxGrupo) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) cargarYElegirSeccion();
        else console.error(data.mensaje);
    });
}

// ── Eliminar materia ──
function abrirModalEliminarMateria(idxGrupo, idxMateria) {
    actualizarBreadcrumb(["Grupos", "Eliminar materia"]);
    _abrirModalEliminar(
        "ELIMINAR MATERIA",
        "¿Estás seguro de que deseas eliminar esta materia?",
        "Se perderán también todos sus parciales de forma permanente.",
        "Eliminar materia",
        null,
        () => ejecutarEliminarMateria(idxGrupo, idxMateria)
    );
}

function ejecutarEliminarMateria(idxGrupo, idxMateria) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) cargarYElegirSeccion();
        else console.error(data.mensaje);
    });
}

// ── Eliminar parcial ──
function abrirModalEliminarParcial(idxGrupo, idxMateria, idxParcial) {
    const parcial = obtenerParcialesMateria(idxGrupo, idxMateria)[idxParcial];
    const nombreParcial = parcial ? parcial.nombre : `Parcial ${idxParcial + 1}`;

    const materiaObj = gruposCache?.[idxGrupo]?.materias?.[idxMateria];
    const materia = materiaObj ? materiaObj.nombre : "";

    const chips = `
        <div class="chip-info">${materia}</div>
        <div class="chip-info">${nombreParcial}</div>
    `;

    actualizarBreadcrumb(["Grupos", "Eliminar parcial"]);

    _abrirModalEliminar(
        "ELIMINAR PARCIAL",
        "¿Estás seguro que quieres eliminar este parcial?",
        "Se perderán sus progresiones de forma permanente.",
        "Eliminar parcial",
        chips,
        () => ejecutarEliminarParcial(idxGrupo, idxMateria, idxParcial)
    );
}

function ejecutarEliminarParcial(idxGrupo, idxMateria, idxParcial) {
    fetch("/api/eliminar_elemento", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, parcial: idxParcial })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEliminar();
        if (data.exito) cargarYElegirSeccion();
        else console.error(data.mensaje);
    });
}

// ══════════════════════════════════════════════════════════
//  MATERIAS
// ══════════════════════════════════════════════════════════
function agregarMateria(idxGrupo) {
    grupoMateriaTarget = { idxGrupo };
    document.getElementById("inputNombreMateria").value = "";
    actualizarBreadcrumb(["Grupos", "Agregar materia"]);
    _abrirModal("modalAgregarMateria");
    setTimeout(() => document.getElementById("inputNombreMateria").focus(), 120);
}

function cerrarModalMateria() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalAgregarMateria");
    grupoMateriaTarget = null;
}

function confirmarAgregarMateria() {
    const nombre = document.getElementById("inputNombreMateria").value.trim();
    if (!nombre || !grupoMateriaTarget) return;

    fetch("/api/crear_materia", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: grupoMateriaTarget.idxGrupo, materia: nombre })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalMateria();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

// ── Editar materia ──
function editarMateria(idxGrupo, idxMateria) {
    const span = document.querySelector(
        `#materias-${idxGrupo} .contenedor-materia-parcial:nth-child(${idxMateria + 1}) .nombreMateria`
    );
    const nombreActual = span ? span.textContent.trim() : "";
    editarMateriaTarget = { idxGrupo, idxMateria };
    document.getElementById("inputEditarMateria").value = nombreActual;
    actualizarBreadcrumb(["Grupos", "Editar materia"]);
    _abrirModal("modalEditarMateria");
    setTimeout(() => document.getElementById("inputEditarMateria").focus(), 120);
}

function cerrarModalEditarMateria() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEditarMateria");
    editarMateriaTarget = null;
}

function confirmarEditarMateria() {
    const nuevoNombre = document.getElementById("inputEditarMateria").value.trim();
    if (!nuevoNombre || !editarMateriaTarget) return;

    // El backend actual no tiene endpoint de editar materia.
    // Implementación: eliminar + crear (o se puede añadir ruta al backend).
    // Por ahora mostramos aviso hasta que la ruta exista:
    const { idxGrupo, idxMateria } = editarMateriaTarget;
    fetch("/api/editar_materia", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ grupo: idxGrupo, materia: idxMateria, nombre: nuevoNombre })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarMateria();
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje || "Función pendiente en el servidor.");
    })
    .catch(() => {
        cerrarModalEditarMateria();
        alert("El endpoint /api/editar_materia no está implementado aún en app.py.");
    });
}

// ══════════════════════════════════════════════════════════
//  PARCIALES
// ══════════════════════════════════════════════════════════
function agregarParcial(idxGrupo, idxMateria) {
    const faltante = obtenerParcialFaltante(idxGrupo, idxMateria);

    parcialTarget = { idxGrupo, idxMateria, numeroParcial: faltante };

    const preview = document.getElementById("nombreParcialPreview");
    const limite = document.getElementById("limiteParcialMsg");
    const btnConf = document.getElementById("btnConfirmarParcial");

    if (faltante === null) {
        preview.style.display = "none";
        limite.style.display = "block";
        limite.textContent = "⚠️ Ya existen los 3 parciales permitidos.";
        btnConf.disabled = true;
    } else {
        preview.style.display = "inline-block";
        preview.textContent = `Parcial ${faltante}`;
        limite.style.display = "none";
        limite.textContent = "";
        btnConf.disabled = false;
    }

    actualizarBreadcrumb(["Grupos", "Agregar parcial"]);
    _abrirModal("modalAgregarParcial");
}

function cerrarModalParcial() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalAgregarParcial");
    parcialTarget = null;
}

function confirmarAgregarParcial() {
    if (!parcialTarget) return;

    const { idxGrupo, idxMateria, numeroParcial } = parcialTarget;

    if (!numeroParcial) return;

    const nombre = `Parcial ${numeroParcial}`;

    fetch("/api/crear_parcial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo, materia: idxMateria, nombre })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) {
            cerrarModalParcial();
            cargarYElegirSeccion();
        } else {
            const limite = document.getElementById("limiteParcialMsg");
            const btnConf = document.getElementById("btnConfirmarParcial");

            limite.style.display = "block";
            limite.textContent = "⚠️ " + (data.mensaje || "No se pudo agregar el parcial.");
            btnConf.disabled = true;
        }
    });
}

// ── Editar parcial ──
function editarParcial(idxGrupo, idxMateria, idxParcial) {
    editarParcialTarget = { idxGrupo, idxMateria, idxParcial };

    const parcial = obtenerParcialesMateria(idxGrupo, idxMateria)[idxParcial];
    const numeroActual = obtenerNumeroParcial(parcial?.nombre) || 1;

    const input = document.getElementById("inputEditarParcial");
    const aviso = document.getElementById("avisoEditarParcial");

    input.value = numeroActual;
    input.style.border = "";

    if (aviso) {
        aviso.style.display = "none";
        aviso.textContent = "";
    }

    actualizarBreadcrumb(["Grupos", "Editar parcial"]);
    _abrirModal("modalEditarParcial");

    setTimeout(() => input.focus(), 120);
}

function cerrarModalEditarParcial() {
    actualizarBreadcrumb(["Grupos"]);
    _cerrarModal("modalEditarParcial");
    editarParcialTarget = null;
}

function confirmarEditarParcial() {
    const input = document.getElementById("inputEditarParcial");
    const numero = parseInt(input.value);

    const aviso = document.getElementById("avisoEditarParcial");

    if (isNaN(numero) || numero < 1 || numero > 3) {
        input.style.border = "2px solid red";
        if (aviso) {
            aviso.style.display = "block";
            aviso.textContent = "⚠️ El parcial debe estar entre 1 y 3.";
        }
        return;
    }

    if (!editarParcialTarget) return;

    const { idxGrupo, idxMateria, idxParcial } = editarParcialTarget;

    const existentes = obtenerNumerosParcialesExistentes(idxGrupo, idxMateria);
    const parcialActual = obtenerParcialesMateria(idxGrupo, idxMateria)[idxParcial];
    const numeroActual = obtenerNumeroParcial(parcialActual?.nombre);

    if (numero !== numeroActual && existentes.includes(numero)) {
        input.style.border = "2px solid red";

        if (aviso) {
            aviso.style.display = "block";
            aviso.textContent = "⚠️ Ese parcial ya existe. Elige otro número.";
        }

        return;
    }

    input.style.border = "";

    if (aviso) {
        aviso.style.display = "none";
        aviso.textContent = "";
    }

    fetch("/api/editar_parcial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grupo: idxGrupo,
            materia: idxMateria,
            parcial: idxParcial,
            nombre: `Parcial ${numero}`
        })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarParcial();

        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje || "No se pudo editar el parcial.");
    });
}

// ══════════════════════════════════════════════════════════
//  NAVEGACIÓN A PROGRESIONES
// ══════════════════════════════════════════════════════════
function irAProgresiones(idxGrupo, idxMateria, idxParcial) {
    localStorage.setItem("progresionContexto", JSON.stringify({
        grupo: idxGrupo, materia: idxMateria, parcial: idxParcial
    }));
    window.location.href = "/progresiones";
}

// ══════════════════════════════════════════════════════════
//  HELPERS DE MODAL (abrir / cerrar con animación)
// ══════════════════════════════════════════════════════════
function _abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("activa");
}

function _cerrarModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("cerrando");
    setTimeout(() => {
        modal.classList.remove("activa", "cerrando");
    }, 250);
}